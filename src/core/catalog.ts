import type { CourseSection, ScheduleSlot } from "../types.js";

export interface CatalogNormalization {
  sections: CourseSection[];
  ambiguousCodes: string[];
  rejectedRows: number;
}

export function normalizeCatalogRows(value: unknown): CatalogNormalization {
  const rows = Array.isArray(value) ? value : [];
  const projected: CourseSection[] = [];
  let rejectedRows = 0;
  for (const row of rows) {
    const section = projectSection(row);
    if (section) projected.push(section);
    else rejectedRows += 1;
  }

  const ambiguousCodes = new Set<string>();
  const identityMap = new Map<string, CourseSection>();
  const byCodeAndGroup = new Map<string, Set<string>>();
  for (const section of projected) {
    const code = normalize(section.code);
    const identityKeys = [`rwh:${section.rwh}`, ...(section.id ? [`id:${section.id}`] : [])];
    for (const key of identityKeys) {
      const existing = identityMap.get(key);
      if (existing && !sameSelectionRecord(existing, section)) {
        ambiguousCodes.add(code);
        ambiguousCodes.add(normalize(existing.code));
      } else identityMap.set(key, section);
    }
    if (section.classGroup.trim()) {
      const groupKey = `${code}\u0000${normalize(section.classGroup)}`;
      const handles = byCodeAndGroup.get(groupKey) ?? new Set<string>();
      handles.add(section.rwh);
      byCodeAndGroup.set(groupKey, handles);
    }
  }
  for (const [key, handles] of byCodeAndGroup) if (handles.size > 1) ambiguousCodes.add(key.split("\u0000")[0]);

  const deduplicated = new Map<string, CourseSection>();
  for (const section of projected) {
    if (!ambiguousCodes.has(normalize(section.code))) deduplicated.set(selectionKey(section), section);
  }
  return { sections: [...deduplicated.values()], ambiguousCodes: [...ambiguousCodes].sort(), rejectedRows };
}

function projectSection(value: unknown): CourseSection | undefined {
  const item = object(value);
  const code = text(item.code);
  const name = text(item.name);
  const sectionName = text(item.sectionName);
  const classGroup = text(item.classGroup);
  const rwh = text(item.rwh);
  const credits = finite(item.credits);
  const teachers = stringArray(item.teachers);
  const schedule = Array.isArray(item.schedule) ? item.schedule.map(projectMeeting).filter((slot): slot is ScheduleSlot => Boolean(slot)) : [];
  if (!code || !name || !sectionName || !rwh || credits === undefined || credits < 0) return undefined;
  return {
    code, name, sectionName, classGroup, rwh,
    ...(text(item.id) ? { id: text(item.id) } : {}),
    college: text(item.college), category: text(item.category), nature: text(item.nature), campus: text(item.campus),
    credits,
    ...(finite(item.capacity) !== undefined ? { capacity: finite(item.capacity) } : {}),
    ...(finite(item.enrolled) !== undefined ? { enrolled: finite(item.enrolled) } : {}),
    teachers,
    schedule,
  };
}

function projectMeeting(value: unknown): ScheduleSlot | undefined {
  const item = object(value);
  const day = finite(item.day);
  const periodStart = finite(item.periodStart);
  const periodEnd = finite(item.periodEnd);
  const weeks = Array.isArray(item.weeks) ? item.weeks.filter((week): week is number => Number.isInteger(week) && week > 0) : [];
  if (day === undefined || periodStart === undefined || periodEnd === undefined || weeks.length === 0) return undefined;
  return { weeks, day, dayName: text(item.dayName), periodStart, periodEnd, room: text(item.room) };
}

function sameSelectionRecord(left: CourseSection, right: CourseSection): boolean {
  return normalize(left.code) === normalize(right.code)
    && left.rwh === right.rwh
    && left.id === right.id
    && left.classGroup === right.classGroup
    && JSON.stringify(left.schedule) === JSON.stringify(right.schedule);
}

function selectionKey(section: CourseSection): string { return `${normalize(section.code)}\u0000${section.rwh}\u0000${section.id ?? ""}`; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function finite(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }
function normalize(value: string): string { return value.trim().toUpperCase(); }
