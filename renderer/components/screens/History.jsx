/* History.jsx — история разговоров */

function History({ assistant }) {
  const [sessions] = useStore('sessions', []);
  const [active, setActive] = React.useState(null);
  const [q, setQ]           = React.useState('');

  // Устанавливаем первый сессию активной при загрузке
  React.useEffect(() => {
    if (sessions.length > 0 && !active) setActive(sessions[0].id);
  }, [sessions]);

  const filtered = sessions.filter(s =>
    (s.title + (s.summary || '')).toLowerCase().includes(q.toLowerCase())
  );

  const current = sessions.find(s => s.id === active);

  // Группируем по дате
  const groups = groupByDate(filtered);

  return (
    <div className="page" style={{ paddingRight: 0, paddingBottom: 0, height: '100%' }}>

      <div className="page-head" style={{ paddingRight: 38 }}>
        <div className="page-kicker">Память разговоров</div>
        <div className="page-title">История</div>
      </div>

      {/* Пусто */}
      {sessions.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 60, gap: 16, color: 'var(--text-mute)' }}>
          <Orb size={100} state="idle" wave />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-dim)', marginTop: 16 }}>
            Ещё нет разговоров
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, maxWidth: 320, textAlign: 'center' }}>
            Начни с голосового режима или задай вопрос {assistant} — и здесь появится история.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 8 }}>
            <Icon name="mic" size={16} /> Начать разговор
          </button>
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'stretch', gap: 0, height: 'calc(100% - 120px)' }}>

          {/* Список сессий */}
          <div className="col" style={{ flex: '0 0 360px', gap: 14, paddingRight: 24, borderRight: '1px solid var(--line)', overflowY: 'auto' }}>

            {/* Поиск */}
            <div className="row gap-s" style={{ padding: '10px 13px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <Icon name="search" size={17} style={{ color: 'var(--text-mute)' }} />
              <input className="input-field" value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по разговорам…" />
            </div>

            {filtered.length === 0 ? (
              <div style={{ color: 'var(--text-mute)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Ничего не найдено</div>
            ) : (
              groups.map(g => (
                <div key={g.label} className="col" style={{ gap: 6 }}>
                  <div className="nav-label" style={{ padding: '4px 4px' }}>{g.label}</div>
                  {g.items.map(s => (
                    <SessionRow key={s.id} session={s} active={active === s.id} onClick={() => setActive(s.id)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Тред */}
          {current ? (
            <ThreadView session={current} assistant={assistant} />
          ) : (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-mute)', fontSize: 14 }}>
              Выбери разговор слева
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Строка сессии ─── */
function SessionRow({ session, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className="row gap-m"
      style={{
        alignItems: 'flex-start', padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
        background: active ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'transparent',
        border: '1px solid', borderColor: active ? 'var(--line-accent)' : 'transparent',
      }}
    >
      <div style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--accent-soft)' }}>
        <Icon name={session.kind === 'voice' ? 'mic' : 'note'} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{session.title}</div>
        {session.summary && <div className="mute" style={{ fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.summary}</div>}
      </div>
      <span className="mute mono" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
        {new Date(session.created).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

/* ─── Тред (детали разговора) ─── */
function ThreadView({ session, assistant }) {
  const msgs = session.messages || [];

  return (
    <div className="col" style={{ flex: 1, padding: '0 38px', overflowY: 'auto' }}>
      <div className="row gap-m" style={{ padding: '4px 0 18px', position: 'sticky', top: 0, background: 'var(--bg-app)', zIndex: 2 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{session.title}</div>
          <div className="mute mono" style={{ fontSize: 11.5, marginTop: 2 }}>
            {session.kind === 'voice' ? 'голосовой' : 'текстовый'} · {new Date(session.created).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button className="btn btn-ghost"><Icon name="link" size={15} /> Продолжить</button>
      </div>

      {msgs.length === 0 ? (
        <div style={{ color: 'var(--text-mute)', fontSize: 13.5, padding: '20px 0' }}>Сообщения не сохранились</div>
      ) : (
        <div className="col" style={{ gap: 16, paddingBottom: 30 }}>
          {msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="msg-me">{m.content}</div>
            ) : (
              <div key={i} className="row gap-m" style={{ alignItems: 'flex-start', maxWidth: '86%' }}>
                <div style={{ flex: '0 0 30px', marginTop: 2 }}><Orb size={30} state="idle" wave={false} /></div>
                <div className="msg-ai">{m.content}</div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Группировка по дате ─── */
function groupByDate(sessions) {
  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const groups = {};
  sessions.forEach(s => {
    const d = new Date(s.created);
    let label;
    if (isSameDay(d, today))     label = 'Сегодня';
    else if (isSameDay(d, yesterday)) label = 'Вчера';
    else label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

function isSameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

window.History = History;
