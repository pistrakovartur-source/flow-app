/* Settings.jsx — настройки и интеграции */

function Settings({ assistant }) {
  const [profile]       = useStore('profile',      {});
  const [settings,  setSettings]  = useStore('settings',     { proactive: true, voiceWake: false, localOnly: true, learn: true });
  const [integrations, setIntegrations] = useStore('integrations', { calendar: false, mail: false, music: false, home: false, notes: false, maps: false });

  const toggleSetting    = k => setSettings(s => ({ ...s, [k]: !s[k] }));
  const toggleIntegration = k => setIntegrations(s => ({ ...s, [k]: !s[k] }));

  const [persona, setPersona] = React.useState(profile?.toneStyle ?? 60);
  const [voice,   setVoice]   = React.useState(`${assistant} · мягкий`);

  // Синхронизируем тон с профилем
  React.useEffect(() => {
    if (profile?.toneStyle !== undefined) setPersona(profile.toneStyle);
  }, [profile?.toneStyle]);

  const personaLabel = persona < 33 ? 'Формальный' : persona < 66 ? 'Дружелюбный' : 'Тёплый';

  const voices       = [`${assistant} · мягкий`, `${assistant} · нейтральный`, `${assistant} · энергичный`];
  const activeCount  = Object.values(integrations || {}).filter(Boolean).length;

  const settingsList = [
    { k: 'proactive',  t: 'Проактивные подсказки',     s: `${assistant} сам напоминает и предлагает`      },
    { k: 'voiceWake',  t: 'Активация голосом',          s: `«Привет, ${assistant}» в любой момент`        },
    { k: 'learn',      t: 'Учиться из разговоров',      s: 'Запоминать факты и привычки'                  },
    { k: 'localOnly',  t: 'Только локальное хранение',  s: 'Память не покидает устройство'                },
  ];

  const integrationsList = [
    { k: 'calendar', i: 'calendar', t: 'Календарь',       s: 'Синхронизация событий'      },
    { k: 'mail',     i: 'mail',     t: 'Почта',           s: 'Чтение важных писем'         },
    { k: 'music',    i: 'music',    t: 'Музыка',          s: 'Плейлисты и фокус-режим'     },
    { k: 'notes',    i: 'note',     t: 'Заметки',         s: 'Локальные заметки'           },
    { k: 'home',     i: 'home',     t: 'Умный дом',       s: 'Не подключено'               },
    { k: 'maps',     i: 'map',      t: 'Карты и поездки', s: 'Маршруты и навигация'        },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-kicker">Настройки</div>
        <div className="page-title">Настройки и интеграции</div>
        <div className="page-sub">Характер ассистента, приватность, подключённые сервисы.</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* ── Профиль ── */}
        <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
          <div className="card-h">
            <Icon name="brain" size={17} style={{ color: 'var(--accent-soft)' }} />
            <span className="ct">Профиль</span>
          </div>
          <div className="row gap-l">
            <div style={{ width: 48, height: 48, flex: '0 0 48px', borderRadius: 14, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: '#fff', background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
              {profile?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{profile?.name || 'Имя не указано'}</div>
              <div className="mute" style={{ fontSize: 13, marginTop: 2 }}>
                {[profile?.email, profile?.city].filter(Boolean).join(' · ') || 'Профиль не заполнен'}
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => { Store.set('onboarding_done', false); window.location.reload(); }}>
              Редактировать профиль
            </button>
          </div>
        </div>

        {/* ── Характер ── */}
        <div className="card card-pad">
          <div className="card-h">
            <Icon name="spark" size={17} style={{ color: 'var(--accent-soft)' }} />
            <span className="ct">Характер ассистента</span>
          </div>
          <div className="col gap-l">

            {/* Имя */}
            <div>
              <div className="mute" style={{ fontSize: 13, marginBottom: 8 }}>Имя</div>
              <div className="row gap-m" style={{ padding: '11px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                <Orb size={28} state="idle" wave={false} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{assistant}</span>
                <span className="mute mono" style={{ marginLeft: 'auto', fontSize: 11 }}>меняется в Tweaks ⚙</span>
              </div>
            </div>

            {/* Тон */}
            <div>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="mute" style={{ fontSize: 13 }}>Тон общения</span>
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--accent-soft)' }}>{personaLabel}</span>
              </div>
              <input type="range" min="0" max="100" value={persona}
                onChange={e => {
                  setPersona(+e.target.value);
                  Store.set('profile', { ...(Store.get('profile') || {}), toneStyle: +e.target.value });
                }}
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="row mono mute" style={{ justifyContent: 'space-between', fontSize: 10.5, marginTop: 5 }}>
                <span>Деловой</span><span>Тёплый</span>
              </div>
            </div>

            {/* Голос */}
            <div>
              <div className="mute" style={{ fontSize: 13, marginBottom: 10 }}>Голос</div>
              <div className="col gap-s">
                {voices.map(v => (
                  <div key={v} onClick={() => setVoice(v)} className="row gap-m"
                    style={{ padding: '10px 13px', borderRadius: 11, cursor: 'pointer', background: voice === v ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'var(--surface-2)', border: '1px solid', borderColor: voice === v ? 'var(--line-accent)' : 'var(--line)' }}>
                    <Icon name="waveform" size={16} style={{ color: 'var(--accent-soft)' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{v}</span>
                    {voice === v && <Icon name="check" size={16} style={{ marginLeft: 'auto', color: 'var(--accent-soft)' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Поведение и приватность ── */}
        <div className="card card-pad">
          <div className="card-h">
            <Icon name="shield" size={17} style={{ color: 'var(--accent-soft)' }} />
            <span className="ct">Поведение и приватность</span>
          </div>
          <div className="col">
            {settingsList.map((o, i) => (
              <div key={o.k} className="row gap-m" style={{ padding: '14px 0', borderBottom: i < settingsList.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.t}</div>
                  <div className="mute" style={{ fontSize: 12.5, marginTop: 1 }}>{o.s}</div>
                </div>
                <Toggle on={(settings || {})[o.k]} onClick={() => toggleSetting(o.k)} />
              </div>
            ))}
          </div>

          {/* Плашка приватности */}
          <div className="row gap-m" style={{ marginTop: 16, padding: '13px 14px', borderRadius: 12, background: 'color-mix(in oklch, var(--accent) 10%, transparent)', border: '1px solid var(--line-accent)' }}>
            <Icon name="shield" size={20} style={{ color: 'var(--accent-soft)', flexShrink: 0 }} />
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              Вся память хранится локально. В Claude API уходит только текст текущего запроса.
            </div>
          </div>
        </div>

        {/* ── Интеграции ── */}
        <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
          <div className="card-h">
            <Icon name="link" size={17} style={{ color: 'var(--accent-soft)' }} />
            <span className="ct">Интеграции</span>
            <span className="cm">{activeCount} активны</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {integrationsList.map(it => {
              const on = (integrations || {})[it.k];
              return (
                <div key={it.k} className="row gap-m" style={{ padding: '14px 15px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid', borderColor: on ? 'var(--line-accent)' : 'var(--line)' }}>
                  <div style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, display: 'grid', placeItems: 'center', background: on ? 'color-mix(in oklch, var(--accent) 18%, transparent)' : 'var(--surface-3)', color: on ? 'var(--accent-soft)' : 'var(--text-mute)' }}>
                    <Icon name={it.i} size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{it.t}</div>
                    <div className="mute" style={{ fontSize: 11.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{on ? it.s : 'Не подключено'}</div>
                  </div>
                  <Toggle on={on} onClick={() => toggleIntegration(it.k)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Сброс данных ── */}
        <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
          <div className="card-h">
            <Icon name="trash" size={17} style={{ color: '#fb7185' }} />
            <span className="ct" style={{ color: '#fb7185' }}>Опасная зона</span>
          </div>
          <div className="row gap-m" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Сбросить профиль</div>
              <div className="mute" style={{ fontSize: 12.5, marginTop: 2 }}>Удалит все данные и запустит онбординг заново</div>
            </div>
            <button className="btn" style={{ borderColor: '#fb718540', color: '#fb7185', background: 'rgba(251,113,133,0.07)' }}
              onClick={() => { if (confirm('Сбросить все данные?')) { Store.reset(); window.location.reload(); } }}>
              Сбросить всё
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Переключатель ─── */
function Toggle({ on, onClick }) {
  return (
    <div className="toggle" onClick={onClick} style={{ background: on ? 'var(--accent)' : 'var(--surface-3)', boxShadow: on ? '0 0 14px var(--accent-glow)' : 'none' }}>
      <div className="toggle-thumb" style={{ transform: on ? 'translateX(18px)' : 'none' }} />
    </div>
  );
}

window.Settings = Settings;
window.Toggle   = Toggle;
