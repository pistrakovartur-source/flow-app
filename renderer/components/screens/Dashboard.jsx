/* Dashboard.jsx — главный экран: задачи, расписание, напоминания */

const TAG_LIST  = ['Работа', 'Проект', 'Здоровье', 'Личное', 'Учёба', 'Финансы'];
const ICON_LIST = ['bell', 'coffee', 'book', 'calendar', 'heart', 'run', 'spark', 'clock'];

function Dashboard({ assistant }) {
  const [profile]   = useStore('profile',   {});
  const [tasks,    setTasks]    = useStore('tasks',    []);
  const [reminders, setReminders] = useStore('reminders', []);
  const [schedule,  setSchedule]  = useStore('schedule',  []);

  // ── Текущее время ──
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const name     = profile?.name ? `, ${profile.name}` : '';
  const dateStr  = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr  = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const left     = (tasks || []).filter(t => !t.done).length;

  return (
    <div className="page">

      {/* ── Заголовок ── */}
      <div className="page-head row" style={{ alignItems: 'flex-end', gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div className="page-kicker">{dateStr} · {timeStr}</div>
          <div className="page-title">{greeting}{name}</div>
          <div className="page-sub">
            {left > 0 ? `${left} ${plural(left, 'задача', 'задачи', 'задач')} впереди. ${assistant} готов помочь.` : `Все задачи выполнены. Отличный день!`}
          </div>
        </div>
        <button className="btn btn-primary">
          <Icon name="mic" size={17} /> Спросить {assistant}
        </button>
      </div>

      {/* ── Сводка дня ── */}
      <DailySummary assistant={assistant} tasks={tasks || []} />

      {/* ── Сетка ── */}
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <TasksCard tasks={tasks || []} setTasks={setTasks} />
        <div className="col gap-l">
          <RemindersCard reminders={reminders || []} setReminders={setReminders} />
          <ScheduleCard  schedule={schedule   || []} setSchedule={setSchedule}   />
        </div>
      </div>
    </div>
  );
}

/* ─── Сводка дня ─── */
function DailySummary({ assistant, tasks }) {
  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const text  = total === 0
    ? `Добавь задачи на сегодня — и я помогу всё распланировать.`
    : done === total
    ? `Все ${total} задач выполнены. Ты справился отлично!`
    : `Выполнено ${done} из ${total}. Продолжай в том же темпе.`;

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 18, background: 'linear-gradient(120deg, color-mix(in oklch, var(--accent) 14%, var(--surface-1-solid)), var(--surface-1-solid))' }}>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="col" style={{ flex: 1, padding: 24, gap: 14, justifyContent: 'center' }}>
          <div className="pill accent" style={{ alignSelf: 'flex-start' }}>
            <Icon name="spark" size={13} /> Сводка дня
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, lineHeight: 1.45, maxWidth: 480 }}>
            «{text}»
          </div>
          <div className="row gap-s" style={{ marginTop: 4 }}>
            <button className="btn btn-ghost"><Icon name="waveform" size={16} /> Прослушать</button>
            <button className="btn btn-ghost"><Icon name="chevron"  size={15} /> Подробнее</button>
          </div>
        </div>
        <div style={{ width: 220, display: 'grid', placeItems: 'center', padding: 18 }}>
          <Orb size={140} state={tasks.length > 0 ? 'idle' : 'idle'} wave />
        </div>
      </div>
    </div>
  );
}

/* ─── Задачи ─── */
function TasksCard({ tasks, setTasks }) {
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm]         = React.useState({ text: '', time: '', tag: 'Личное' });
  const left = tasks.filter(t => !t.done).length;

  const toggle = id => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = id => setTasks(ts => ts.filter(t => t.id !== id));

  const add = () => {
    if (!form.text.trim()) return;
    setTasks(ts => [...ts, { id: uid(), text: form.text.trim(), time: form.time || '--:--', tag: form.tag, done: false }]);
    setForm({ text: '', time: '', tag: 'Личное' });
    setShowForm(false);
  };

  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="check" size={18} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Задачи на сегодня</span>
        <span className="cm">{left > 0 ? `${left} осталось` : tasks.length > 0 ? 'Всё готово!' : ''}</span>
      </div>

      {/* Пустое состояние */}
      {tasks.length === 0 && !showForm && (
        <EmptyState icon="check" text="Нет задач на сегодня" sub="Добавь первую задачу" />
      )}

      <div className="col" style={{ gap: 8 }}>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onDelete={() => remove(task.id)} />
        ))}

        {/* Форма добавления */}
        {showForm ? (
          <div className="col" style={{ gap: 10, marginTop: 8, padding: '14px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line-accent)' }}>
            <input
              autoFocus
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setShowForm(false); }}
              placeholder="Название задачи…"
              style={inputStyle}
            />
            <div className="row gap-s">
              <input
                type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={{ ...inputStyle, width: 120 }}
              />
              <select value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                {TAG_LIST.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="row gap-s">
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={add}>Добавить</button>
              <button className="btn btn-ghost"   onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginTop: tasks.length ? 4 : 0 }} onClick={() => setShowForm(true)}>
            <Icon name="plus" size={16} /> Добавить задачу
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Строка задачи ─── */
function TaskRow({ task, onToggle, onDelete }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      className="row gap-m"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: '11px 12px', borderRadius: 12, background: task.done ? 'transparent' : 'var(--surface-2)', border: '1px solid var(--line)', transition: 'all .15s', opacity: task.done ? 0.55 : 1 }}
    >
      <div
        onClick={onToggle}
        style={{ width: 22, height: 22, borderRadius: 7, flex: '0 0 22px', display: 'grid', placeItems: 'center', cursor: 'pointer', border: task.done ? 'none' : '1.6px solid var(--line-strong)', background: task.done ? 'var(--accent)' : 'transparent' }}
      >
        {task.done && <Icon name="check" size={14} style={{ color: '#fff' }} />}
      </div>
      <div onClick={onToggle} style={{ flex: 1, fontWeight: 600, fontSize: 14.5, cursor: 'pointer', textDecoration: task.done ? 'line-through' : 'none' }}>
        {task.text}
      </div>
      <span className="pill">{task.tag}</span>
      <span className="mono dim" style={{ fontSize: 12, width: 42, textAlign: 'right' }}>{task.time}</span>
      {hover && (
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute)', padding: '2px 4px', borderRadius: 6, display: 'grid', placeItems: 'center' }}>
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}

/* ─── Напоминания ─── */
function RemindersCard({ reminders, setReminders }) {
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm]         = React.useState({ title: '', sub: '', icon: 'bell' });

  const add = () => {
    if (!form.title.trim()) return;
    setReminders(rs => [...rs, { id: uid(), title: form.title.trim(), sub: form.sub.trim(), icon: form.icon }]);
    setForm({ title: '', sub: '', icon: 'bell' });
    setShowForm(false);
  };

  const remove = id => setReminders(rs => rs.filter(r => r.id !== id));

  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="bell" size={17} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Напоминания</span>
        {reminders.length > 0 && <span className="cm">{reminders.length}</span>}
      </div>

      {reminders.length === 0 && !showForm && <EmptyState icon="bell" text="Нет напоминаний" sub="Добавь первое" small />}

      <div className="col" style={{ gap: 10 }}>
        {reminders.map(r => (
          <div key={r.id} className="row gap-m" style={{ alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, flex: '0 0 34px', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--accent-soft)' }}>
              <Icon name={r.icon} size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</div>
              {r.sub && <div className="mute" style={{ fontSize: 12, marginTop: 1 }}>{r.sub}</div>}
            </div>
            <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute)', display: 'grid', placeItems: 'center' }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="col" style={{ gap: 8, marginTop: 12, padding: '12px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line-accent)' }}>
          <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Напоминание…" style={inputStyle} />
          <input value={form.sub} onChange={e => setForm(f => ({ ...f, sub: e.target.value }))} placeholder="Подсказка (необязательно)" style={inputStyle} />
          <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
            {ICON_LIST.map(ic => (
              <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid', cursor: 'pointer', display: 'grid', placeItems: 'center', borderColor: form.icon === ic ? 'var(--line-accent)' : 'var(--line)', background: form.icon === ic ? 'color-mix(in oklch, var(--accent) 18%, transparent)' : 'var(--surface-3)', color: form.icon === ic ? 'var(--accent-soft)' : 'var(--text-mute)' }}>
                <Icon name={ic} size={14} />
              </button>
            ))}
          </div>
          <div className="row gap-s">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={add}>Добавить</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginTop: reminders.length ? 10 : 0, fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Icon name="plus" size={14} /> Добавить
        </button>
      )}
    </div>
  );
}

/* ─── Расписание ─── */
function ScheduleCard({ schedule, setSchedule }) {
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm]         = React.useState({ time: '', title: '', dur: '', accent: false });

  const add = () => {
    if (!form.time || !form.title.trim()) return;
    const sorted = [...schedule, { id: uid(), time: form.time, title: form.title.trim(), dur: form.dur, accent: form.accent }]
      .sort((a, b) => a.time.localeCompare(b.time));
    setSchedule(sorted);
    setForm({ time: '', title: '', dur: '', accent: false });
    setShowForm(false);
  };

  const remove = id => setSchedule(s => s.filter(x => x.id !== id));

  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="calendar" size={17} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Расписание</span>
        {schedule.length > 0 && <span className="cm">{schedule.length} событий</span>}
      </div>

      {schedule.length === 0 && !showForm && <EmptyState icon="calendar" text="Расписание пусто" sub="Добавь событие" small />}

      <div className="col" style={{ gap: 2 }}>
        {schedule.map(s => (
          <div key={s.id} className="row gap-m" style={{ padding: '7px 0', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 12, width: 42, color: s.accent ? 'var(--accent-soft)' : 'var(--text-mute)', flexShrink: 0 }}>{s.time}</span>
            <div style={{ width: 8, height: 8, borderRadius: 99, flex: '0 0 8px', background: s.accent ? 'var(--accent)' : 'var(--surface-3)', boxShadow: s.accent ? '0 0 10px var(--accent-glow)' : 'none' }} />
            <div style={{ flex: 1, fontWeight: 500, fontSize: 13.5 }}>{s.title}</div>
            {s.dur && <span className="mute mono" style={{ fontSize: 11 }}>{s.dur}</span>}
            <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute)', display: 'grid', placeItems: 'center', opacity: 0.6 }}>
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="col" style={{ gap: 8, marginTop: 10, padding: '12px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line-accent)' }}>
          <div className="row gap-s">
            <input type="time" autoFocus value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Название…" style={{ ...inputStyle, flex: 1 }} />
          </div>
          <input value={form.dur} onChange={e => setForm(f => ({ ...f, dur: e.target.value }))} placeholder="Длительность (например: 30 мин)" style={inputStyle} />
          <div className="row gap-s" style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-mute)' }}>
              <input type="checkbox" checked={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.checked }))} />
              Выделить акцентом
            </label>
          </div>
          <div className="row gap-s">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={add}>Добавить</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginTop: schedule.length ? 10 : 0, fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Icon name="plus" size={14} /> Добавить событие
        </button>
      )}
    </div>
  );
}

/* ─── Пустое состояние ─── */
function EmptyState({ icon, text, sub, small }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: small ? '16px 8px' : '28px 8px', color: 'var(--text-mute)' }}>
      <Icon name={icon} size={small ? 22 : 30} style={{ opacity: 0.3 }} />
      <div style={{ fontWeight: 600, fontSize: small ? 13 : 14 }}>{text}</div>
      {sub && <div style={{ fontSize: small ? 11.5 : 12.5, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

/* ─── Стиль полей ввода ─── */
const inputStyle = {
  width: '100%', padding: '9px 12px',
  background: 'var(--surface-1)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)',
  fontFamily: 'var(--font-body)', fontSize: 13.5, outline: 'none',
};

/* ─── Склонение чисел ─── */
function plural(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${few}`;
  return `${n} ${many}`;
}

window.Dashboard = Dashboard;
