import assert from 'node:assert/strict';
import test from 'node:test';

import { buildColorRegistry, courseCodeFromCellLabel, validateTimetableData, type TimetableData } from './timetable-data.ts';

test('cell labels preserve normalized course codes without a restrictive format regex', () => {
  assert.equal(courseCodeFromCellLabel(' cs-long-42A \n课程名\n示例教师'), 'CS-LONG-42A');
});

test('validation rejects empty plans and invalid meeting coordinates', () => {
  const data = fixture();
  data.plans = [];
  data.sections[0].meetings = [
    { day: -1, periodStart: 1, periodEnd: 2 },
    { day: 0, periodStart: 4, periodEnd: 3 },
    { day: 0, periodStart: 1.5, periodEnd: 2 },
  ];
  const errors = validateTimetableData(data).join(' ');
  assert.match(errors, /At least one plan/);
  assert.match(errors, /invalid meeting day/);
  assert.match(errors, /invalid meeting period/);
});

test('up to sixteen course colors have deterministic 22-degree hue separation', () => {
  const data = fixture();
  data.courses = Array.from({ length: 16 }, (_, index) => ({ code:`course-${index}`, name:`Course ${index}`, credits:1, curriculumStatus:'confirmed-choice' as const }));
  const first = buildColorRegistry(data);
  const second = buildColorRegistry(structuredClone(data));
  assert.deepEqual(first, second);
  const hues = Object.values(first).map((color) => Number(color.match(/hsl\(([\d.]+)/)?.[1]));
  for (let left = 0; left < hues.length; left += 1) for (let right = left + 1; right < hues.length; right += 1) {
    const distance = Math.abs(hues[left] - hues[right]);
    assert.ok(Math.min(distance, 360 - distance) >= 22);
  }
});

test('validation rejects a data set too large for the guaranteed color contract', () => {
  const data = fixture();
  data.courses = Array.from({ length: 17 }, (_, index) => ({ code:`C-${index}`, name:`Course ${index}`, credits:1, curriculumStatus:'confirmed-choice' as const }));
  assert.match(validateTimetableData(data).join(' '), /At most 16/);
  assert.throws(() => buildColorRegistry(data), /at most 16/i);
});

function fixture(): TimetableData {
  return {
    schemaVersion:'1', title:'Synthetic', semester:'Synthetic', periodCount:12, weekdays:['一','二','三','四','五'],
    courses:[{ code:'CS101', name:'Synthetic Course', credits:3, curriculumStatus:'confirmed-required' }],
    sections:[{ id:'section-a', courseCode:'CS101', sectionName:'A', teachingTeam:['示例教师'], meetings:[{ day:0, periodStart:1, periodEnd:2 }] }],
    plans:[{ id:'plan-a', label:'Plan A', summary:'Synthetic', sectionIds:['section-a'], rankingPrinciples:['Synthetic'] }],
  };
}
