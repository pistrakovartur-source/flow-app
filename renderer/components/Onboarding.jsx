/* Onboarding.jsx — настройка профиля при первом запуске */

const INTERESTS_ALL = [
  'Дизайн', 'Программирование', 'Музыка', 'Кино', 'Книги', 'Спорт',
  'Путешествия', 'Кулинария', 'Фотография', 'Игры', 'Наука', 'Бизнес',
  'Психология', 'Иностранные языки', 'Искусство', 'Технологии', 'Финансы',
  'Здоровье', 'Медитация', 'Архитектура', 'Электроника', 'Космос', 'Аниме', 'Подкасты',
];

function Onboarding({ assistant, onComplete }) {
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState({
    name:      '',
    email:     '',
    city:      '',
    workStart: '09:00',
    workEnd:   '18:00',
    dnd:       '22:30',
    timezone:  'UTC+3',
    interests: [],
    toneStyle: 60,
  });

  const upd = (k, v) => setData(d => ({ ...d, [k]: v }));
  const next = () => setStep(s => s + 1);

  const finish = (skipAll = false) => {
    const profile = skipAll ? { name: '', email: '', city: '', interests: [], toneStyle: 60, workStart: '09:00', workEnd: '18:00', dnd: '22:30', timezone: 'UTC+3' } : data;
    Store.set('profile',         profile);
    Store.set('onboarding_done', true);
    // Инициализируем пустые коллекции если их нет
    if (!Store.get('tasks'))        Store.set('tasks',        []);
    if (!Store.get('habits'))       Store.set('habits',       []);
    if (!Store.get('reminders'))    Store.set('reminders',    []);
    if (!Store.get('schedule'))     Store.set('schedule',     []);
    if (!Store.get('memory_facts')) Store.set('memory_facts', []);
    if (!Store.get('sessions'))     Store.set('sessions',     []);
    if (!Store.get('settings'))     Store.set('settings',     { proactive: true, voiceWake: false, localOnly: true, learn: true });
    if (!Store.get('integrations')) Store.set('integrations', { calendar: false, mail: false, music: false, home: false, notes: false, maps: false });
    onComplete();
  };

  const TOTAL_STEPS = 4; // шаги 1–4 (Step0 = приветствие)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'radial-gradient(140% 120% at 20% -10%, #141b2e 0%, #0a0e18 50%, #070a12 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Индикатор шагов */}
      {step > 0 && (
        <div style={{ position: 'absolute', top: 44, display: 'flex', gap: 8 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 99,
              width: i + 1 === step ? 32 : i + 1 < step ? 10 : 10,
              background: i + 1 <= step ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
            }} />
          ))}
        </div>
      )}

      {/* Шаги */}
      {step === 0 && <StepWelcome  assistant={assistant} onStart={next}                     onSkip={() => finish(true)} />}
      {step === 1 && <StepProfile  data={data} upd={upd} onNext={next}                     onSkip={next} />}
      {step === 2 && <StepSchedule data={data} upd={upd} onNext={next}                     onSkip={next} />}
      {step === 3 && <StepInterests data={data} upd={upd} onNext={next}                    onSkip={next} />}
      {step === 4 && <StepStyle    data={data} upd={upd} onFinish={() => finish(false)}    onSkip={() => finish(false)} />}
    </div>
  );
}

/* ═══ Шаг 0 — Приветствие ═══ */
function StepWelcome({ assistant, onStart, onSkip }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, animation: 'pageIn .5s ease' }}>
      <Orb size={200} state="idle" wave />
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--accent-soft)', marginBottom: 16 }}>
          Добро пожаловать
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>
          Привет, я {assistant}
        </div>
        <div style={{ color: 'var(--text-mute)', fontSize: 16, lineHeight: 1.65, maxWidth: 440 }}>
          Твой личный AI‑ассистент. Давай за пару минут настроим профиль, чтобы я помогал точнее.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '13px 40px', borderRadius: 16 }} onClick={onStart}>
          <Icon name="spark" size={17} /> Начать настройку
        </button>
        <button onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', fontSize: 13.5, fontFamily: 'var(--font-body)' }}>
          Пропустить
        </button>
      </div>
    </div>
  );
}

/* ═══ Шаг 1 — Личные данные ═══ */
function StepProfile({ data, upd, onNext, onSkip }) {
  return (
    <OStep title="Расскажи о себе" sub="Как тебя зовут? Буду обращаться к тебе по имени." onNext={onNext} onSkip={onSkip} nextDisabled={!data.name.trim()}>
      <OField label="Имя *" placeholder="Алексей" value={data.name} onChange={v => upd('name', v)} autoFocus />
      <OField label="Email" placeholder="you@mail.ru" value={data.email} onChange={v => upd('email', v)} />
      <OField label="Город" placeholder="Москва" value={data.city} onChange={v => upd('city', v)} />
    </OStep>
  );
}

/* ═══ Шаг 2 — Расписание ═══ */
function StepSchedule({ data, upd, onNext, onSkip }) {
  return (
    <OStep title="Твой режим" sub="Учту расписание и не буду беспокоить в нерабочее время." onNext={onNext} onSkip={onSkip}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <OField label="Начало работы" type="time" value={data.workStart} onChange={v => upd('workStart', v)} />
        <OField label="Конец работы"  type="time" value={data.workEnd}   onChange={v => upd('workEnd',   v)} />
      </div>
      <OField label="Не беспокоить после" type="time" value={data.dnd} onChange={v => upd('dnd', v)} />
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 8 }}>Часовой пояс</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['UTC+2', 'UTC+3', 'UTC+4', 'UTC+5', 'UTC+7', 'UTC+8'].map(tz => (
            <button key={tz} onClick={() => upd('timezone', tz)} style={{
              padding: '7px 14px', borderRadius: 10, border: '1px solid', cursor: 'pointer',
              borderColor: data.timezone === tz ? 'var(--line-accent)' : 'var(--line)',
              background: data.timezone === tz ? 'color-mix(in oklch, var(--accent) 16%, transparent)' : 'var(--surface-2)',
              color: data.timezone === tz ? 'var(--accent-soft)' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)', fontSize: 12,
            }}>{tz}</button>
          ))}
        </div>
      </div>
    </OStep>
  );
}

/* ═══ Шаг 3 — Интересы ═══ */
function StepInterests({ data, upd, onNext, onSkip }) {
  const toggle = it => {
    const list = data.interests.includes(it)
      ? data.interests.filter(x => x !== it)
      : [...data.interests, it];
    upd('interests', list);
  };
  return (
    <OStep title="Твои интересы" sub="Выбери темы — буду делать более точные подсказки." onNext={onNext} onSkip={onSkip}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
        {INTERESTS_ALL.map(it => {
          const active = data.interests.includes(it);
          return (
            <button key={it} onClick={() => toggle(it)} style={{
              padding: '9px 16px', borderRadius: 99, border: '1px solid', cursor: 'pointer', transition: 'all .15s',
              borderColor: active ? 'var(--line-accent)' : 'var(--line)',
              background: active ? 'color-mix(in oklch, var(--accent) 18%, transparent)' : 'var(--surface-2)',
              color: active ? 'var(--accent-soft)' : 'var(--text-dim)',
              fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 500,
            }}>{it}</button>
          );
        })}
      </div>
      {data.interests.length > 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-soft)' }}>
          ✓ Выбрано: {data.interests.length}
        </div>
      )}
    </OStep>
  );
}

/* ═══ Шаг 4 — Стиль общения ═══ */
function StepStyle({ data, upd, onFinish, onSkip }) {
  const label = data.toneStyle < 33 ? 'Формальный' : data.toneStyle < 66 ? 'Дружелюбный' : 'Тёплый';
  const preview = data.toneStyle < 33
    ? `Здравствуйте${data.name ? ', ' + data.name : ''}. Готов к работе.`
    : data.toneStyle < 66
    ? `Привет${data.name ? ', ' + data.name : ''}! Чем могу помочь?`
    : `Привет${data.name ? ', ' + data.name : ''}! 😊 Рад тебя видеть, как дела?`;

  return (
    <OStep title="Стиль общения" sub="Как ты предпочитаешь, чтобы я с тобой общался?" onNext={onFinish} onSkip={onSkip} nextLabel="Готово →" isLast>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: 'var(--text-mute)', fontSize: 13 }}>Тон</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-soft)' }}>{label}</span>
        </div>
        <input type="range" min="0" max="100" value={data.toneStyle} onChange={e => upd('toneStyle', +e.target.value)} style={{ accentColor: 'var(--accent)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mute)' }}>
          <span>Деловой</span><span>Тёплый</span>
        </div>
      </div>

      {/* Превью */}
      <div style={{ padding: '16px 18px', borderRadius: 14, background: 'color-mix(in oklch, var(--accent) 10%, transparent)', border: '1px solid var(--line-accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Orb size={32} state="idle" wave={false} />
          <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.5 }}>{preview}</div>
        </div>
      </div>
    </OStep>
  );
}

/* ═══ Обёртка шага ═══ */
function OStep({ title, sub, children, onNext, onSkip, nextDisabled, nextLabel = 'Далее →', isLast }) {
  return (
    <div style={{ width: 520, display: 'flex', flexDirection: 'column', gap: 22, animation: 'pageIn .35s ease' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <div style={{ color: 'var(--text-mute)', fontSize: 15, lineHeight: 1.55 }}>{sub}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', fontSize: 13.5, fontFamily: 'var(--font-body)' }}>
          Пропустить шаг
        </button>
        <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled} style={{ fontSize: 14, padding: '11px 30px', opacity: nextDisabled ? 0.45 : 1 }}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

/* ═══ Поле ввода ═══ */
function OField({ label, placeholder, value, onChange, type = 'text', autoFocus }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 7 }}>{label}</div>
      <input
        autoFocus={autoFocus} type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px',
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 12, color: 'var(--text)',
          fontFamily: 'var(--font-body)', fontSize: 14.5, outline: 'none', transition: 'border-color .15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--line-accent)'}
        onBlur={e  => e.target.style.borderColor = 'var(--line)'}
      />
    </div>
  );
}

window.Onboarding = Onboarding;
