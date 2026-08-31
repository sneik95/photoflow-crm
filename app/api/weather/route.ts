type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type ResolvedPlace = {
  latitude: number;
  longitude: number;
  name: string;
  geocoder: "openstreetmap" | "coordinates";
};

type MetPeriod = {
  summary?: { symbol_code?: string };
  details?: {
    probability_of_precipitation?: number;
    precipitation_amount?: number;
  };
};

type MetPoint = {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature?: number;
        cloud_area_fraction?: number;
        wind_speed?: number;
      };
    };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
    next_12_hours?: MetPeriod;
  };
};

type MetForecast = {
  properties?: {
    meta?: { updated_at?: string };
    timeseries?: MetPoint[];
  };
};

const KNOWN_VENUES: Array<{
  pattern: RegExp;
  latitude: number;
  longitude: number;
  name: string;
}> = [
  {
    pattern: /шато[\s-]*пино|chateau[\s-]*pinot/i,
    latitude: 44.684876,
    longitude: 37.709537,
    name: "Шато Пино, Федотовка, Новороссийск",
  },
];

function coordinatesFrom(value: string): ResolvedPlace | null {
  const match = value.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1].replace(",", "."));
  const longitude = Number(match[2].replace(",", "."));
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    name: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    geocoder: "coordinates",
  };
}

async function resolvePlace(location: string): Promise<ResolvedPlace | null> {
  const explicit = coordinatesFrom(location);
  if (explicit) return explicit;

  const known = KNOWN_VENUES.find((venue) => venue.pattern.test(location));
  if (known) {
    return {
      latitude: known.latitude,
      longitude: known.longitude,
      name: known.name,
      geocoder: "coordinates",
    };
  }

  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", location);
    nominatimUrl.searchParams.set("format", "jsonv2");
    nominatimUrl.searchParams.set("limit", "1");
    nominatimUrl.searchParams.set("countrycodes", "ru");
    nominatimUrl.searchParams.set("accept-language", "ru");
    const response = await fetch(nominatimUrl, {
      headers: {
        "user-agent": "PhotoFlow/1.0 (https://foto-crm.idyachkov12.chatgpt.site)",
        referer: "https://foto-crm.idyachkov12.chatgpt.site/",
      },
    });
    if (!response.ok) return null;
    const [place] = (await response.json()) as NominatimResult[];
    if (!place) return null;
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? {
          latitude,
          longitude,
          name: place.display_name,
          geocoder: "openstreetmap",
        }
      : null;
  } catch {
    return null;
  }
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function dayOfYear(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = Date.UTC(year, 0, 0);
  return Math.floor((Date.UTC(year, month - 1, day) - start) / 86_400_000);
}

function solarTime(
  date: string,
  latitude: number,
  longitude: number,
  timezoneOffset: number,
  sunrise: boolean,
) {
  const radians = Math.PI / 180;
  const n = dayOfYear(date);
  const longitudeHour = longitude / 15;
  const approximate = n + ((sunrise ? 6 : 18) - longitudeHour) / 24;
  const meanAnomaly = 0.9856 * approximate - 3.289;
  let trueLongitude =
    meanAnomaly +
    1.916 * Math.sin(meanAnomaly * radians) +
    0.02 * Math.sin(2 * meanAnomaly * radians) +
    282.634;
  trueLongitude = normalizeDegrees(trueLongitude);

  let rightAscension =
    Math.atan(0.91764 * Math.tan(trueLongitude * radians)) / radians;
  rightAscension = normalizeDegrees(rightAscension);
  rightAscension +=
    Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;

  const sinDeclination = 0.39782 * Math.sin(trueLongitude * radians);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHour =
    (Math.cos(90.833 * radians) -
      sinDeclination * Math.sin(latitude * radians)) /
    (cosDeclination * Math.cos(latitude * radians));
  if (cosHour > 1 || cosHour < -1) return "—";

  let hourAngle = Math.acos(cosHour) / radians;
  if (sunrise) hourAngle = 360 - hourAngle;
  hourAngle /= 15;
  const localMean =
    hourAngle + rightAscension - 0.06571 * approximate - 6.622;
  const localHour = ((localMean - longitudeHour + timezoneOffset) % 24 + 24) % 24;
  const hours = Math.floor(localHour);
  const minutes = Math.round((localHour - hours) * 60);
  const normalizedHours = (hours + Math.floor(minutes / 60)) % 24;
  return `${String(normalizedHours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function goldenHour(sunset: string) {
  if (sunset === "—") return "—";
  const [hours, minutes] = sunset.split(":").map(Number);
  const total = (hours * 60 + minutes - 60 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function weatherDescription(symbol = "") {
  const value = symbol.toLowerCase();
  if (value.includes("thunder")) return { label: "гроза", icon: "⛈️" };
  if (value.includes("snow")) return { label: "снег", icon: "🌨️" };
  if (value.includes("sleet")) return { label: "мокрый снег", icon: "🌨️" };
  if (value.includes("rain") || value.includes("drizzle")) {
    return {
      label: value.includes("heavy") ? "сильный дождь" : "дождь",
      icon: "🌧️",
    };
  }
  if (value.includes("fog")) return { label: "туман", icon: "🌫️" };
  if (value.includes("partlycloudy")) {
    return { label: "переменная облачность", icon: "⛅" };
  }
  if (value.includes("cloudy")) return { label: "облачно", icon: "☁️" };
  if (value.includes("fair")) return { label: "малооблачно", icon: "🌤️" };
  if (value.includes("clearsky")) return { label: "ясно", icon: "☀️" };
  return { label: "без существенных осадков", icon: "🌤️" };
}

function localDate(time: string, timezoneOffset: number) {
  return new Date(Date.parse(time) + timezoneOffset * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = url.searchParams.get("location")?.trim();
  const date = url.searchParams.get("date")?.trim();
  const shootTime = url.searchParams.get("time")?.trim() || "12:00";
  if (!location || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { available: false, error: "Укажите локацию и дату" },
      { status: 400 },
    );
  }

  try {
    const place = await resolvePlace(location);
    if (!place) {
      return Response.json({
        available: false,
        error: "Не удалось найти площадку. Укажите адрес с городом или координаты",
      });
    }

    const forecastUrl = new URL(
      "https://api.met.no/weatherapi/locationforecast/2.0/compact",
    );
    forecastUrl.searchParams.set("lat", place.latitude.toFixed(4));
    forecastUrl.searchParams.set("lon", place.longitude.toFixed(4));
    const forecastResponse = await fetch(forecastUrl, {
      headers: {
        "user-agent":
          "PhotoFlow/1.0 https://foto-crm.idyachkov12.chatgpt.site helloisocrm@gmail.com",
        accept: "application/json",
      },
    });
    if (!forecastResponse.ok) {
      throw new Error(`MET Norway временно недоступен (${forecastResponse.status})`);
    }

    const forecast = (await forecastResponse.json()) as MetForecast;
    const timeseries = forecast.properties?.timeseries || [];
    if (!timeseries.length) throw new Error("MET Norway не вернул прогноз");

    const timezoneOffset = Math.max(
      -12,
      Math.min(14, Math.round(place.longitude / 15)),
    );
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = shootTime.split(":").map(Number);
    const target = Date.UTC(
      year,
      month - 1,
      day,
      hour - timezoneOffset,
      minute || 0,
    );
    const firstTime = Date.parse(timeseries[0].time);
    const lastTime = Date.parse(timeseries[timeseries.length - 1].time);
    if (target < firstTime - 3_600_000 || target > lastTime + 3_600_000) {
      return Response.json({
        available: false,
        error: "Новый источник ещё не опубликовал прогноз на эту дату",
        provider: "met-norway",
      });
    }

    const point = timeseries.reduce((closest, candidate) =>
      Math.abs(Date.parse(candidate.time) - target) <
      Math.abs(Date.parse(closest.time) - target)
        ? candidate
        : closest,
    );
    const period =
      point.data.next_1_hours ||
      point.data.next_6_hours ||
      point.data.next_12_hours;
    const details = point.data.instant.details;
    const description = weatherDescription(period?.summary?.symbol_code);
    const dailyTemperatures = timeseries
      .filter((candidate) => localDate(candidate.time, timezoneOffset) === date)
      .map((candidate) => candidate.data.instant.details.air_temperature)
      .filter((value): value is number => typeof value === "number");
    const sunrise = solarTime(
      date,
      place.latitude,
      place.longitude,
      timezoneOffset,
      true,
    );
    const sunset = solarTime(
      date,
      place.latitude,
      place.longitude,
      timezoneOffset,
      false,
    );

    return Response.json(
      {
        available: true,
        ...description,
        temperature: details.air_temperature ?? 0,
        max: dailyTemperatures.length
          ? Math.max(...dailyTemperatures)
          : details.air_temperature ?? 0,
        min: dailyTemperatures.length
          ? Math.min(...dailyTemperatures)
          : details.air_temperature ?? 0,
        precipitation:
          period?.details?.probability_of_precipitation ??
          ((period?.details?.precipitation_amount || 0) > 0 ? 70 : 0),
        wind: Math.round((details.wind_speed || 0) * 3.6),
        cloud: Math.round(details.cloud_area_fraction || 0),
        sunrise,
        sunset,
        goldenHour: goldenHour(sunset),
        resolvedName: place.name,
        geocoder: place.geocoder,
        provider: "met-norway",
        updatedAt:
          forecast.properties?.meta?.updated_at || new Date().toISOString(),
      },
      { headers: { "cache-control": "private, max-age=900" } },
    );
  } catch (error) {
    return Response.json(
      {
        available: false,
        error:
          error instanceof Error ? error.message : "Прогноз временно недоступен",
        provider: "met-norway",
      },
      { status: 502 },
    );
  }
}
