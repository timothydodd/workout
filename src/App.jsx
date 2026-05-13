import { useEffect, useState, useRef } from 'react';
import { loadProgram } from './loadProgram';

/* ---------- Date utilities ---------- */
const STORE = 'workout-builder-state-v1';
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const todayISO = () => iso(new Date());
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; }
}

function isCompleted(dateISO, info, today) {
  return info.kind === 'workout' && dateISO < today;
}

function countCompletedWorkouts(state, program, today) {
  if (!VALID_DATE.test(state.startDate) || today <= state.startDate) return 0;
  let count = 0;
  let cursor = parseISO(state.startDate);
  const todayDate = parseISO(today);
  while (cursor < todayDate) {
    const d = iso(cursor);
    const info = dayInfo(d, state, program);
    if (info.kind === 'workout') count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function dayInfo(dateISO, state, program) {
  if (!program || program.length === 0) return { kind: 'before' };
  if (!VALID_DATE.test(state.startDate) || !VALID_DATE.test(dateISO)) return { kind: 'before' };
  if (dateISO < state.startDate) return { kind: 'before' };
  if (state.extraRests.includes(dateISO)) return { kind: 'extra-rest' };
  const offset = daysBetween(state.startDate, dateISO);
  const extraRestCount = state.extraRests.filter((d) => d >= state.startDate && d < dateISO).length;
  const skipCount = (state.skipped || []).filter((d) => d >= state.startDate && d <= dateISO).length;
  const idx = offset - extraRestCount + skipCount;
  if (!Number.isFinite(idx) || idx < 0 || idx >= program.length) return { kind: 'complete' };
  const entry = program[idx];
  return { kind: entry.t, programDay: idx + 1, entry };
}

/* ---------- Categories ---------- */
const CATS = {
  arm:  { label: 'Arms', color: '#cab3ff' },
  leg:  { label: 'Legs', color: '#ffcc80' },
  push: { label: 'Push', color: '#f4a5c4' },
  pull: { label: 'Pull', color: '#9fd4e0' },
  work: { label: 'Work', color: '#c4c6cc' },
};
function categoryOf(name = '') {
  if (/Upper|Bicep|Tricep|Arms/i.test(name)) return { key: 'arm',  ...CATS.arm };
  if (/Leg|Lower/i.test(name))               return { key: 'leg',  ...CATS.leg };
  if (/Chest|Delt|Push/i.test(name))         return { key: 'push', ...CATS.push };
  if (/Back|Trap|Pull/i.test(name))          return { key: 'pull', ...CATS.pull };
  return { key: 'work', ...CATS.work };
}

/* ====================================================================== */

export default function App() {
  const [state, setState] = useState(() => {
    const loaded = loadState();
    return { startDate: todayISO(), extraRests: [], skipped: [], ...(loaded || {}) };
  });
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [config, setConfig] = useState(null); // { name, subtitle, program, source, error? }
  const cardRef = useRef(null);

  useEffect(() => { loadProgram().then(setConfig); }, []);
  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(state)); }, [state]);

  if (!config) return <BootScreen />;

  const program = config.program;
  const TOTAL_WORKOUTS = program.filter((p) => p.t === 'workout').length;

  const update = (patch) => setState((s) => ({ ...s, ...patch }));
  const toggleSet = (key, value) => setState((s) => ({
    ...s,
    [key]: s[key].includes(value) ? s[key].filter((x) => x !== value) : [...s[key], value],
  }));

  const today = todayISO();
  const selectedInfo = dayInfo(selectedDate, state, program);
  let programDayNum = 0;
  if (VALID_DATE.test(state.startDate) && today >= state.startDate) {
    const offset = daysBetween(state.startDate, today);
    const skipped = state.extraRests.filter((d) => d >= state.startDate && d < today).length;
    const skipCount = (state.skipped || []).filter((d) => d >= state.startDate && d <= today).length;
    programDayNum = Math.min(program.length, offset - skipped + skipCount + 1);
  }
  const pct = program.length > 0 ? Math.min(100, Math.max(0, Math.round((programDayNum / program.length) * 100))) : 0;
  const completedCount = countCompletedWorkouts(state, program, today);

  function selectDay(d) {
    setSelectedDate(d);
    setCalendarOpen(false);
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const upcomingDays = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return iso(d);
  });

  return (
    <div className="min-h-screen text-fg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        <TopBar
          config={config}
          onSettings={() => setSettingsOpen(true)}
          pct={pct}
        />

        {config.source === 'fallback' && <ConfigErrorBanner error={config.error} />}

        <section ref={cardRef} className="scroll-mt-4" key={selectedDate}>
          <HeroCard
            dateISO={selectedDate}
            info={selectedInfo}
            state={state}
            program={program}
            isToday={selectedDate === today}
            onBackToToday={() => setSelectedDate(today)}
            onPostpone={() => toggleSet('extraRests', selectedDate)}
            onSkip={() => toggleSet('skipped', selectedDate)}
            upcomingDays={upcomingDays}
            selectedDate={selectedDate}
            today={today}
            onSelectDay={selectDay}
            onOpenCalendar={() => setCalendarOpen(true)}
          />
        </section>
      </div>

      <CalendarDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        viewMonth={viewMonth}
        setViewMonth={setViewMonth}
        state={state}
        program={program}
        today={today}
        selectedDate={selectedDate}
        onSelectDay={selectDay}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={state}
        completed={completedCount}
        totalWorkouts={TOTAL_WORKOUTS}
        config={config}
        onChangeStartDate={(d) => update({ startDate: d })}
        onReset={() => {
          if (confirm('Reset all progress?')) {
            const fresh = { startDate: todayISO(), extraRests: [], skipped: [] };
            setState(fresh);
            setSelectedDate(fresh.startDate);
          }
        }}
      />
    </div>
  );
}

function BootScreen() {
  return (
    <div className="min-h-screen grid place-items-center text-fg-muted">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm">Loading program…</span>
      </div>
    </div>
  );
}

function ConfigErrorBanner({ error }) {
  return (
    <div className="bg-error/10 border border-error/40 text-error rounded-md px-4 py-3 text-sm">
      <div className="font-medium">Failed to load <code className="font-mono">/program.yaml</code></div>
      <div className="text-fg-variant text-[13px] mt-1">{error}</div>
    </div>
  );
}

/* ====================================================================== */
/*  Top bar                                                               */
/* ====================================================================== */

function TopBar({ config, onSettings, pct }) {
  return (
    <header className="flex items-center gap-3 sm:gap-4 px-2 sm:px-3 py-2">
      <div className="w-8 h-8 rounded-full bg-primary/15 grid place-items-center shrink-0">
        <DumbbellIcon className="text-primary" />
      </div>
      <div className="min-w-0">
        <h1 className="text-[18px] sm:text-[20px] font-medium tracking-tight text-fg leading-tight truncate">
          {config.name}
        </h1>
        {config.subtitle && (
          <div className="text-[11px] text-fg-muted leading-tight truncate">{config.subtitle}</div>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-2 ml-3 flex-1 min-w-0">
        <div className="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden max-w-[280px]">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[12px] text-fg-muted font-mono tabular-nums shrink-0">
          {pct}%
        </span>
      </div>
      <div className="flex-1 sm:hidden" />
      <IconButton onClick={onSettings} aria-label="Settings">
        <SettingsIcon />
      </IconButton>
    </header>
  );
}

/* ====================================================================== */
/*  Hero (selected day) card — video front and center                     */
/* ====================================================================== */

function HeroCard({ dateISO, info, state, program, isToday, onBackToToday, onPostpone, onSkip, upcomingDays, selectedDate, today, onSelectDay, onOpenCalendar }) {
  const date = parseISO(dateISO);
  const dateLabel = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const isDone = isCompleted(dateISO, info, today);
  const isExtraRest = state.extraRests.includes(dateISO);
  const isSkipped = (state.skipped || []).includes(dateISO);
  const cat = info.kind === 'workout' ? categoryOf(info.entry.n) : null;
  const isPast = dateISO < today;
  const canActOnDay = !isPast && info.kind !== 'before' && info.kind !== 'complete';

  return (
    <article className="bg-surface-2 rounded-xl overflow-hidden fade-up">
      {/* Video first — front and center */}
      {info.kind === 'workout' && (
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${info.entry.v}`}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            title={`Day ${info.programDay}`}
          />
        </div>
      )}

      {/* Info */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* Title + chips + menu on one line */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
          {info.kind === 'workout' && (
            <h2 className="text-[22px] sm:text-[26px] font-medium text-fg leading-tight tracking-tight">
              {info.entry.n}
            </h2>
          )}
          {info.kind === 'rest' && (
            <h2 className="text-[22px] sm:text-[26px] font-medium text-fg leading-tight">Rest day</h2>
          )}
          {info.kind === 'extra-rest' && (
            <h2 className="text-[22px] sm:text-[26px] font-medium text-fg leading-tight">Extra rest day</h2>
          )}
          {info.kind === 'before' && (
            <h2 className="text-[22px] sm:text-[26px] font-medium text-fg leading-tight">Awaiting start</h2>
          )}
          {info.kind === 'complete' && (
            <h2 className="text-[22px] sm:text-[26px] font-medium text-fg leading-tight">Program complete</h2>
          )}

          {isToday ? (
            <Chip tone="primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-onContainer dot-pulse" />
              Today
            </Chip>
          ) : (
            <Chip tone="muted">{dateLabel}</Chip>
          )}
          {isToday && <Chip tone="muted">{dateLabel}</Chip>}
          {info.kind === 'workout' && (
            <Chip tone="muted">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
              <span>{cat.label}</span>
            </Chip>
          )}
          {info.kind === 'workout' && (
            <Chip tone="muted">Day {info.programDay} of {program.length}</Chip>
          )}
          {isDone && <Chip tone="success">Completed</Chip>}
          {isExtraRest && <Chip tone="warn">Extra rest</Chip>}

          <div className="ml-auto flex items-center gap-1">
            {!isToday && (
              <button
                onClick={onBackToToday}
                className="text-[13px] text-primary hover:text-primary-hover px-3 py-1 rounded-full state-layer"
              >
                ← Back to today
              </button>
            )}
            {canActOnDay && (
              <DayActionMenu
                isExtraRest={isExtraRest}
                isSkipped={isSkipped}
                kind={info.kind}
                onPostpone={onPostpone}
                onSkip={onSkip}
              />
            )}
          </div>
        </div>

        {info.kind === 'before' && (
          <p className="text-fg-variant text-sm">Program begins {state.startDate}.</p>
        )}
        {info.kind === 'complete' && (
          <p className="text-fg-variant text-sm">All {program.length} days done.</p>
        )}
        {info.kind === 'rest' && (
          <p className="text-fg-variant text-[14px]">A planned rest day in the program.</p>
        )}
        {info.kind === 'extra-rest' && (
          <p className="text-fg-variant text-[14px]">The remaining program shifts forward by one day.</p>
        )}

        {/* Up next */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
              Up next
            </span>
            <button
              onClick={onOpenCalendar}
              aria-label="Open calendar"
              title="Open full calendar"
              className="state-layer inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium text-fg-variant hover:text-fg bg-surface-1 border border-outline-variant transition-colors"
            >
              <CalendarIcon />
              <span>Calendar</span>
            </button>
          </div>
          <MiniDayStrip
            days={upcomingDays}
            state={state}
            program={program}
            today={today}
            selectedDate={selectedDate}
            onSelectDay={onSelectDay}
          />
        </div>
      </div>
    </article>
  );
}

function MiniDayStrip({ days, state, program, today, selectedDate, onSelectDay }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {days.map((d) => (
        <MiniDay
          key={d}
          date={d}
          state={state}
          program={program}
          today={today}
          isToday={d === today}
          isSelected={d === selectedDate}
          onSelect={() => onSelectDay(d)}
        />
      ))}
    </div>
  );
}

function MiniDay({ date, state, program, today, isToday, isSelected, onSelect }) {
  const info = dayInfo(date, state, program);
  const isDone = isCompleted(date, info, today);
  const cat = info.kind === 'workout' ? categoryOf(info.entry.n) : null;
  const isDisabled = info.kind === 'before' || info.kind === 'complete';
  const d = parseISO(date);
  const dow = d.toLocaleDateString(undefined, { weekday: 'short' });
  const dayNum = d.getDate();

  let label = '';
  let dotColor = null;
  if (info.kind === 'workout') { label = info.entry.n; dotColor = cat.color; }
  else if (info.kind === 'rest') label = 'Rest';
  else if (info.kind === 'extra-rest') label = 'Extra rest';
  else if (info.kind === 'before') label = '—';
  else if (info.kind === 'complete') label = 'Done';

  const classes = [
    'relative min-h-[120px] rounded-lg p-2.5 flex flex-col text-left border transition-colors',
  ];
  if (isDisabled) classes.push('bg-surface-1/50 text-fg-dim border-outline-variant cursor-default');
  else if (isToday) classes.push('bg-primary text-primary-on border-primary cursor-pointer');
  else if (isSelected) classes.push('bg-surface-3 ring-2 ring-primary ring-inset text-fg border-transparent cursor-pointer');
  else if (isDone) classes.push('bg-primary-container/40 text-primary-onContainer border-outline-variant hover:bg-primary-container/60 cursor-pointer');
  else classes.push('bg-surface-1 text-fg border-outline-variant hover:bg-surface-2 cursor-pointer');

  return (
    <button
      onClick={isDisabled ? undefined : onSelect}
      className={classes.join(' ')}
      title={`${dow} ${dayNum}: ${label}`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-[10px] uppercase tracking-wider font-medium leading-none ${isToday ? 'text-primary-on/80' : 'text-fg-muted'}`}>
          {isToday ? 'Today' : dow}
        </span>
        {isDone && !isToday && <span className="text-primary text-[11px] leading-none">✓</span>}
      </div>
      <span className="text-[24px] font-semibold tabular-nums leading-none mt-1">{dayNum}</span>
      <div className="mt-auto flex items-start gap-1.5 min-w-0">
        {dotColor && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: isToday ? '#062e6f' : dotColor }} />
        )}
        <span
          className={`text-[11px] font-medium leading-tight break-words line-clamp-2 ${isToday ? 'text-primary-on' : info.kind === 'rest' || info.kind === 'extra-rest' ? 'text-fg-muted' : 'text-fg'}`}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

/* ====================================================================== */
/*  Calendar                                                              */
/* ====================================================================== */

function CalendarDialog({ open, onClose, viewMonth, setViewMonth, state, program, today, selectedDate, onSelectDay }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { y, m } = viewMonth;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const goPrev = () => setViewMonth((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const goNext = () => setViewMonth((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });
  const goNow  = () => { const d = new Date(); setViewMonth({ y: d.getFullYear(), m: d.getMonth() }); };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] sm:text-[20px] font-medium tracking-tight">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <IconButton onClick={goPrev} aria-label="Previous month"><ChevronLeft /></IconButton>
            <button
              onClick={goNow}
              className="px-4 h-9 rounded-full text-[13px] font-medium text-primary hover:bg-primary/10 state-layer"
            >
              Today
            </button>
            <IconButton onClick={goNext} aria-label="Next month"><ChevronRight /></IconButton>
            <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-medium uppercase tracking-wider text-fg-muted py-1.5">
              {d}
            </div>
          ))}
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - startDow + 1;
            if (dayNum < 1 || dayNum > daysInMonth) return <div key={`e${i}`} />;
            const date = iso(new Date(y, m, dayNum));
            return (
              <DayCell
                key={date}
                date={date}
                dayNum={dayNum}
                state={state}
                program={program}
                today={today}
                isToday={date === today}
                isPast={date < today}
                isSelected={date === selectedDate}
                onSelect={() => onSelectDay(date)}
              />
            );
          })}
        </div>

        <Legend />
      </div>
    </div>
  );
}

function DayCell({ date, dayNum, state, program, today, isToday, isPast, isSelected, onSelect }) {
  const info = dayInfo(date, state, program);
  const isDone = isCompleted(date, info, today);
  const cat = info.kind === 'workout' ? categoryOf(info.entry.n) : null;
  const isDisabled = info.kind === 'before' || info.kind === 'complete';
  // Dim past days unless they're completed (those stay legible as a record of work done)
  const dimPast = isPast && !isToday && !isDone;

  const layers = [
    'relative min-h-[78px] sm:min-h-[88px] rounded-md p-2 flex flex-col cursor-pointer transition-colors text-left border border-outline-variant',
  ];

  if (isDisabled) {
    layers.push('bg-surface-1/50 text-fg-dim cursor-default');
  } else if (isToday) {
    layers.push('bg-primary text-primary-on today-ring shadow-lg shadow-primary/20');
  } else if (isSelected) {
    layers.push('bg-surface-3 ring-2 ring-primary ring-inset text-fg');
  } else if (isDone) {
    layers.push('bg-primary-container/40 text-primary-onContainer hover:bg-primary-container/60');
  } else if (info.kind === 'extra-rest') {
    layers.push(dimPast ? 'bg-warn/5 text-warn/50 hover:bg-warn/10' : 'bg-warn/10 text-warn hover:bg-warn/15');
  } else if (info.kind === 'rest') {
    layers.push(dimPast ? 'bg-surface-1/60 text-fg-dim hover:bg-surface-2' : 'bg-surface-2 text-fg-muted hover:bg-surface-3');
  } else {
    layers.push(dimPast ? 'bg-surface-1/60 text-fg-muted hover:bg-surface-2' : 'bg-surface-2 text-fg hover:bg-surface-3');
  }
  if (dimPast) layers.push('opacity-50 hover:opacity-80');

  // Workout label content
  let labelTop = null;
  let labelMain = null;
  if (info.kind === 'workout') {
    labelTop = (
      <span className={`text-[10px] font-medium uppercase tracking-wider ${isToday ? 'text-primary-on/80' : 'text-fg-muted'}`}>
        Day {info.programDay}
      </span>
    );
    labelMain = (
      <div className="flex items-center gap-1.5 mt-auto">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: isToday ? '#062e6f' : cat.color }}
        />
        <span className={`text-[11px] font-medium leading-tight truncate ${isToday ? 'text-primary-on' : 'text-fg'}`}>
          {info.entry.n}
        </span>
      </div>
    );
  } else if (info.kind === 'rest') {
    labelTop = (
      <span className={`text-[10px] font-medium uppercase tracking-wider ${isToday ? 'text-primary-on/80' : 'text-fg-muted'}`}>
        Day {info.programDay}
      </span>
    );
    labelMain = (
      <span className={`text-[11px] font-medium mt-auto ${isToday ? 'text-primary-on' : 'text-fg-muted'}`}>
        Rest
      </span>
    );
  } else if (info.kind === 'extra-rest') {
    labelMain = (
      <span className="text-[11px] font-medium mt-auto text-warn">
        Extra rest
      </span>
    );
  }

  return (
    <button
      onClick={isDisabled ? undefined : onSelect}
      className={layers.join(' ')}
      title={info.kind === 'workout' ? `Day ${info.programDay}: ${info.entry.n}` : undefined}
    >
      <div className="flex items-start justify-between w-full">
        <span className="text-[15px] font-semibold tabular-nums leading-none">{dayNum}</span>
        {isDone && !isToday && (
          <span className="text-primary text-[11px] leading-none">✓</span>
        )}
        {isToday && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary-on/80 leading-none mt-0.5">Now</span>
        )}
      </div>
      {labelTop && <div className="mt-0.5">{labelTop}</div>}
      {labelMain}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-3 border-t border-outline-variant text-[11px] text-fg-muted">
      {Object.entries(CATS).filter(([k]) => k !== 'work').map(([k, c]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
          {c.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-fg-dim" /> Rest
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-warn" /> Extra rest
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-md bg-primary" /> Today
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-md bg-primary-container/40" /> Completed
      </span>
    </div>
  );
}

/* ====================================================================== */
/*  Buttons & chips                                                       */
/* ====================================================================== */

function FilledButton({ onClick, children, icon }) {
  return (
    <button
      onClick={onClick}
      className="state-layer inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-on text-[14px] font-medium transition-colors hover:bg-primary-hover"
    >
      {icon}
      {children}
    </button>
  );
}

function TonalButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="state-layer inline-flex items-center gap-2 h-10 px-5 rounded-full bg-surface-4 text-fg text-[14px] font-medium transition-colors hover:bg-surface-5"
    >
      {children}
    </button>
  );
}

function IconButton({ onClick, children, ...rest }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className="state-layer w-10 h-10 rounded-full grid place-items-center text-fg-variant hover:text-fg transition-colors"
    >
      {children}
    </button>
  );
}

function DayActionMenu({ isExtraRest, isSkipped, kind, onPostpone, onSkip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = (fn) => { fn(); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Day options"
        className="state-layer w-9 h-9 rounded-full grid place-items-center text-fg-variant hover:text-fg transition-colors"
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[200px] bg-surface-3 rounded-md py-1.5 shadow-2xl shadow-black/40 border border-outline-variant">
          {isExtraRest ? (
            <MenuItem onClick={() => select(onPostpone)}>Remove postpone</MenuItem>
          ) : (
            kind !== 'extra-rest' && (
              <MenuItem onClick={() => select(onPostpone)}>
                Postpone to tomorrow
              </MenuItem>
            )
          )}
          {kind !== 'extra-rest' && (
            isSkipped ? (
              <MenuItem onClick={() => select(onSkip)}>Undo skip</MenuItem>
            ) : (
              <MenuItem onClick={() => select(onSkip)}>Skip to next workout</MenuItem>
            )
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-[14px] text-fg hover:bg-surface-4 state-layer"
    >
      {children}
    </button>
  );
}

function Chip({ tone = 'muted', children }) {
  const tones = {
    muted:   'bg-surface-3 text-fg-variant',
    primary: 'bg-primary-container/60 text-primary-onContainer',
    success: 'bg-primary-container/40 text-primary-onContainer',
    warn:    'bg-warn/15 text-warn',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ====================================================================== */
/*  Settings dialog                                                       */
/* ====================================================================== */

function SettingsDialog({ open, onClose, state, completed, totalWorkouts, config, onChangeStartDate, onReset }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-3 rounded-xl max-w-md w-full overflow-hidden shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h3 className="text-[20px] font-medium tracking-tight">Settings</h3>
          <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
        </div>

        <div className="px-6 pb-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-[12px] font-medium uppercase tracking-wider text-fg-muted">
              Start date
            </label>
            <input
              type="date"
              value={state.startDate}
              onChange={(e) => { if (VALID_DATE.test(e.target.value)) onChangeStartDate(e.target.value); }}
              className="w-full bg-surface-1 border border-outline-variant rounded-xs px-3 py-2.5 text-fg font-mono text-[14px] focus:border-primary focus:outline-none transition-colors"
            />
            <p className="text-[12px] text-fg-muted">
              Shifts the entire 60-day program to begin on this date.
            </p>
          </div>

          <div className="space-y-2.5">
            <label className="block text-[12px] font-medium uppercase tracking-wider text-fg-muted">
              Progress
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Done" value={completed} primary />
              <Stat label="Extra" value={state.extraRests.length} />
              <Stat label="Total" value={totalWorkouts} />
            </div>
            <button
              onClick={onReset}
              className="state-layer mt-3 inline-flex items-center gap-2 h-10 px-5 rounded-full border border-error/40 text-error text-[14px] font-medium hover:bg-error/10 transition-colors"
            >
              Reset progress
            </button>
          </div>

          <div className="pt-4 border-t border-outline-variant space-y-2">
            <label className="block text-[12px] font-medium uppercase tracking-wider text-fg-muted">
              Program
            </label>
            <div className="text-[12px] text-fg-variant space-y-0.5">
              <div><span className="text-fg-muted">Name:</span> {config.name}</div>
              <div>
                <span className="text-fg-muted">Source:</span>{' '}
                <code className="font-mono text-[11px]">
                  {config.source === 'yaml' ? '/program.yaml' : 'fallback (yaml failed)'}
                </code>
              </div>
              {config.error && (
                <div className="text-error mt-1 text-[11px] font-mono break-all">{config.error}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, primary }) {
  return (
    <div className="bg-surface-1 rounded-sm px-3 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={`text-[24px] font-medium leading-tight mt-1 tabular-nums ${primary ? 'text-primary' : 'text-fg'}`}>
        {value}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  Icons                                                                 */
/* ====================================================================== */

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function ChevronLeft()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>; }
function ChevronRight() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>; }
function CloseIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function CheckIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function CalendarIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function MoreIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>; }
function DumbbellIcon({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M2 8v8M10 6v12M14 6v12M18 4v16M22 8v8M10 12h4" />
    </svg>
  );
}
