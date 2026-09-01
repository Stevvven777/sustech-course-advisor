export type Parity = 'all' | 'odd' | 'even';
export type CurriculumStatus = 'confirmed-required' | 'confirmed-choice' | 'unresolved';

export type CourseDefinition = {
  code: string;
  name: string;
  credits: number;
  curriculumStatus: CurriculumStatus;
};

export type Meeting = {
  day: number;
  periodStart: number;
  periodEnd: number;
  parity?: Exclude<Parity, 'all'>;
  component?: string;
};

export type SectionDefinition = {
  id: string;
  courseCode: string;
  sectionName: string;
  teachingTeam: string[];
  meetings: Meeting[];
};

export type TimetablePlan = {
  id: string;
  label: string;
  summary: string;
  sectionIds: string[];
  rankingPrinciples: string[];
};

export type TimetableData = {
  schemaVersion: '1';
  title: string;
  semester: string;
  periodCount: number;
  weekdays: string[];
  courses: CourseDefinition[];
  sections: SectionDefinition[];
  plans: TimetablePlan[];
};

export type ResolvedSection = SectionDefinition & { course: CourseDefinition };

export function resolvePlan(data: TimetableData, plan: TimetablePlan): ResolvedSection[] {
  const sections = new Map(data.sections.map((section) => [section.id, section]));
  const courses = new Map(data.courses.map((course) => [normalize(course.code), course]));
  return plan.sectionIds.map((id) => {
    const section = sections.get(id);
    if (!section) throw new Error(`Plan ${plan.id} references missing section ${id}.`);
    const course = courses.get(normalize(section.courseCode));
    if (!course) throw new Error(`Section ${id} references missing course ${section.courseCode}.`);
    return { ...section, course };
  });
}

export function planMetrics(sections: ResolvedSection[]) {
  const courses = new Map(sections.map((section) => [normalize(section.course.code), section.course]));
  const values = [...courses.values()];
  const totalCredits = sum(values.map((course) => course.credits));
  const unresolvedCredits = sum(values.filter((course) => course.curriculumStatus === 'unresolved').map((course) => course.credits));
  const confirmedCredits = totalCredits - unresolvedCredits;
  const conflicts = findConflicts(sections);
  const daysUsed = new Set(sections.flatMap((section) => section.meetings.map((meeting) => meeting.day))).size;
  const hasEarlyPeriods = sections.some((section) => section.meetings.some((meeting) => meeting.periodStart <= 2));
  return { totalCredits, confirmedCredits, unresolvedCredits, conflicts, daysUsed, hasEarlyPeriods };
}

export function buildGrid(data: TimetableData, sections: ResolvedSection[], parity: Parity): string[][] {
  const grid = Array.from({ length: data.weekdays.length }, () => Array(data.periodCount).fill('')) as string[][];
  for (const section of sections) {
    for (const meeting of section.meetings) {
      if (parity !== 'all' && meeting.parity && meeting.parity !== parity) continue;
      const label = cellLabel(section, parity === 'all' ? meeting.parity : undefined);
      for (let period = meeting.periodStart; period <= meeting.periodEnd; period += 1) {
        const current = grid[meeting.day]?.[period - 1];
        if (current === undefined) throw new Error(`Meeting for ${section.id} is outside the configured grid.`);
        grid[meeting.day][period - 1] = current ? `${current}\n/\n${label}` : label;
      }
    }
  }
  return grid;
}

export function buildColorRegistry(data: TimetableData): Record<string, string> {
  const codes = [...new Set(data.courses.map((course) => normalize(course.code)))].sort();
  if (codes.length > 16) throw new Error('The color registry supports at most 16 active course codes with guaranteed separation.');
  if (!codes.length) return {};
  const phase = hashHue(codes.join('\u0000'));
  const step = 360 / codes.length;
  return Object.fromEntries(codes.map((code, index) => [code, `hsl(${((phase + step * index) % 360).toFixed(1)} 58% 29%)`]));
}

export function courseCodeFromCellLabel(label: string): string {
  return normalize(label.split('\n', 1)[0] ?? '');
}

export function validateTimetableData(data: TimetableData): string[] {
  const errors: string[] = [];
  const courseCodes = data.courses.map((course) => normalize(course.code));
  const sectionIds = data.sections.map((section) => section.id);
  const planIds = data.plans.map((plan) => plan.id);
  for (const duplicate of duplicates(courseCodes)) errors.push(`Duplicate course code: ${duplicate}.`);
  for (const duplicate of duplicates(sectionIds)) errors.push(`Duplicate section id: ${duplicate}.`);
  for (const duplicate of duplicates(planIds)) errors.push(`Duplicate plan id: ${duplicate}.`);
  if (!Number.isInteger(data.periodCount) || data.periodCount < 1) errors.push('Period count must be a positive integer.');
  if (!data.weekdays.length || data.weekdays.some((day) => !day.trim())) errors.push('Weekday labels must be non-empty.');
  if (!data.plans.length) errors.push('At least one plan is required.');
  if (new Set(courseCodes).size > 16) errors.push('At most 16 active course codes are supported so colors remain distinguishable.');
  for (const section of data.sections) {
    if (!courseCodes.includes(normalize(section.courseCode))) errors.push(`Section ${section.id} has no course.`);
    if (!section.teachingTeam.length || section.teachingTeam.some((name) => !name.trim())) errors.push(`Section ${section.id} has an incomplete teaching team.`);
    if (!section.meetings.length) errors.push(`Section ${section.id} has no meetings.`);
    for (const meeting of section.meetings) {
      const periods = [meeting.periodStart, meeting.periodEnd];
      if (!Number.isInteger(meeting.day) || meeting.day < 0 || meeting.day >= data.weekdays.length) errors.push(`Section ${section.id} has an invalid meeting day.`);
      if (periods.some((period) => !Number.isInteger(period) || period < 1 || period > data.periodCount) || meeting.periodStart > meeting.periodEnd) errors.push(`Section ${section.id} has an invalid meeting period.`);
    }
  }
  for (const plan of data.plans) {
    for (const id of plan.sectionIds) if (!sectionIds.includes(id)) errors.push(`Plan ${plan.id} references missing section ${id}.`);
    if (duplicates(plan.sectionIds).length) errors.push(`Plan ${plan.id} repeats a section.`);
  }
  return errors;
}

export function findConflicts(sections: ResolvedSection[]) {
  const conflicts: Array<[ResolvedSection, ResolvedSection]> = [];
  for (let left = 0; left < sections.length; left += 1) {
    for (let right = left + 1; right < sections.length; right += 1) {
      if (sections[left].meetings.some((a) => sections[right].meetings.some((b) => meetingsConflict(a, b)))) {
        conflicts.push([sections[left], sections[right]]);
      }
    }
  }
  return conflicts;
}

function meetingsConflict(left: Meeting, right: Meeting): boolean {
  if (left.day !== right.day || left.periodEnd < right.periodStart || right.periodEnd < left.periodStart) return false;
  return !(left.parity && right.parity && left.parity !== right.parity);
}

function cellLabel(section: ResolvedSection, parity?: Exclude<Parity, 'all'>): string {
  const marker = parity === 'odd' ? ' · 单周' : parity === 'even' ? ' · 双周' : '';
  return `${section.course.code}\n${section.course.name}${marker}\n${section.teachingTeam.join('、')}`;
}

function hashHue(code: string): number {
  let hash = 2166136261;
  for (const char of code) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (((hash >>> 0) % 997) * 137.508) % 360;
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function normalize(value: string): string { return value.trim().toUpperCase(); }
function sum(values: number[]): number { return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100; }
