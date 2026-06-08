import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore, Store, uid } from './store'
import { Icon } from './components/Icons'
import { Sidebar } from './components/UIKit'
import { DynamicIsland } from './components/DynamicIsland'
import { Onboarding } from './Onboarding'
import { speak, initTTS } from './services/tts'
import { Dashboard  } from './screens/Dashboard'
import { Tasks      } from './screens/Tasks'
import { Calendar   } from './screens/Calendar'
import { Focus      } from './screens/Focus'
import { Music      } from './screens/Music'
import { Notes      } from './screens/Notes'
import { Habits     } from './screens/Habits'
import { Budget     } from './screens/Budget'
import { Settings   } from './screens/Settings'
import { Activity   } from './screens/Activity'
import { Assistant  } from './screens/Assistant'
import { News       } from './screens/News'
import { Diary      } from './screens/Diary'

const SCREEN_MAP = { dashboard:Dashboard, tasks:Tasks, calendar:Calendar, music:Music, focus:Focus, habits:Habits, budget:Budget, notes:Notes, activity:Activity, diary:Diary, news:News, assistant:Assistant, settings:Settings }

function autoPhase(h) {
  if (h < 6) return 'night'
  if (h < 11) return 'morning'
  if (h < 18) return 'day'
  return 'evening'
}

const TWEAKS_KEY = 'flow_tweaks_v2'
function loadTweaks(def) {
  try { return { ...def, ...JSON.parse(localStorage.getItem(TWEAKS_KEY) || '{}') } } catch { return def }
}

export function App() {
  const [done]    = useStore('onboarding_done', false)
  const [profile] = useStore('profile', {})
  const [tasks]   = useStore('tasks', [])
  const [habits]  = useStore('habits_v2', [])
  const [screen, setScreen] = useState('dashboard')
  const [cmdOpen, setCmdOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  // tweaks
  const TWEAK_DEFAULTS = { accent: '#7c5cff', timeOfDay: 'auto', density: 'regular', motion: true, glow: true, grain: true }
  const [tweaks, setTweaksState] = useState(() => loadTweaks(TWEAK_DEFAULTS))
  const setTweak = (key, val) => setTweaksState(prev => {
    const next = { ...prev, [key]: val }
    localStorage.setItem(TWEAKS_KEY, JSON.stringify(next))
    return next
  })

  const today = new Date().toISOString().slice(0, 10)
  const pendingTasksCount = (tasks||[]).filter(t => !t.done).length
  const habitsLeftCount   = (habits||[]).filter(h => !(h.log||[]).includes(today)).length

  // apply tweaks to DOM
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--acc', tweaks.accent)
    const ph = tweaks.timeOfDay === 'auto' ? autoPhase(new Date().getHours()) : tweaks.timeOfDay
    r.dataset.phase = ph
    r.dataset.density = tweaks.density
    r.dataset.motion = tweaks.motion ? 'on' : 'off'
    r.dataset.glow = tweaks.glow ? 'on' : 'off'
    r.dataset.grain = tweaks.grain ? 'on' : 'off'
  }, [tweaks])

  // live clock + phase
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setNow(n)
      if (tweaks.timeOfDay === 'auto') {
        document.documentElement.dataset.phase = autoPhase(n.getHours())
      }
    }, 1000)
    return () => clearInterval(id)
  }, [tweaks.timeOfDay])

  const flash = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1700)
  }, [])

  const navigate = useCallback((s) => {
    if (s !== 'music') window.jarvis?.music?.hide?.()
    setScreen(s)
  }, [])

  const addTask = () => {
    Store.set('tasks', [...Store.get('tasks', []), { id: uid(), text: 'Новая задача', tag: 'Личное', priority: 'mid', done: false, created: Date.now() }])
    if (screen !== 'dashboard') navigate('dashboard')
    flash('Задача добавлена')
  }

  // ── VAD ─────────────────────────────────────────────────────────────────
  const [alwaysListen] = useStore('always_listen', false)
  const [wakeWord]     = useStore('wake_word', 'джарвис')
  const vadStream    = useRef(null)
  const vadCtx       = useRef(null)
  const vadProc      = useRef(null)
  const vadChunks    = useRef([])
  const vadOn        = useRef(false)
  const vadLastHigh  = useRef(0)
  const vadStart     = useRef(0)
  const wakeRef      = useRef(wakeWord)
  const navRef       = useRef(navigate)
  useEffect(() => { wakeRef.current = wakeWord }, [wakeWord])
  useEffect(() => { navRef.current  = navigate  }, [navigate])
  useEffect(() => { initTTS() }, [])

  const stopVAD = useCallback(() => {
    vadOn.current = false; vadChunks.current = []
    vadProc.current?.disconnect()
    vadStream.current?.getTracks().forEach(t => t.stop())
    vadCtx.current?.close().catch(() => {})
    vadProc.current = null; vadStream.current = null; vadCtx.current = null
  }, [])

  const execWakeCmd = useCallback((cmd) => {
    const t = cmd.toLowerCase()
    const navList = [
      [/задач/,        'tasks',     'Задачи'],
      [/календар/,     'calendar',  'Календарь'],
      [/фокус|таймер/, 'focus',     'Фокус'],
      [/привычк/,      'habits',    'Привычки'],
      [/бюджет/,       'budget',    'Бюджет'],
      [/заметк/,       'notes',     'Заметки'],
      [/музык/,        'music',     'Музыку'],
      [/активност/,    'activity',  'Активность'],
      [/настройк/,     'settings',  'Настройки'],
      [/новост/,       'news',      'Новости'],
      [/главн|домой/,  'dashboard', 'Главную'],
      [/ассистент/,    'assistant', 'Ассистента'],
    ]
    if (/открой|перейди|покажи|переключ/.test(t)) {
      for (const [rx, id, name] of navList) {
        if (rx.test(t)) { navRef.current(id); speak(`Открываю ${name}`); return }
      }
    }
    const taskM = t.match(/добавь?\s+задачу?\s+(.+)/)
    if (taskM) {
      Store.set('tasks', [...Store.get('tasks', []), { id: uid(), text: taskM[1].trim(), tag: 'Личное', priority: 'mid', done: false, created: Date.now() }])
      speak('Задача добавлена'); return
    }
    if (/который час|сколько времен|время/.test(t)) {
      speak(`Сейчас ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`)
      return
    }
    speak('Слушаю')
  }, [])

  const processVADResult = useCallback(async (chunks) => {
    const total = chunks.reduce((s, c) => s + c.length, 0)
    if (total < 16000 * 0.35) return
    const pcm = new Int16Array(total)
    let off = 0
    for (const c of chunks) { pcm.set(c, off); off += c.length }
    const res = await window.jarvis?.speech?.recognize(pcm.buffer).catch(() => null)
    if (!res?.ok || !res.text) return
    const text = res.text.toLowerCase().trim()
    const wake = (wakeRef.current || 'джарвис').toLowerCase()
    if (!text.includes(wake)) return
    const escapedWake = wake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const cmd = text.replace(new RegExp(escapedWake + '[,!.\\s]*', 'g'), '').trim()
    Store.set('wake_last', { raw: res.text, cmd, ts: Date.now() })
    if (cmd) execWakeCmd(cmd)
    else speak('Слушаю')
  }, [execWakeCmd])

  const startVAD = useCallback(async () => {
    const s = await window.jarvis?.speech?.getStatus?.().catch(() => null)
    if (!s?.ready) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      vadStream.current = stream
      const ctx = new AudioContext({ sampleRate: 16000 })
      vadCtx.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      vadProc.current = proc
      vadOn.current = false; vadChunks.current = []
      proc.onaudioprocess = (e) => {
        const float = e.inputBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < float.length; i++) sum += float[i] * float[i]
        const rms = Math.sqrt(sum / float.length)
        const n = Date.now()
        if (rms > 0.018) {
          if (!vadOn.current) { vadOn.current = true; vadStart.current = n; vadChunks.current = [] }
          vadLastHigh.current = n
        }
        if (vadOn.current) {
          const int16 = new Int16Array(float.length)
          for (let i = 0; i < float.length; i++) int16[i] = Math.max(-32768, Math.min(32767, float[i] * 32768))
          vadChunks.current.push(int16)
          const speechMs = n - vadStart.current
          const silenceMs = n - vadLastHigh.current
          if ((silenceMs > 700 && speechMs > 500) || speechMs > 8000) {
            vadOn.current = false
            const pending = vadChunks.current; vadChunks.current = []
            processVADResult(pending)
          }
        }
      }
      src.connect(proc); proc.connect(ctx.destination)
    } catch {}
  }, [processVADResult])

  useEffect(() => {
    if (alwaysListen) startVAD()
    else stopVAD()
    return () => stopVAD()
  }, [alwaysListen]) // eslint-disable-line

  // hotkeys
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); addTask() }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, []) // eslint-disable-line

  const phaseId = tweaks.timeOfDay === 'auto' ? autoPhase(now.getHours()) : tweaks.timeOfDay
  const phaseGlyph = { night: '🌙', morning: '🌅', day: '☀️', evening: '🌆' }[phaseId] || '☀️'
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  const letter = profile?.name?.[0]?.toUpperCase() || 'F'

  const nav = [
    { id:'dashboard', icon:'grid',      label:'Главная',    badge: 0 },
    { id:'tasks',     icon:'check',     label:'Задачи',     badge: pendingTasksCount },
    { id:'calendar',  icon:'calendar',  label:'Календарь',  badge: 0 },
    { id:'music',     icon:'music',     label:'Музыка',     badge: 0 },
    { id:'focus',     icon:'timer',     label:'Фокус',      badge: 0 },
    { id:'habits',    icon:'repeat',    label:'Привычки',   badge: habitsLeftCount },
    { id:'budget',    icon:'wallet',    label:'Бюджет',     badge: 0 },
    { id:'notes',     icon:'note',      label:'Заметки',    badge: 0 },
    { id:'activity',  icon:'pulse',     label:'Активность', badge: 0 },
    { id:'diary',     icon:'feather',   label:'Дневник',    badge: 0 },
    { id:'news',      icon:'newspaper', label:'Новости',    badge: 0 },
    { id:'assistant', icon:'mic',       label:'Ассистент',  badge: 0 },
    { id:'settings',  icon:'gear',      label:'Настройки',  badge: 0 },
  ]

  const user = {
    initials: letter,
    name: profile?.name || 'Профиль',
    email: profile?.email || '',
  }

  if (!done) return <Onboarding appName="Flow" />

  const ActiveScreen = SCREEN_MAP[screen] || Dashboard

  // command palette data
  const cmdActions = [
    { id: 'act-add',   label: 'Новая задача',          hint: 'создать',  icon: 'plus',   run: addTask },
    { id: 'act-focus', label: 'Запустить фокус',        hint: '25 мин',   icon: 'timer',  run: () => navigate('focus') },
    { id: 'act-note',  label: 'Быстрая заметка',        hint: 'записать', icon: 'note',   run: () => navigate('notes') },
    ...nav.map(n => ({ id: 'go-' + n.id, label: n.label, hint: 'перейти', icon: n.icon, run: () => navigate(n.id) })),
  ]

  return (
    <div className="app" data-phase={phaseId}>
      {/* фоновые блобы */}
      <div className="aura" aria-hidden="true">
        <span className="aura-blob a1" /><span className="aura-blob a2" /><span className="aura-blob a3" />
      </div>
      <div className="grain" aria-hidden="true" />

      <Sidebar nav={nav} active={screen} onNav={navigate} user={user} />

      <main className="main" style={{ position: 'relative' }}>
        {/* Dynamic Island — плавает абсолютно сверху по центру */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          WebkitAppRegion: 'no-drag',
        }}>
          <DynamicIsland onNavigate={navigate} />
        </div>

        {/* topbar */}
        <header className="topbar">
          <div className="tb-l">
            <span className="lights">
              <i style={{ background: '#ff5f57' }} onClick={() => window.jarvis?.window?.close?.()} title="Закрыть" />
              <i style={{ background: '#febc2e' }} onClick={() => window.jarvis?.window?.minimize?.()} title="Свернуть" />
              <i style={{ background: '#28c840' }} onClick={() => window.jarvis?.window?.maximize?.()} title="На весь экран" />
            </span>
            {alwaysListen && (
              <button className="listen-pill" onClick={() => navigate('assistant')} title={`Слушаю · «${wakeWord}» + команда`}>
                <span className="listen-dot" />
                Слушаю
              </button>
            )}
          </div>
          <div className="tb-c">
            <button className="clock-pill" onClick={() => setCmdOpen(true)} title="Поиск / команды">
              <span className="clock-ph">{phaseGlyph}</span>
              <span className="clock-time mono">{hh}:{mm}<span className="clock-sec">:{ss}</span></span>
            </button>
          </div>
          <div className="tb-r">
            <button className="tb-btn primary" onClick={addTask}>
              <Icon name="plus" size={14} /> Задача <kbd className="mono">^N</kbd>
            </button>
            <button className="tb-btn" onClick={() => setCmdOpen(true)}>
              <Icon name="search" size={14} /> Поиск <kbd className="mono">^K</kbd>
            </button>
            <button className="tb-btn" onClick={() => setTweaksOpen(o => !o)}>
              <Icon name="gear" size={14} /> Tweaks
            </button>
          </div>
        </header>

        {/* контент */}
        <div className="scroll" key={screen}>
          <ActiveScreen onNavigate={navigate} />
        </div>
      </main>

      {/* command palette */}
      {cmdOpen && <CommandPalette actions={cmdActions} onClose={() => setCmdOpen(false)} onNavigate={navigate} />}

      {/* toast */}
      {toast && (
        <div className="toast">
          <Icon name="check" size={15} style={{ color: 'var(--acc-text)' }} /> {toast}
        </div>
      )}

      {/* tweaks panel */}
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} tweaks={tweaks} setTweak={setTweak} />
    </div>
  )
}

/* ── Command Palette ── */
function CommandPalette({ actions, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30) }, [])

  const filt = actions.filter(a => a.label.toLowerCase().includes(q.toLowerCase()) || a.hint?.includes(q.toLowerCase()))

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filt.length - 1, s + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
      else if (e.key === 'Enter') { e.preventDefault(); const a = filt[sel]; if (a) { a.run?.(); onClose() } }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [filt, sel, onClose])

  return (
    <div className="cmd-scrim" onClick={onClose}>
      <div className="cmd" onClick={e => e.stopPropagation()}>
        <div className="cmd-top">
          <Icon name="search" size={18} style={{ color: 'var(--t-dim)' }} />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0) }} placeholder="Команда или переход…" />
          <kbd className="mono">esc</kbd>
        </div>
        <div className="cmd-list">
          {filt.length === 0 && <div className="cmd-empty">Ничего не найдено</div>}
          {filt.map((a, i) => (
            <button key={a.id} className={`cmd-item ${i === sel ? 'on' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => { a.run?.(); onClose() }}>
              <span className="cmd-ico"><Icon name={a.icon} size={16} /></span>
              <span className="cmd-label">{a.label}</span>
              <span className="cmd-hint mono">{a.hint}</span>
            </button>
          ))}
        </div>
        <div className="cmd-foot mono"><span>↑↓ выбор</span><span>⏎ открыть</span><span>esc закрыть</span></div>
      </div>
    </div>
  )
}

/* ── Tweaks Panel ── */
function TweaksPanel({ open, onClose, tweaks, setTweak }) {
  const ACCENTS = ['#7c5cff', '#2a9dff', '#3ddc84', '#ff6b3d', '#ff5d9e']
  const PHASES  = [['auto','Авто'],['morning','Утро'],['day','День'],['evening','Вечер'],['night','Ночь']]
  const DENSITY = ['compact','regular','comfy']

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={onClose} />}
      <div className={`tweaks-panel ${open ? 'open' : ''}`}>
        <div className="tweaks-head">
          <span className="tweaks-title">Tweaks</span>
          <button className="tweaks-close" onClick={onClose}>×</button>
        </div>

        <div className="tweak-section">Акцентный цвет</div>
        <div className="tweak-row">
          <span className="tweak-label">Цвет</span>
          <div className="tweak-color">
            {ACCENTS.map(c => (
              <div key={c} className={`tweak-swatch ${tweaks.accent === c ? 'on' : ''}`}
                style={{ background: c }} onClick={() => setTweak('accent', c)} />
            ))}
            <input type="color" value={tweaks.accent} onChange={e => setTweak('accent', e.target.value)}
              style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer' }} />
          </div>
        </div>

        <div className="tweak-section">Время суток</div>
        <div className="tweak-row">
          <div className="tweak-radio">
            {PHASES.map(([v, l]) => (
              <button key={v} className={`tweak-radio-btn ${tweaks.timeOfDay === v ? 'on' : ''}`} onClick={() => setTweak('timeOfDay', v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="tweak-section">Плотность</div>
        <div className="tweak-row">
          <div className="tweak-radio">
            {DENSITY.map(v => (
              <button key={v} className={`tweak-radio-btn ${tweaks.density === v ? 'on' : ''}`} onClick={() => setTweak('density', v)}>{v}</button>
            ))}
          </div>
        </div>

        <div className="tweak-section">Атмосфера</div>
        <div className="tweak-row">
          <span className="tweak-label">Движение фона</span>
          <button className={`tweak-toggle ${tweaks.motion ? 'on' : ''}`} onClick={() => setTweak('motion', !tweaks.motion)}><i /></button>
        </div>
        <div className="tweak-row">
          <span className="tweak-label">Свечение</span>
          <button className={`tweak-toggle ${tweaks.glow ? 'on' : ''}`} onClick={() => setTweak('glow', !tweaks.glow)}><i /></button>
        </div>
        <div className="tweak-row">
          <span className="tweak-label">Зернистость</span>
          <button className={`tweak-toggle ${tweaks.grain ? 'on' : ''}`} onClick={() => setTweak('grain', !tweaks.grain)}><i /></button>
        </div>
      </div>
    </>
  )
}
