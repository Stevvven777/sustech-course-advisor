import { createHash } from "node:crypto";
import type { AdvisorResult, RecommendedPlan } from "../types.js";

const START: Record<number, [number, number]> = {1:[8,0],2:[9,0],3:[10,20],4:[11,20],5:[13,30],6:[14,30],7:[15,30],8:[16,30],9:[18,0],10:[19,0],11:[20,0],12:[21,0],13:[22,0]};

export function renderStrategyIcs(result: AdvisorResult, plan: RecommendedPlan): string {
  if (!result.weekOneMonday) throw new Error("ICS export requires weekOneMonday in the advisor result.");
  const stamp = formatUtc(new Date(result.generatedAt));
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//sustech-course-advisor//EN","CALSCALE:GREGORIAN",`X-WR-CALNAME:SUSTech ${plan.strategy}`];
  for (const section of plan.sections) for (const slot of section.schedule) for (const week of slot.weeks) {
    const date = addDays(result.weekOneMonday, (week - 1) * 7 + slot.day - 1);
    const [hour, minute] = START[slot.periodStart] ?? [8, 0];
    const [endHour, endMinute] = START[slot.periodEnd] ?? [hour, minute];
    const start = shenzhenToUtc(date, hour, minute);
    const end = shenzhenToUtc(date, endHour, endMinute + 50);
    const uid = createHash("sha256").update(`${plan.strategy}/${section.rwh}/${week}/${slot.day}/${slot.periodStart}`).digest("hex").slice(0,24);
    lines.push("BEGIN:VEVENT",`UID:${uid}@sustech-course-advisor`,`DTSTAMP:${stamp}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${escapeIcs(`${section.code} ${section.name}`)}`,`LOCATION:${escapeIcs(slot.room)}`,`DESCRIPTION:${escapeIcs(`${section.teachers.join("、")} | Week ${week}`)}`,"END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function addDays(iso: string, days: number): string { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10); }
function shenzhenToUtc(date: string, hour: number, minute: number): string { return formatUtc(new Date(`${date}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00+08:00`)); }
function formatUtc(date: Date): string { return date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z"); }
function escapeIcs(value: string): string { return value.replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n"); }
