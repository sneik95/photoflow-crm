import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, shoots } from "../../../db/schema";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token || token.length < 12) {
    return Response.json({ error: "Некорректная ссылка" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [shoot] = await db
      .select({
        id: shoots.id,
        clientId: shoots.clientId,
        clientName: shoots.clientName,
        type: shoots.type,
        color: shoots.color,
        startAt: shoots.startAt,
        endAt: shoots.endAt,
        location: shoots.location,
        price: shoots.price,
        paidAmount: shoots.paidAmount,
        deliveryDays: shoots.deliveryDays,
        delivered: shoots.delivered,
        status: shoots.status,
        clientGuide: shoots.clientGuide,
      })
      .from(shoots)
      .where(eq(shoots.portalToken, token))
      .limit(1);

    if (!shoot) {
      return Response.json({ error: "Проект не найден" }, { status: 404 });
    }

    let contact = { name: "", phone: "", email: "" };
    if (shoot.clientId) {
      const [client] = await db
        .select({ name: clients.name, phone: clients.phone, email: clients.email })
        .from(clients)
        .where(eq(clients.id, shoot.clientId))
        .limit(1);
      if (client) contact = client;
    }

    return Response.json({
      project: {
        ...shoot,
        contact,
        balance: Math.max(0, shoot.price - shoot.paidAmount),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось открыть проект" },
      { status: 500 },
    );
  }
}
