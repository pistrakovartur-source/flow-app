import { useState, useRef, useMemo, useEffect } from 'react'
import { useStore, Store } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'

const TWEAKS_KEY = 'jarvis_tweaks'
const THEMES = [{ id:'dark', label:'Тёмная' }, { id:'light', label:'Светлая' }]
const FONTS   = [{ id:'Space Grotesk', label:'Space Grotesk' }, { id:'Manrope', label:'Manrope' }, { id:'Inter', label:'Inter' }]
const RADII   = [{ id:'sm', label:'Малый' }, { id:'md', label:'Средний' }, { id:'lg', label:'Большой' }]

const SHORTCUTS = [
  { keys:'Ctrl+K',    desc:'Глобальный поиск по всему приложению' },
  { keys:'Ctrl+N',    desc:'Быстрое добавление задачи из любого экрана' },
  { keys:'Space',     desc:'Пауза / старт таймера (экран Фокус)' },
  { keys:'R',         desc:'Сброс таймера (экран Фокус)' },
  { keys:'Esc',       desc:'Закрыть поиск / модальное окно / быстрый ввод' },
  { keys:'↑↓',        desc:'Навигация в поиске' },
  { keys:'↵ Enter',   desc:'Перейти к результату поиска' },
]

const PREFIX = 'flow__'

const openUrl = (url) => {
  if (window.jarvis?.openUrl) window.jarvis.openUrl(url)
  else window.open(url, '_blank')
}

function exportData() {
  const data = {}
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => {
      try { data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)) } catch {}
    })
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type:'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const date = new Date().toISOString().slice(0,10)
  a.href = url; a.download = `flow-backup-${date}.json`; a.click()
  URL.revokeObjectURL(url)
}

function importData(file, onDone) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(PREFIX + k, JSON.stringify(v))
      })
      onDone(true)
    } catch {
      onDone(false)
    }
  }
  reader.readAsText(file)
}

export function Settings() {
  const [profile, setProfile]           = useStore('profile', {})
  const [integrations, setIntegrations] = useStore('integrations', { yandexMusic:false })
  const [tweaks,  setTweaks]            = useStore(TWEAKS_KEY, {})
  const [cityDraft, setCityDraft]       = useState('')
  const [citySaved, setCitySaved]       = useState(false)
  const [importStatus, setImportStatus] = useState(null)
  const [editProfile, setEditProfile]   = useState(false)
  const [profileDraft, setProfileDraft] = useState({})
  const fileRef = useRef(null)

  const [tasks]   = useStore('tasks', [])
  const [notes]   = useStore('notes', [])
  const [habits]  = useStore('habits_v2', [])
  const [events]  = useStore('calendar_events', [])
  const [txns]    = useStore('budget_txns', [])
  const [focStats]= useStore('focus_stats', {})

  const dataStats = useMemo(() => [
    { icon:'check',    label:'Задачи',    val: (tasks||[]).length,   sub: `${(tasks||[]).filter(t=>t.done).length} выполнено` },
    { icon:'note',     label:'Заметки',   val: (notes||[]).length,   sub: `${(notes||[]).filter(n=>n.pinned).length} закреплено` },
    { icon:'repeat',   label:'Привычки',  val: (habits||[]).length,  sub: 'активных' },
    { icon:'calendar', label:'События',   val: (events||[]).length,  sub: 'в календаре' },
    { icon:'tag',      label:'Транзакции',val: (txns||[]).length,    sub: 'в бюджете' },
    { icon:'timer',    label:'Фокус-сессий',val: focStats?.sessions||0, sub: `${Math.round((focStats?.totalMinutes||0)/60*10)/10} ч` },
  ], [tasks, notes, habits, events, txns, focStats])

  const saveCity = () => {
    if (!cityDraft.trim()) return
    setProfile(p => ({ ...p, city: cityDraft.trim() }))
    sessionStorage.removeItem('weather_cache_v2')
    setCitySaved(true)
    setTimeout(() => setCitySaved(false), 2000)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    importData(file, (ok) => {
      setImportStatus(ok ? 'ok' : 'err')
      if (ok) setTimeout(() => window.location.reload(), 1200)
    })
  }

  return (
    <div className="view">
      <div className="pg-eyebrow mono">Конфигурация</div>
      <div className="pg-title">Настройки</div>
      <div className="pg-sub" style={{ marginBottom:28 }}>Профиль, интеграции и управление данными.</div>

      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

        {/* ── Профиль ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="sun" size={17} style={{ color:'var(--acc-text)' }}/>
            <span className="ct">Профиль</span>
          </div>
          {editProfile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'name',      label:'Имя',             type:'text',   placeholder:'Дмитрий' },
                { key:'email',     label:'Email',           type:'email',  placeholder:'you@example.com' },
                { key:'city',      label:'Город',           type:'text',   placeholder:'Москва' },
                { key:'timezone',  label:'Часовой пояс',    type:'text',   placeholder:'Europe/Moscow' },
                { key:'workStart', label:'Начало рабочего дня', type:'time', placeholder:'' },
                { key:'workEnd',   label:'Конец рабочего дня',  type:'time', placeholder:'' },
              ].map(f => (
                <div key={f.key} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ fontSize:12.5, color:'var(--t-mute)', width:140, flexShrink:0 }}>{f.label}</div>
                  <input type={f.type} value={profileDraft[f.key]||''} onChange={e => setProfileDraft(d => ({...d,[f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    style={{ flex:1, padding:'7px 11px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none' }}
                  />
                </div>
              ))}
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button className="btn-primary" style={{ flex:1 }} onClick={() => {
                  setProfile(p => ({ ...p, ...profileDraft }))
                  if (profileDraft.city && profileDraft.city !== profile?.city) sessionStorage.removeItem('weather_cache_v2')
                  setEditProfile(false)
                }}>Сохранить</button>
                <button className="tb-btn" onClick={() => setEditProfile(false)}>Отмена</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:52, height:52, flexShrink:0, borderRadius:14, display:'grid', placeItems:'center', fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:22, color:'#fff', background:'linear-gradient(135deg,var(--acc),#7c3aed)' }}>
                {profile?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:15 }}>{profile?.name || 'Имя не указано'}</div>
                <div style={{ fontSize:13, color:'var(--t-mute)', marginTop:2 }}>
                  {[profile?.email, profile?.city].filter(Boolean).join(' · ') || 'Профиль не заполнен'}
                </div>
                {profile?.timezone && (
                  <div style={{ fontSize:12, color:'var(--t-mute)', marginTop:1, fontFamily:'"JetBrains Mono"' }}>
                    {profile.timezone} · {profile.workStart}–{profile.workEnd}
                  </div>
                )}
              </div>
              <button className="tb-btn" onClick={() => { setProfileDraft({...profile}); setEditProfile(true) }}>
                Редактировать
              </button>
            </div>
          )}
        </div>

        {/* ── Виджеты на Главной ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="grid" size={17} style={{ color:'var(--acc-text)' }}/>
            <span className="ct">Виджеты на Главной</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <WidgetRow emoji="🌤️" title={`Погода · ${profile?.city || 'город не указан'}`} sub="Open-Meteo, без ключа" always />
            <WidgetRow emoji="🎵" title="Яндекс Музыка" sub="Моя волна, плейлисты, новинки, подкасты"
              active={integrations?.yandexMusic}
              onToggle={() => setIntegrations(s => ({ ...s, yandexMusic: !s.yandexMusic }))}
              link="https://music.yandex.ru" />
            <WidgetRow emoji="🔁" title="Привычки сегодня" sub="Прогресс выполнения привычек за день" always />
            <WidgetRow emoji="💸" title="Расходы (7 дней)" sub="Мини-график трат за последнюю неделю" always />
          </div>

          {/* Город для погоды */}
          <div style={{ display:'flex', gap:10, marginTop:6, alignItems:'center' }}>
            <div style={{ fontSize:13, color:'var(--t-mute)', whiteSpace:'nowrap' }}>Город погоды</div>
            <input value={cityDraft || profile?.city || ''} onChange={e=>setCityDraft(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&saveCity()}
              placeholder="Например: Москва"
              style={{ flex:1, padding:'7px 11px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none' }}/>
            <button className="tb-btn" style={{ fontSize:13, padding:'7px 13px' }} onClick={saveCity}>
              {citySaved ? '✓ Сохранено' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* ── Статистика данных ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="spark" size={17} style={{ color:'#fbbf24' }}/>
            <span className="ct">Ваши данные</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {dataStats.map(s => (
              <div key={s.label} style={{ padding:'12px 14px', borderRadius:11, background:'var(--surf-2)', border:'1px solid var(--line)' }}>
                <div style={{ fontFamily:'"Space Grotesk"', fontSize:22, fontWeight:700, lineHeight:1, marginBottom:3 }}>{s.val}</div>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:1 }}>{s.label}</div>
                <div style={{ fontSize:11, color:'var(--t-mute)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Данные и приватность ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="shield" size={17} style={{ color:'var(--acc-text)' }}/>
            <span className="ct">Данные и приватность</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:11, background:'color-mix(in oklch,var(--acc) 8%,transparent)', border:'1px solid var(--acc-line)', marginBottom:14 }}>
            <Icon name="shield" size={18} style={{ color:'var(--acc-text)', flexShrink:0 }}/>
            <div style={{ fontSize:13, color:'var(--t-dim)', lineHeight:1.55 }}>
              Все данные хранятся только локально на этом устройстве.
            </div>
          </div>

          {/* Экспорт / импорт */}
          <div style={{ display:'flex', gap:10 }}>
            <button className="tb-btn" style={{ flex:1 }} onClick={exportData}>
              <Icon name="note" size={14}/> Экспортировать данные
            </button>
            <button className="tb-btn" style={{ flex:1 }} onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={14}/> Импортировать данные
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport}/>
          </div>

          {importStatus && (
            <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, fontSize:13,
              background: importStatus==='ok' ? 'color-mix(in oklch,var(--c-calm) 10%,transparent)' : 'color-mix(in oklch,#f87171 10%,transparent)',
              color:      importStatus==='ok' ? 'var(--c-calm)' : '#f87171',
              border:     `1px solid ${importStatus==='ok' ? 'color-mix(in oklch,var(--c-calm) 30%,transparent)' : 'rgba(248,113,113,.3)'}`,
            }}>
              {importStatus==='ok' ? '✓ Данные импортированы. Перезагрузка…' : '✗ Ошибка чтения файла. Выберите корректный backup.'}
            </div>
          )}
        </div>

        {/* ── Telegram Bot ── */}
        <TelegramCard />

        {/* ── Внешний вид ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="spark" size={17} style={{ color:'var(--acc-text)' }}/>
            <span className="ct">Внешний вид</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Тема */}
            <AppearanceRow label="Тема">
              <div style={{ display:'flex', gap:6 }}>
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setTweaks(tw => ({ ...tw, theme: t.id }))}
                    style={{ padding:'5px 14px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, transition:'all .15s',
                      borderColor: (tweaks?.theme||'dark')===t.id ? 'var(--acc-line)' : 'var(--line)',
                      background:  (tweaks?.theme||'dark')===t.id ? 'color-mix(in oklch,var(--acc) 18%,transparent)' : 'var(--surf-2)',
                      color:       (tweaks?.theme||'dark')===t.id ? 'var(--acc-text)' : 'var(--t-mute)',
                    }}>{t.label}</button>
                ))}
              </div>
            </AppearanceRow>
            {/* Шрифт */}
            <AppearanceRow label="Шрифт">
              <div style={{ display:'flex', gap:6 }}>
                {FONTS.map(f => (
                  <button key={f.id} onClick={() => setTweaks(tw => ({ ...tw, fontDisplay: f.id }))}
                    style={{ padding:'5px 14px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, transition:'all .15s',
                      borderColor: (tweaks?.fontDisplay||'Space Grotesk')===f.id ? 'var(--acc-line)' : 'var(--line)',
                      background:  (tweaks?.fontDisplay||'Space Grotesk')===f.id ? 'color-mix(in oklch,var(--acc) 18%,transparent)' : 'var(--surf-2)',
                      color:       (tweaks?.fontDisplay||'Space Grotesk')===f.id ? 'var(--acc-text)' : 'var(--t-mute)',
                    }}>{f.label}</button>
                ))}
              </div>
            </AppearanceRow>
            {/* Скругление */}
            <AppearanceRow label="Скругление">
              <div style={{ display:'flex', gap:6 }}>
                {RADII.map(r => (
                  <button key={r.id} onClick={() => setTweaks(tw => ({ ...tw, radius: r.id }))}
                    style={{ padding:'5px 14px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, transition:'all .15s',
                      borderColor: (tweaks?.radius||'md')===r.id ? 'var(--acc-line)' : 'var(--line)',
                      background:  (tweaks?.radius||'md')===r.id ? 'color-mix(in oklch,var(--acc) 18%,transparent)' : 'var(--surf-2)',
                      color:       (tweaks?.radius||'md')===r.id ? 'var(--acc-text)' : 'var(--t-mute)',
                    }}>{r.label}</button>
                ))}
              </div>
            </AppearanceRow>
            {/* Акцентный цвет */}
            <AppearanceRow label="Акцент">
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="color" value={tweaks?.accent||'#5b8dee'} onChange={e => setTweaks(tw => ({ ...tw, accent: e.target.value }))}
                  style={{ width:36, height:36, borderRadius:8, border:'1px solid var(--line)', background:'none', cursor:'pointer', padding:2 }}/>
                <span style={{ fontFamily:'"JetBrains Mono"', fontSize:12, color:'var(--t-mute)' }}>{tweaks?.accent||'#5b8dee'}</span>
              </div>
            </AppearanceRow>
          </div>
        </div>

        {/* ── Горячие клавиши ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="zap" size={17} style={{ color:'var(--acc-text)' }}/>
            <span className="ct">Горячие клавиши</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {SHORTCUTS.map(s => (
              <div key={s.keys} style={{ display:'flex', alignItems:'center', gap:14, padding:'6px 0' }}>
                <kbd style={{ fontFamily:'"JetBrains Mono"', fontSize:12, color:'var(--t-dim)', background:'var(--surf-2)', padding:'3px 10px', borderRadius:6, border:'1px solid var(--line)', flexShrink:0, minWidth:80, textAlign:'center' }}>{s.keys}</kbd>
                <div style={{ fontSize:13.5, color:'var(--t-dim)' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Опасная зона ── */}
        <div className="card">
          <div className="card-head">
            <Icon name="trash" size={16} style={{ color:'#fb7185' }}/>
            <span className="ct" style={{ color:'#fb7185' }}>Опасная зона</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderRadius:11, border:'1px solid rgba(251,113,133,.2)', background:'rgba(251,113,133,.04)' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>Сбросить всё</div>
              <div style={{ fontSize:12.5, color:'var(--t-mute)', marginTop:2 }}>Удалит профиль, задачи, заметки, токены Яндекса</div>
            </div>
            <button className="btn" style={{ borderColor:'rgba(251,113,133,.4)', color:'#fb7185', background:'rgba(251,113,133,.07)' }}
              onClick={() => { if (confirm('Сбросить все данные приложения?')) { Store.reset(); window.location.reload() } }}>
              Сбросить
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function AppearanceRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ fontSize:13, color:'var(--t-mute)', width:90, flexShrink:0 }}>{label}</div>
      {children}
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{ width:42, height:24, borderRadius:99, flexShrink:0, cursor:'pointer', padding:3, background:on?'var(--acc)':'var(--surf-hi)', boxShadow:on?'0 0 12px color-mix(in oklch, var(--acc) 40%, transparent)':'none', transition:'background .2s' }}>
      <div style={{ width:18, height:18, borderRadius:99, background:'#fff', transform:on?'translateX(18px)':'none', transition:'transform .2s', boxShadow:'0 1px 3px rgba(0,0,0,.4)' }}/>
    </div>
  )
}

function TelegramCard() {
  const DEF = { token:'', chatId:'', morningTime:'09:00', eveningTime:'20:00', overdueReminder:true, enabled:true, cloudUrl:'', syncKey:'' }
  const [s, setS]           = useState(DEF)
  const [saved, setSaved]   = useState(false)
  const [testing, setTest]  = useState(false)
  const [testRes, setTestR] = useState(null) // 'ok' | error string

  useEffect(() => {
    window.jarvis?.telegram?.getSettings?.().then(data => {
      if (data && Object.keys(data).length) setS(prev => ({ ...prev, ...data }))
    })
  }, [])

  const upd = (k, v) => setS(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    await window.jarvis?.telegram?.saveSettings?.(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const test = async () => {
    setTest(true); setTestR(null)
    const res = await window.jarvis?.telegram?.test?.()
    setTest(false)
    setTestR(res?.ok ? 'ok' : (res?.error || 'Ошибка соединения'))
    setTimeout(() => setTestR(null), 4000)
  }

  const inp = { padding:'7px 11px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none' }

  return (
    <div className="card">
      <div className="card-head">
        <span style={{ fontSize:17 }}>✈️</span>
        <span className="ct">Telegram Bot</span>
        <div style={{ marginLeft:'auto' }}>
          <Toggle on={!!s.enabled} onClick={() => upd('enabled', !s.enabled)} />
        </div>
      </div>

      <div style={{ fontSize:13, color:'var(--t-mute)', marginBottom:14, lineHeight:1.65 }}>
        1. Создай бота через <b>@BotFather</b> → получи токен.<br/>
        2. Напиши боту любое сообщение, затем узнай свой chat_id через <b>@userinfobot</b>.<br/>
        3. Вставь данные ниже и нажми «Сохранить».
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <TgRow label="Токен бота">
          <input type="password" value={s.token} onChange={e => upd('token', e.target.value)}
            placeholder="1234567890:AAABBB…" style={{ ...inp, flex:1 }}/>
        </TgRow>
        <TgRow label="Chat ID">
          <input type="text" value={s.chatId} onChange={e => upd('chatId', e.target.value)}
            placeholder="123456789" style={{ ...inp, width:160 }}/>
        </TgRow>
        <TgRow label="Утренняя сводка">
          <input type="time" value={s.morningTime} onChange={e => upd('morningTime', e.target.value)}
            style={{ ...inp, width:110 }}/>
          <span style={{ fontSize:12, color:'var(--t-mute)' }}>задачи + привычки</span>
        </TgRow>
        <TgRow label="Вечерняя сводка">
          <input type="time" value={s.eveningTime} onChange={e => upd('eveningTime', e.target.value)}
            style={{ ...inp, width:110 }}/>
          <span style={{ fontSize:12, color:'var(--t-mute)' }}>итоги дня</span>
        </TgRow>
        <TgRow label="Просрочка">
          <Toggle on={!!s.overdueReminder} onClick={() => upd('overdueReminder', !s.overdueReminder)}/>
          <span style={{ fontSize:12.5, color:'var(--t-mute)' }}>напоминать каждые 2 ч (9:00–22:00)</span>
        </TgRow>

        <div style={{ height:1, background:'var(--line)', margin:'4px 0' }}/>

        <TgRow label="URL сервера">
          <input type="text" value={s.cloudUrl} onChange={e => upd('cloudUrl', e.target.value)}
            placeholder="https://your-app.railway.app" style={{ ...inp, flex:1 }}/>
        </TgRow>
        <TgRow label="Sync Key">
          <input type="password" value={s.syncKey} onChange={e => upd('syncKey', e.target.value)}
            placeholder="секретный ключ" style={{ ...inp, flex:1 }}/>
          <button className="tb-btn" style={{ fontSize:12, whiteSpace:'nowrap' }}
            onClick={() => window.jarvis?.telegram?.sync?.().then(() => alert('Синхронизировано!'))}>
            Синхронизировать
          </button>
        </TgRow>
      </div>

      <div style={{ display:'flex', gap:10, marginTop:16 }}>
        <button className="btn-primary" style={{ flex:1 }} onClick={save}>
          {saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
        <button className="tb-btn" style={{ minWidth:90 }} onClick={test} disabled={testing}>
          {testing ? 'Отправляю…' : 'Тест'}
        </button>
      </div>

      {testRes && (
        <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, fontSize:13,
          background: testRes==='ok' ? 'color-mix(in oklch,var(--c-calm) 10%,transparent)' : 'color-mix(in oklch,#f87171 10%,transparent)',
          color:      testRes==='ok' ? 'var(--c-calm)' : '#f87171',
          border:     `1px solid ${testRes==='ok' ? 'color-mix(in oklch,var(--c-calm) 30%,transparent)' : 'rgba(248,113,113,.3)'}`,
        }}>
          {testRes==='ok' ? '✓ Сообщение отправлено в Telegram!' : `✗ ${testRes}`}
        </div>
      )}
    </div>
  )
}

function TgRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ fontSize:12.5, color:'var(--t-mute)', width:150, flexShrink:0 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>{children}</div>
    </div>
  )
}

function WidgetRow({ emoji, title, sub, active, onToggle, always, link }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 0', borderBottom:'1px solid var(--line)' }}>
      <div style={{ fontSize:22, flexShrink:0, width:34, textAlign:'center' }}>{emoji}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:13.5 }}>{title}</div>
        <div style={{ fontSize:12, color:'var(--t-mute)', marginTop:1 }}>{sub}</div>
      </div>
      {link && (
        <button className="tb-btn" style={{ fontSize:11, padding:'4px 9px' }} onClick={() => openUrl(link)}>↗</button>
      )}
      {always ? (
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:99, background:'var(--c-calm)', boxShadow:'0 0 5px var(--c-calm)' }}/>
          <span style={{ fontSize:11, color:'var(--c-calm)', fontFamily:'"JetBrains Mono"' }}>авто</span>
        </div>
      ) : (
        <Toggle on={!!active} onClick={onToggle} />
      )}
    </div>
  )
}
