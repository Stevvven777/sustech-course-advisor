'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';
import Timetables from 'timetables';

import { timetableData } from '@/lib/sample-data';
import { buildColorRegistry, buildGrid, courseCodeFromCellLabel, planMetrics, resolvePlan, validateTimetableData, type Parity } from '@/lib/timetable-data';

const dataErrors = validateTimetableData(timetableData);
if (dataErrors.length) throw new Error(`Invalid timetable data: ${dataErrors.join(' ')}`);
const initialPlan = requireInitialPlan();

export function TimetableApp() {
  const [planId, setPlanId] = useState(initialPlan.id);
  const [parity, setParity] = useState<Parity>('all');
  const plan = timetableData.plans.find((item) => item.id === planId) ?? initialPlan;
  const sections = useMemo(() => resolvePlan(timetableData, plan), [plan]);
  const metrics = useMemo(() => planMetrics(sections), [sections]);
  const grid = useMemo(() => buildGrid(timetableData, sections, parity), [sections, parity]);
  const colors = useMemo(() => buildColorRegistry(timetableData), []);
  const instanceRef = useRef<Timetables | null>(null);

  useEffect(() => {
    const target = document.querySelector('#coursesTable');
    if (!target) return;
    const options = {
      timetables: grid.map((day) => [...day]),
      week: timetableData.weekdays,
      timetableType: Array.from({ length: timetableData.periodCount }, (_, index) => [{ index: `${index + 1}`, name: '节' }, 1] as [{ index: string; name: string }, number]),
      merge: true,
      styles: { leftHandWidth: 50, Gheight: 66, palette: false },
    };
    if (!instanceRef.current) instanceRef.current = new Timetables({ el: '#coursesTable', ...options });
    else instanceRef.current.setOption(options);

    target.querySelectorAll<HTMLElement>('.course-hasContent').forEach((cell) => {
      const blocks = cell.innerText.split(/\n\/\n/).filter(Boolean);
      const decorate = (element: HTMLElement, text: string) => {
        const code = courseCodeFromCellLabel(text);
        element.style.backgroundColor = code ? colors[code] : '#315b56';
        element.style.color = '#fff';
      };
      if (blocks.length === 1) decorate(cell, blocks[0]);
      else {
        cell.classList.add('course-split-content');
        cell.style.backgroundColor = 'transparent';
        cell.replaceChildren(...blocks.map((block) => {
          const part = document.createElement('span');
          part.className = 'course-split-block';
          part.innerText = block;
          decorate(part, block);
          return part;
        }));
      }
    });
  }, [colors, grid]);

  return (
    <main className="page-shell">
      <section className="timetable-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">{timetableData.semester}</p>
            <h1>{timetableData.title}</h1>
            <p className="plan-summary">{plan.summary}</p>
          </div>
          <nav className="plan-switcher" aria-label="课表方案">
            {timetableData.plans.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === plan.id} onClick={() => setPlanId(item.id)}>{item.label}</button>
            ))}
          </nav>
        </header>

        <div className="scorecard" aria-label="方案摘要">
          <Metric icon={<CheckCircle2 />} label="已确认学分" value={metrics.confirmedCredits} />
          <Metric icon={<AlertCircle />} label="未确认学分" value={metrics.unresolvedCredits} />
          <Metric icon={<CalendarDays />} label="上课日" value={metrics.daysUsed} />
          <Metric icon={<Clock3 />} label="早八" value={metrics.hasEarlyPeriods ? '有' : '无'} />
          <Metric icon={metrics.conflicts.length ? <AlertCircle /> : <CheckCircle2 />} label="冲突" value={metrics.conflicts.length} />
        </div>

        <div className="controls-row">
          <ol className="principles">
            {plan.rankingPrinciples.map((principle, index) => <li key={principle}><span>{String(index + 1).padStart(2, '0')}</span>{principle}</li>)}
          </ol>
          <div className="parity-switcher" aria-label="周次视图">
            {([['all', '全周'], ['odd', '单周'], ['even', '双周']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={parity === value} onClick={() => setParity(value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="timetable-shell">
          <div id="coursesTable" aria-label={`${plan.label}课程表`} />
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="metric"><span className="metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong></div>;
}

function requireInitialPlan() {
  const plan = timetableData.plans.at(0);
  if (!plan) throw new Error('Invalid timetable data: at least one plan is required.');
  return plan;
}
