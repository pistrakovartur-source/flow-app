import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore, Store } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'

const SOUNDS = [
  { id:'none',  label:'Без звука' },
  { id:'beep',  label:'Сигнал'   },
  { id:'bell',  label:'Колокол'  },
  { id:'chime', label:'Звон'     },
]

const POM_PRESETS = [
  { id:'25/5',  work:25, brk:5,  label:'25 / 5'  },
  { id:'50/10', work:50, brk:10, label:'50 / 10' },
  { id:'90/15', work:90, brk:15, label:'90 / 15' },
]

function todayKey() { return new Date().toISOString().slice(0, 10) }

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function playSound(type) {
  if (type === 'none') return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const play = (freq, start, dur, gain = 0.35) => {
      const osc = ctx.createOscillator()
      const gn  = ctx.createGain()
      osc.connect(gn); gn.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = type === 'beep' ? 'square' : 'sine'
      gn.gain.setValueAtTime(gain, ctx.currentTime + start)
      gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }
    if (type === 'beep')  { play(880,0,.15); play(880,.2,.15); play(1100,.4,.25) }
    if (type === 'bell')  { play(523,0,.8,.4); play(659,.1,.6,.2); play(784,.2,.9,.2) }
    if (type === 'chime') { [523,659,784,1047].forEach((f,i) => play(f,i*.15,.5,.25)) }
  } catch {}
}

export function Focus() {
  const [stats,    setStats]    = useStore('focus_stats', { sessions:0, totalMinutes:0, today:'', todaySessions:0, todayMinutes:0 })
  const [history,  setHistory]  = useStore('focus_history', {})
  const [weeklyGoal, setWeeklyGoal] = useStore('focus_weekly_goal', 10)
  const [tasks]  = useStore('tasks', [])

  const [soundId,   setSoundId]   = useState('beep')
  const [running,   setRunning]   = useState(false)
  const [elapsed,   setElapsed]   = useState(0)   // секунды
  const [sessions,  setSessions]  = useState(0)
  const [focusTask, setFocusTask] = useState('')
  const intervalRef = useRef(null)

  // ── Pomodoro ─────────────────────────────────────────────────────────────
  const [pomMode,   setPomMode]   = useState(false)
  const [pomPreset, setPomPreset] = useState(POM_PRESETS[0])   // {work, brk, label}
  const [pomPhase,  setPomPhase]  = useState('work')           // 'work' | 'break'
  const [pomCount,  setPomCount]  = useState(0)                // завершённых помодоро
  const [pomLeft,   setPomLeft]   = useState(POM_PRESETS[0].work * 60) // секунд осталось
  const pomIntervalRef = useRef(null)

  const pendingTasks = (tasks||[]).filter(t => !t.done)

  // Восстанавливаем состояние при монтировании (переход обратно на вкладку)
  useEffect(() => {
    const live = Store.get('focus_live', null)
    if (!live) return
    if (live.running && live.startedAt) {
      const secs = Math.floor((Date.now() - live.startedAt) / 1000)
      setElapsed(Math.max(0, secs))
      setRunning(true)
    } else if (live.elapsed) {
      setElapsed(live.elapsed)
    }
  }, [])

  // Секундомер
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  // Синхронизация с Dynamic Island
  useEffect(() => {
    Store.set('focus_live', running
      ? { running:true,  modeId:'work', startedAt:Date.now() - elapsed*1000, totalSeconds: elapsed + 3600 }
      : { running:false, modeId:'work', elapsed, totalSeconds: elapsed + 3600 }
    )
  }, [running])

  const saveSession = useCallback((secs) => {
    if (secs < 5) return  // слишком короткая сессия — не сохраняем
    const mins = Math.round(secs / 60) || 1
    playSound(soundId)
    setSessions(s => s + 1)
    const today = todayKey()
    setStats(s => {
      const isToday = s.today === today
      return {
        sessions:      (s.sessions||0) + 1,
        totalMinutes:  (s.totalMinutes||0) + mins,
        today,
        todaySessions: isToday ? (s.todaySessions||0) + 1 : 1,
        todayMinutes:  isToday ? (s.todayMinutes||0) + mins : mins,
      }
    })
    setHistory(h => {
      const prev = h[today] || { sessions:0, minutes:0 }
      return { ...h, [today]: { sessions: prev.sessions+1, minutes: prev.minutes+mins } }
    })
  }, [soundId, setStats, setHistory])

  const start = () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    Store.set('focus_live', { running:true, modeId:'work', startedAt:Date.now()-elapsed*1000, totalSeconds: elapsed+3600 })
    setRunning(true)
  }

  const pause = () => {
    Store.set('focus_live', { running:false, modeId:'work', elapsed, totalSeconds: elapsed+3600 })
    setRunning(false)
  }

  const stop = () => {
    setRunning(false)
    clearInterval(intervalRef.current)
    saveSession(elapsed)
    setElapsed(0)
    Store.set('focus_live', { running:false, modeId:'work', elapsed:0, totalSeconds:3600 })
  }

  // ── Pomodoro: тик каждую секунду ─────────────────────────────────────────
  useEffect(() => {
    if (!pomMode) return
    if (running) {
      pomIntervalRef.current = setInterval(() => {
        setPomLeft(prev => {
          if (prev <= 1) {
            // Фаза закончилась
            clearInterval(pomIntervalRef.current)
            setRunning(false)
            if (pomPhase === 'work') {
              // Завершили работу — сохраняем сессию и уходим на перерыв
              saveSession(pomPreset.work * 60)
              setPomCount(c => c + 1)
              setPomPhase('break')
              setPomLeft(pomPreset.brk * 60)
              playSound(soundId)
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('🍅 Время работы вышло!', { body: `Сделай перерыв ${pomPreset.brk} минут`, silent: false })
              }
            } else {
              // Перерыв закончился — возвращаемся к работе
              setPomPhase('work')
              setPomLeft(pomPreset.work * 60)
              playSound(soundId)
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('☕ Перерыв закончился', { body: 'Пора снова сосредоточиться!', silent: false })
              }
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(pomIntervalRef.current)
    }
    return () => clearInterval(pomIntervalRef.current)
  }, [running, pomMode, pomPhase, pomPreset, soundId, saveSession])

  // Сбросить Pomodoro при смене пресета
  const applyPomPreset = (preset) => {
    setRunning(false)
    clearInterval(pomIntervalRef.current)
    setPomPreset(preset)
    setPomPhase('work')
    setPomLeft(preset.work * 60)
    setPomCount(0)
  }

  const pomReset = () => {
    setRunning(false)
    clearInterval(pomIntervalRef.current)
    setPomPhase('work')
    setPomLeft(pomPreset.work * 60)
  }

  const switchMode = (toPomodoro) => {
    setRunning(false)
    clearInterval(intervalRef.current)
    clearInterval(pomIntervalRef.current)
    setElapsed(0)
    setPomPhase('work')
    setPomLeft(pomPreset.work * 60)
    setPomCount(0)
    setPomMode(toPomodoro)
  }

  // Keyboard: Space = старт/пауза, S = стоп и сохранить, R = сброс без сохранения
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      if (e.code === 'Space') { e.preventDefault(); running ? pause() : start() }
      if (e.code === 'KeyS' && running) stop()
      if (e.code === 'KeyR') { setRunning(false); setElapsed(0) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [running, elapsed])

  const today     = todayKey()
  const isToday   = stats?.today === today
  const todaySess = isToday ? (stats?.todaySessions||0) : 0
  const todayMins = isToday ? (stats?.todayMinutes||0)  : 0

  const thisWeekSessions = useMemo(() => {
    const now = new Date()
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now); monday.setDate(now.getDate()-dow); monday.setHours(0,0,0,0)
    let total = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate()+i)
      if (d > now) break
      total += (history[d.toISOString().slice(0,10)]?.sessions || 0)
    }
    return total
  }, [history])

  const historyDays = useMemo(() => {
    const days = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate()-i)
      const key = d.toISOString().slice(0,10)
      const val = history[key] || { sessions:0, minutes:0 }
      days.push({ key, sessions:val.sessions, minutes:val.minutes, day:d.toLocaleDateString('ru-RU',{weekday:'short'}) })
    }
    return days
  }, [history])
  const maxSessions = Math.max(...historyDays.map(d=>d.sessions), 1)

  // Кольцо: 1 оборот = 60 секунд (как секундная стрелка)
  const R    = 100
  const circ = 2 * Math.PI * R
  const secPct = (elapsed % 60) / 60
  const dash = circ * secPct

  const color = running ? 'var(--acc)' : elapsed > 0 ? '#fbbf24' : 'var(--surf-hi)'

  // Данные для кольца Pomodoro
  const pomTotal = (pomPhase === 'work' ? pomPreset.work : pomPreset.brk) * 60
  const pomPct   = pomTotal > 0 ? (pomTotal - pomLeft) / pomTotal : 0
  const pomColor = pomPhase === 'work' ? 'var(--acc)' : '#34d399'

  return (
    <div className="view">
      <div style={{ display:'flex', alignItems:'flex-end', gap:16, marginBottom:28 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">Продуктивность</div>
          <div className="pg-title" style={{ marginBottom:0 }}>Фокус</div>
        </div>
        {/* Переключатель режимов */}
        <div style={{ display:'flex', borderRadius:10, border:'1px solid var(--line)', overflow:'hidden' }}>
          <button onClick={() => switchMode(false)}
            style={{ padding:'7px 18px', fontSize:12.5, fontWeight:600, border:'none', cursor:'pointer', transition:'all .15s',
              background: !pomMode ? 'var(--acc)' : 'transparent',
              color:      !pomMode ? '#fff' : 'var(--t-mute)' }}>
            ⏱ Секундомер
          </button>
          <button onClick={() => switchMode(true)}
            style={{ padding:'7px 18px', fontSize:12.5, fontWeight:600, border:'none', cursor:'pointer', transition:'all .15s',
              background: pomMode ? 'var(--acc)' : 'transparent',
              color:      pomMode ? '#fff' : 'var(--t-mute)' }}>
            🍅 Pomodoro
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:24 }}>

        {/* ── Секундомер / Pomodoro ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:28 }}>

          {/* Кольцо */}
          <div style={{ position:'relative', width:280, height:280 }}>
            <svg width="280" height="280" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surf-hi)" strokeWidth="8"/>
              {pomMode ? (
                <circle cx="140" cy="140" r={R} fill="none" stroke={pomColor} strokeWidth="8"
                  strokeDasharray={`${circ * pomPct} ${circ}`} strokeLinecap="round"
                  style={{ transition: running ? 'stroke-dasharray 1s linear' : 'none', filter: running ? `drop-shadow(0 0 10px ${pomColor})` : 'none' }}
                />
              ) : (
                <circle cx="140" cy="140" r={R} fill="none" stroke={color} strokeWidth="8"
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                  style={{ transition: running ? 'stroke-dasharray 1s linear' : 'none', filter: running ? `drop-shadow(0 0 10px color-mix(in oklch, var(--acc) 40%, transparent))` : 'none' }}
                />
              )}
            </svg>

            {/* Время */}
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
              {pomMode ? (<>
                <div style={{ fontSize:11, fontFamily:'"JetBrains Mono"', color: pomPhase==='work' ? 'var(--acc-text)' : '#34d399', letterSpacing:'.08em', fontWeight:700 }}>
                  {pomPhase === 'work' ? 'РАБОТА' : 'ПЕРЕРЫВ'}
                </div>
                <div style={{ fontFamily:'"Space Grotesk"', fontSize:54, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1, color: pomPhase==='work' ? 'var(--acc)' : '#34d399', fontVariantNumeric:'tabular-nums' }}>
                  {fmtElapsed(pomLeft)}
                </div>
                {pomCount > 0 && (
                  <div style={{ fontSize:13, color:'var(--t-mute)' }}>{'🍅'.repeat(Math.min(pomCount, 8))}</div>
                )}
                {!running && pomLeft === (pomPhase==='work' ? pomPreset.work : pomPreset.brk) * 60 && (
                  <div style={{ fontSize:12, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>нажми ▶ чтобы начать</div>
                )}
              </>) : (<>
                <div style={{ fontFamily:'"Space Grotesk"', fontSize: elapsed >= 3600 ? 42 : 54, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1, color: running ? 'var(--acc)' : elapsed > 0 ? 'var(--t)' : 'var(--t-mute)', fontVariantNumeric:'tabular-nums' }}>
                  {fmtElapsed(elapsed)}
                </div>
                {sessions > 0 && (
                  <div style={{ fontSize:13, color:'var(--t-mute)' }}>🔥 {sessions} {sessions===1?'сессия':sessions<5?'сессии':'сессий'}</div>
                )}
                {!running && elapsed === 0 && (
                  <div style={{ fontSize:12, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>нажми ▶ чтобы начать</div>
                )}
              </>)}
            </div>
          </div>

          {/* Пресеты Pomodoro */}
          {pomMode && (
            <div style={{ display:'flex', gap:6 }}>
              {POM_PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPomPreset(p)}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .15s',
                    borderColor: pomPreset.id===p.id ? 'var(--acc-line)' : 'var(--line)',
                    background:  pomPreset.id===p.id ? 'color-mix(in oklch,var(--acc) 15%,transparent)' : 'var(--surf-2)',
                    color:       pomPreset.id===p.id ? 'var(--acc-text)' : 'var(--t-mute)',
                  }}>{p.label}</button>
              ))}
            </div>
          )}

          {/* Кнопки */}
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            {pomMode ? (<>
              {/* Сброс Pomodoro */}
              <button onClick={pomReset} title="Сброс"
                style={{ width:48, height:48, borderRadius:13, border:'1px solid var(--line)', background:'var(--surf-2)', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', transition:'all .15s' }}>
                <Icon name="repeat" size={18}/>
              </button>
              {/* Старт / Пауза */}
              <button onClick={() => setRunning(r => !r)} title={running ? 'Пауза (Space)' : 'Старт (Space)'}
                style={{ width:80, height:80, borderRadius:22, border:'none', cursor:'pointer', fontSize:28, display:'grid', placeItems:'center', background: pomPhase==='work' ? 'var(--acc)' : '#059669', color:'#fff', boxShadow:`0 6px 24px ${pomPhase==='work' ? 'color-mix(in oklch, var(--acc) 40%, transparent)' : 'rgba(5,150,105,.4)'}`, transition:'transform .1s' }}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                {running ? '⏸' : '▶'}
              </button>
              {/* Пропустить фазу */}
              <button onClick={() => { setRunning(false); if(pomPhase==='work'){saveSession(pomPreset.work*60);setPomCount(c=>c+1);setPomPhase('break');setPomLeft(pomPreset.brk*60)}else{setPomPhase('work');setPomLeft(pomPreset.work*60)} }}
                title="Пропустить фазу" style={{ width:48, height:48, borderRadius:13, border:'1px solid var(--line)', background:'var(--surf-2)', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', transition:'all .15s' }}>
                ⏭
              </button>
            </>) : (<>
              {/* Сброс без сохранения */}
              <button onClick={() => { setRunning(false); setElapsed(0) }} disabled={elapsed === 0} title="Сброс (R)"
                style={{ width:48, height:48, borderRadius:13, border:'1px solid var(--line)', background:'var(--surf-2)', cursor: elapsed===0 ? 'default' : 'pointer', color: elapsed===0 ? 'var(--t-mute)' : 'var(--t-mute)', display:'grid', placeItems:'center', transition:'all .15s', opacity: elapsed===0 ? 0.4 : 1 }}>
                <Icon name="repeat" size={18}/>
              </button>
              {/* Старт / Пауза */}
              <button onClick={running ? pause : start} title={running ? 'Пауза (Space)' : 'Старт (Space)'}
                style={{ width:80, height:80, borderRadius:22, border:'none', cursor:'pointer', fontSize:28, display:'grid', placeItems:'center', background:'var(--acc)', color:'#fff', boxShadow:'0 6px 24px color-mix(in oklch, var(--acc) 40%, transparent)', transition:'transform .1s' }}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                {running ? '⏸' : '▶'}
              </button>
              {/* Стоп — сохранить сессию */}
              <button onClick={stop} disabled={elapsed < 5} title="Стоп и сохранить (S)"
                style={{ width:48, height:48, borderRadius:13, border:'1px solid var(--line)', background:'var(--surf-2)', cursor: elapsed<5 ? 'default' : 'pointer', color: elapsed<5 ? 'var(--t-mute)' : '#f87171', display:'grid', placeItems:'center', transition:'all .15s', opacity: elapsed<5 ? 0.4 : 1 }}>
                <Icon name="check" size={18}/>
              </button>
            </>)}
          </div>

          <div style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', textAlign:'center', lineHeight:1.7 }}>
            {pomMode
              ? 'Space — пауза/старт &nbsp;·&nbsp; ⏭ — пропустить фазу'
              : 'Space — пауза/старт &nbsp;·&nbsp; ✓ — остановить и сохранить &nbsp;·&nbsp; R — сброс'}
          </div>

          {/* На чём сосредоточен */}
          <div style={{ width:'100%', maxWidth:380 }}>
            <div style={{ fontSize:12, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>На чём сосредоточен</div>
            {pendingTasks.length > 0 ? (
              <select value={focusTask} onChange={e=>setFocusTask(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13.5, outline:'none', cursor:'pointer' }}>
                <option value="">— Свободная сессия —</option>
                {pendingTasks.map(t => <option key={t.id} value={t.id}>{t.text}</option>)}
              </select>
            ) : (
              <input value={focusTask} onChange={e=>setFocusTask(e.target.value)} placeholder="Напиши, над чем работаешь…"
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13.5, outline:'none', boxSizing:'border-box' }}/>
            )}
          </div>

          {/* Звук */}
          <div style={{ width:'100%', maxWidth:380 }}>
            <div style={{ fontSize:12, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Звук при остановке</div>
            <div style={{ display:'flex', gap:6 }}>
              {SOUNDS.map(s => (
                <button key={s.id} onClick={() => { setSoundId(s.id); if(s.id!=='none') playSound(s.id) }}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, transition:'all .15s',
                    borderColor: soundId===s.id ? 'var(--acc-line)' : 'var(--line)',
                    background:  soundId===s.id ? 'color-mix(in oklch,var(--acc) 15%,transparent)' : 'var(--surf-2)',
                    color:       soundId===s.id ? 'var(--acc-text)' : 'var(--t-mute)',
                  }}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Статистика ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          <div className="card">
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:14 }}>Сегодня</div>
            <StatRow icon="timer" label="Сессий"       value={todaySess} color="var(--acc-text)"/>
            <div style={{ height:1, background:'var(--line)', margin:'10px 0' }}/>
            <StatRow icon="clock" label="Минут фокуса" value={todayMins} color="#fbbf24"/>
          </div>

          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14 }}>Эта неделя</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:11, color:'var(--t-mute)' }}>цель:</span>
                <input type="number" min={1} max={50} value={weeklyGoal}
                  onChange={e => setWeeklyGoal(Math.max(1, parseInt(e.target.value)||1))}
                  style={{ width:44, padding:'3px 6px', borderRadius:7, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:12, outline:'none', textAlign:'center' }}
                />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:13, color:'var(--t-dim)' }}>Сессий</span>
              <span style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:20 }}>
                {thisWeekSessions}<span style={{ fontSize:13, color:'var(--t-mute)', fontWeight:400 }}>/{weeklyGoal}</span>
              </span>
            </div>
            <div style={{ height:6, borderRadius:99, background:'var(--surf-hi)' }}>
              <div style={{ height:'100%', borderRadius:99, background:'#fbbf24', width:`${Math.min(thisWeekSessions/weeklyGoal*100,100)}%`, transition:'width .4s ease' }}/>
            </div>
          </div>

          <div className="card">
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:14 }}>Всего</div>
            <StatRow icon="spark" label="Сессий"       value={stats?.sessions||0}                             color="var(--acc-text)"/>
            <div style={{ height:1, background:'var(--line)', margin:'10px 0' }}/>
            <StatRow icon="zap"   label="Часов фокуса" value={Math.round((stats?.totalMinutes||0)/60*10)/10} color="#a78bfa"/>
          </div>

          <div className="card">
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:13, marginBottom:12 }}>История (7 дней)</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:52 }}>
              {historyDays.map(d => (
                <div key={d.key} title={`${d.day}: ${d.sessions} сессий, ${d.minutes} мин`}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ width:'100%', borderRadius:'3px 3px 0 0', background: d.sessions>0?'var(--acc)':'var(--surf-hi)', height:`${Math.max((d.sessions/maxSessions)*44,d.sessions>0?4:2)}px`, transition:'height .4s ease', opacity:d.sessions>0?0.85:0.3 }}/>
                  <div style={{ fontSize:9, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>{d.day.slice(0,2)}</div>
                </div>
              ))}
            </div>
          </div>

          {sessions > 0 && (
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:36 }}>🔥</div>
              <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:22, marginTop:4 }}>{sessions}</div>
              <div style={{ fontSize:13, color:'var(--t-mute)', marginTop:2 }}>
                {sessions===1?'сессия':sessions<5?'сессии':'сессий'} за сегодня
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatRow({ icon, label, value, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:32, height:32, borderRadius:9, background:`color-mix(in oklch,${color} 15%,transparent)`, display:'grid', placeItems:'center', color, flexShrink:0 }}>
        <Icon name={icon} size={15}/>
      </div>
      <div style={{ flex:1, fontSize:13, color:'var(--t-dim)' }}>{label}</div>
      <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:20 }}>{value}</div>
    </div>
  )
}
