/* Memory.jsx — профиль, привычки, интересы, факты */

const HABIT_ICONS = ['run', 'book', 'coffee', 'heart', 'spark', 'clock', 'music', 'note'];

function Memory({ assistant }) {
  const [profile]     = useStore('profile',      {});
  const [habits,   setHabits]   = useStore('habits',       []);
  const [facts,    setFacts]    = useStore('memory_facts',  []);

  // Интересы берём из профиля
  const interests = profile?.interests || [];
  const name      = profile?.name  || '—';
  const email     = profile?.email || '—';
  const city      = profile?.city  || '—';

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-kicker">Профиль · что {assistant} знает обо мне</div>
        <div className="page-title">Память</div>
        <div className="page-sub">Всё хранится локально на твоём устройстве — ничего не уходит в облако.</div>
      </div>

      {/* Профиль */}
      <ProfileCard profile={profile} factsCount={facts.length} />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }}>
        <HabitsCard   habits={habits}   setHabits={setHabits} />
        <PrefsCard    profile={profile} />
        <InterestsCard interests={interests} profile={profile} />
        <FactsCard    facts={facts}     setFacts={setFacts}   assistant={assistant} />
      </div>
    </div>
  );
}

/* ─── Карточка профиля ─── */
function ProfileCard({ profile, factsCount }) {
  const name   = profile?.name  || '';
  const email  = profile?.email || '';
  const city   = profile?.city  || '';
  const letter = name ? name[0].toUpperCase() : '?';

  return (
    <div className="card card-pad">
      <div className="row gap-l">
        <div style={{ width: 64, height: 64, borderRadius: 18, flex: '0 0 64px', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: '#fff', background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
          {letter}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
            {name || <span style={{ color: 'var(--text-mute)' }}>Имя не указано</span>}
          </div>
          <div className="mute" style={{ fontSize: 13.5, marginTop: 3 }}>
            {[email, city].filter(Boolean).join(' · ') || 'Данные не заполнены'}
          </div>
          <div className="row gap-s" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {city  && <span className="pill"><Icon name="location" size={12} /> {city}</span>}
            {profile?.timezone && <span className="pill"><Icon name="clock" size={12} /> {profile.timezone}</span>}
            <span className="pill ok"><Icon name="shield" size={12} /> {factsCount} фактов · локально</span>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => Store.set('onboarding_done', false) || window.location.reload()}>
          Редактировать
        </button>
      </div>
    </div>
  );
}

/* ─── Привычки ─── */
function HabitsCard({ habits, setHabits }) {
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm]         = React.useState({ text: '', goal: '', icon: 'run' });

  const add = () => {
    if (!form.text.trim()) return;
    setHabits(hs => [...hs, { id: uid(), text: form.text.trim(), goal: form.goal.trim(), icon: form.icon, streak: 0 }]);
    setForm({ text: '', goal: '', icon: 'run' });
    setShowForm(false);
  };

  const remove = id => setHabits(hs => hs.filter(h => h.id !== id));

  const incrementStreak = id => setHabits(hs => hs.map(h => h.id === id ? { ...h, streak: h.streak + 1 } : h));

  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="spark" size={17} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Привычки</span>
        {habits.length > 0 && <span className="cm">{habits.length}</span>}
      </div>

      {habits.length === 0 && !showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0', color: 'var(--text-mute)' }}>
          <Icon name="spark" size={26} style={{ opacity: 0.3 }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Нет привычек</div>
          <div style={{ fontSize: 12 }}>Добавь первую</div>
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        {habits.map(h => (
          <div key={h.id} className="row gap-m" style={{ padding: '11px 13px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div style={{ width: 36, height: 36, flex: '0 0 36px', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in oklch, var(--accent) 16%, transparent)', color: 'var(--accent-soft)' }}>
              <Icon name={h.icon} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{h.text}</div>
              {h.goal && <div className="mute mono" style={{ fontSize: 11, marginTop: 1 }}>{h.goal}</div>}
            </div>
            <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
              <div
                onClick={() => incrementStreak(h.id)}
                title="Отметить день"
                style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--accent-soft)', cursor: 'pointer' }}
              >
                {h.streak}
              </div>
              <div className="mute mono" style={{ fontSize: 10 }}>дней</div>
            </div>
            <button onClick={() => remove(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute)', display: 'grid', placeItems: 'center' }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="col" style={{ gap: 8, marginTop: 12, padding: '12px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line-accent)' }}>
          <input autoFocus value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Привычка…" style={inputSt} />
          <input value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder="Цель (например: 4×/нед)" style={inputSt} />
          <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
            {HABIT_ICONS.map(ic => (
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
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginTop: habits.length ? 10 : 0, fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Icon name="plus" size={14} /> Добавить привычку
        </button>
      )}
    </div>
  );
}

/* ─── Предпочтения (из профиля) ─── */
function PrefsCard({ profile }) {
  const prefs = [
    { k: 'Рабочие часы',  v: profile?.workStart && profile?.workEnd ? `${profile.workStart} – ${profile.workEnd}` : '—' },
    { k: 'Не беспокоить', v: profile?.dnd ? `После ${profile.dnd}` : '—' },
    { k: 'Часовой пояс',  v: profile?.timezone || '—' },
    { k: 'Язык',          v: 'Русский' },
    { k: 'Тон общения',   v: profile?.toneStyle < 33 ? 'Формальный' : profile?.toneStyle < 66 ? 'Дружелюбный' : 'Тёплый' },
  ];

  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="settings" size={16} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Предпочтения</span>
      </div>
      <div className="col">
        {prefs.map((p, i) => (
          <div key={i} className="row" style={{ padding: '10px 0', borderBottom: i < prefs.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <span className="mute" style={{ fontSize: 13, flex: '0 0 140px' }}>{p.k}</span>
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>{p.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Интересы ─── */
function InterestsCard({ interests, profile }) {
  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="heart" size={16} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Интересы</span>
        {interests.length > 0 && <span className="cm">{interests.length}</span>}
      </div>
      {interests.length === 0 ? (
        <div style={{ color: 'var(--text-mute)', fontSize: 13.5, textAlign: 'center', padding: '16px 0' }}>
          Интересы не указаны.<br />
          <button onClick={() => Store.set('onboarding_done', false) || window.location.reload()} style={{ background: 'none', border: 'none', color: 'var(--accent-soft)', cursor: 'pointer', fontSize: 13.5, marginTop: 6 }}>Заполнить профиль →</button>
        </div>
      ) : (
        <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
          {interests.map((it, i) => (
            <span key={i} className="pill" style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 13px' }}>{it}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Факты (что запомнил Jarvis) ─── */
function FactsCard({ facts, setFacts, assistant }) {
  const [showForm, setShowForm] = React.useState(false);
  const [text, setText]         = React.useState('');

  const add = () => {
    if (!text.trim()) return;
    const now = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    setFacts(fs => [...fs, { id: uid(), text: text.trim(), source: `добавлено вручную · ${now}`, created: Date.now() }]);
    setText('');
    setShowForm(false);
  };

  const remove = id => setFacts(fs => fs.filter(f => f.id !== id));

  return (
    <div className="card card-pad">
      <div className="card-h">
        <Icon name="brain" size={17} style={{ color: 'var(--accent-soft)' }} />
        <span className="ct">Что знает {assistant}</span>
        {facts.length > 0 && <span className="cm">{facts.length}</span>}
      </div>

      {facts.length === 0 && !showForm && (
        <div style={{ color: 'var(--text-mute)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
          Пока пусто — факты появятся по мере разговоров
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        {facts.map(f => (
          <div key={f.id} className="row gap-m" style={{ alignItems: 'flex-start', padding: '10px 12px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4 }}>{f.text}</div>
              <div className="mute mono" style={{ fontSize: 10.5, marginTop: 3 }}>{f.source}</div>
            </div>
            <button onClick={() => remove(f.id)} className="btn btn-icon btn-ghost" style={{ color: 'var(--text-mute)', borderColor: 'transparent', padding: 5 }}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setShowForm(false); }} placeholder="Факт обо мне…" style={inputSt} />
          <div className="row gap-s">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={add}>Добавить</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginTop: facts.length ? 10 : 0, fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Icon name="plus" size={14} /> Добавить факт
        </button>
      )}
    </div>
  );
}

const inputSt = {
  width: '100%', padding: '9px 12px',
  background: 'var(--surface-1)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)',
  fontFamily: 'var(--font-body)', fontSize: 13.5, outline: 'none',
};

window.Memory = Memory;
