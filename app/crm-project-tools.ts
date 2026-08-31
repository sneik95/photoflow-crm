import type { CheckItem, TimelineItem } from "./crm-data";

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeDone(value: unknown) {
  return value === true;
}

export function normalizeChecklistItems(value: unknown): CheckItem[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = safeText(record.label);
    if (!label) return [];
    const baseId = safeText(record.id) || `equipment-${index + 1}`;
    const id = ids.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    ids.add(id);
    return [{ id, label, done: safeDone(record.done) }];
  });
}

export function normalizeTimelineItems(value: unknown): TimelineItem[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = safeText(record.label);
    const time = safeText(record.time);
    if (!label || !/^\d{2}:\d{2}$/.test(time)) return [];
    const baseId = safeText(record.id) || `timeline-${index + 1}`;
    const id = ids.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    ids.add(id);
    return [{ id, time, label, done: safeDone(record.done) }];
  });
}

export function addChecklistItem(items: CheckItem[], label: string, id: string): CheckItem[] {
  const cleanLabel = safeText(label);
  return cleanLabel ? [...normalizeChecklistItems(items), { id, label: cleanLabel, done: false }] : normalizeChecklistItems(items);
}

export function updateChecklistItem(items: CheckItem[], id: string, patch: Partial<CheckItem>): CheckItem[] {
  return normalizeChecklistItems(items).map((item) => item.id === id
    ? { ...item, ...patch, label: safeText(patch.label ?? item.label) || item.label }
    : item);
}

export function removeChecklistItem(items: CheckItem[], id: string): CheckItem[] {
  return normalizeChecklistItems(items).filter((item) => item.id !== id);
}

export function addTimelineItem(items: TimelineItem[], item: TimelineItem): TimelineItem[] {
  return [...normalizeTimelineItems(items), ...normalizeTimelineItems([item])]
    .sort((left, right) => left.time.localeCompare(right.time));
}

export function updateTimelineItem(items: TimelineItem[], id: string, patch: Partial<TimelineItem>): TimelineItem[] {
  return normalizeTimelineItems(items)
    .map((item) => item.id === id
      ? {
          ...item,
          ...patch,
          label: safeText(patch.label ?? item.label) || item.label,
          time: safeText(patch.time ?? item.time) || item.time,
        }
      : item)
    .sort((left, right) => left.time.localeCompare(right.time));
}

export function removeTimelineItem(items: TimelineItem[], id: string): TimelineItem[] {
  return normalizeTimelineItems(items).filter((item) => item.id !== id);
}
