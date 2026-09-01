import type { TimetableData } from './timetable-data';

export const timetableData: TimetableData = {
  schemaVersion: '1',
  title: '候选课表',
  semester: '示例学期',
  periodCount: 12,
  weekdays: ['一', '二', '三', '四', '五'],
  courses: [
    { code: 'CS201', name: '数据结构', credits: 3, curriculumStatus: 'confirmed-required' },
    { code: 'STA201', name: '工程概率统计', credits: 3, curriculumStatus: 'confirmed-required' },
    { code: 'CLE101', name: '学术英语', credits: 2, curriculumStatus: 'confirmed-choice' },
    { code: 'EE201', name: '数字逻辑', credits: 3, curriculumStatus: 'confirmed-choice' },
    { code: 'CS299', name: '专题研讨', credits: 2, curriculumStatus: 'unresolved' },
  ],
  sections: [
    { id: 'cs201-a', courseCode: 'CS201', sectionName: 'A', teachingTeam: ['示例教师甲', '示例实验教师乙'], meetings: [{ day: 0, periodStart: 3, periodEnd: 4 }, { day: 2, periodStart: 7, periodEnd: 8, component: '实验' }] },
    { id: 'cs201-b', courseCode: 'CS201', sectionName: 'B', teachingTeam: ['示例教师甲', '示例实验教师丙'], meetings: [{ day: 1, periodStart: 5, periodEnd: 6 }, { day: 3, periodStart: 7, periodEnd: 8, component: '实验' }] },
    { id: 'sta201-a', courseCode: 'STA201', sectionName: 'A', teachingTeam: ['示例教师丁'], meetings: [{ day: 1, periodStart: 3, periodEnd: 4 }, { day: 4, periodStart: 7, periodEnd: 8, parity: 'odd' }] },
    { id: 'cle101-a', courseCode: 'CLE101', sectionName: 'A', teachingTeam: ['示例教师戊'], meetings: [{ day: 2, periodStart: 5, periodEnd: 6 }] },
    { id: 'cle101-b', courseCode: 'CLE101', sectionName: 'B', teachingTeam: ['示例教师己'], meetings: [{ day: 4, periodStart: 3, periodEnd: 4 }] },
    { id: 'ee201-a', courseCode: 'EE201', sectionName: 'A', teachingTeam: ['示例教师庚', '示例实验教师辛'], meetings: [{ day: 0, periodStart: 5, periodEnd: 6 }, { day: 3, periodStart: 9, periodEnd: 10 }] },
    { id: 'cs299-a', courseCode: 'CS299', sectionName: 'A', teachingTeam: ['示例教师壬'], meetings: [{ day: 2, periodStart: 9, periodEnd: 10, parity: 'even' }] },
  ],
  plans: [
    {
      id: 'four-day',
      label: '方案 A · 四日优先',
      summary: '优先压缩工作日占用，并明确标出单双周会议。',
      sectionIds: ['cs201-a', 'sta201-a', 'cle101-a', 'ee201-a'],
      rankingPrinciples: ['培养方案已确认课程优先', '减少上课日', '再比较完整教学团队'],
    },
    {
      id: 'no-early',
      label: '方案 B · 无早八',
      summary: '不使用第 1–2 节，并保留未确认学分的独立显示。',
      sectionIds: ['cs201-b', 'sta201-a', 'cle101-b', 'ee201-a', 'cs299-a'],
      rankingPrinciples: ['避开第 1–2 节', '不把未确认课程算作已确认覆盖', '再减少周五占用'],
    },
  ],
};
