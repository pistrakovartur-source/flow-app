import { useState, useMemo } from 'react'
import { useStore, uid } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'

const PRESET_HABITS = [
  { name:'Зарядка',      icon:'🏃', color:'#34d399' },
  { name:'Медитация',    icon:'🧘', color:'#a78bfa' },
  { name:'Чтение',       icon:'📚', color:'#60a5fa' },
  { name:'2л воды',      icon:'💧', color:'#38bdf8' },
  { name:'Без соцсетей', icon:'📵', color:'#f87171' },
  { name:'Прогулка',     icon:'🌿', color:'#4ade80' },
  { name:'Дневник',      icon:'✍️',  color:'#fbbf24' },
  { name:'Учёба',        icon:'🎓', color:'#f472b6' },
]

const COLORS = ['#34d399','#a78bfa','#60a5fa','#38bdf8','#f87171','#4ade80','#fbbf24','#f472b6','#fb923c','#5b8dee']

// Локальная дата YYYY-MM-DD (не UTC, чтобы не ошибиться на стыке суток)
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayStr() { return localDateStr() }

function getStreak(log, targetDays) {
  if (!log?.length) return 0
  const today = todayStr()
  const hasDayFilter = targetDays && targetDays.length > 0
  let streak = 0
  const d = new Date()
  let safety = 0
  while (safety++ < 800) {
    const key = localDateStr(d)
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1  // 0=Пн
    // День не входит в targetDays — пропускаем (серия не рвётся)
    if (hasDayFilter && !targetDays.includes(dow)) {
      d.setDate(d.getDate()-1); continue
    }
    if (!log.includes(key)) {
      // Сегодня ещё можно выполнить — не рвём серию
      if (key === today) { d.setDate(d.getDate()-1); continue }
      break
    }
    streak++
    d.setDate(d.getDate()-1)
  }
  return streak
}

function getLastN(log, n) {
  const d = new Date()
  return Array.from({ length:n }, (_, i) => {
    const dt = new Date(d); dt.setDate(d.getDate()-(n-1-i))
    const key = dt.toISOString().slice(0,10)
    return { date:key, done:(log||[]).includes(key) }
  })
}

function getLast7(log)  { return getLastN(log, 7)  }
function getLast30(log) { return getLastN(log, 30) }

function getWeekDone(log) {
  const days = getLast7(log)
  return days.filter(d => d.done).length
}

export function Habits() {
  const [habits, setHabits] = useStore('habits_v2', [])
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft]    = useState({ name:'', icon:'⭐', color:COLORS[0], weeklyTarget:7, targetDays:[] })
  const [showPresets, setPresets] = useState(false)
  const [editId, setEditId] = useState(null)

  const today = todayStr()

  const toggle = (habitId) => {
    setHabits(hs => hs.map(h => {
      if (h.id !== habitId) return h
      const log = h.log || []
      return log.includes(today)
        ? { ...h, log: log.filter(d => d !== today) }
        : { ...h, log: [...log, today] }
    }))
  }

  const remove = (id) => setHabits(hs => hs.filter(h => h.id !== id))

  const openEdit = (habit) => {
    setDraft({ name:habit.name, icon:habit.icon, color:habit.color, weeklyTarget:habit.weeklyTarget||7, targetDays:habit.targetDays||[] })
    setEditId(habit.id)
    setShowAdd(true)
  }

  const addHabit = (name, icon, color, weeklyTarget, targetDays) => {
    if (!name.trim()) return
    if (editId) {
      setHabits(hs => hs.map(h => h.id===editId ? { ...h, name:name.trim(), icon, color, weeklyTarget, targetDays } : h))
      setEditId(null)
    } else {
      setHabits(hs => [...(hs||[]), { id:uid(), name:name.trim(), icon, color, weeklyTarget, targetDays, log:[], created:todayStr() }])
    }
    setDraft({ name:'', icon:'⭐', color:COLORS[0], weeklyTarget:7, targetDays:[] })
    setShowAdd(false)
    setPresets(false)
  }

  const exportCSV = () => {
    const lines = ['Привычка,Дата,Выполнено']
    ;(habits||[]).forEach(h => {
      (h.log||[]).forEach(d => lines.push(`"${h.name}",${d},да`))
    })
    const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'habits.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const todayDone  = (habits||[]).filter(h => (h.log||[]).includes(today)).length
  const totalHab   = (habits||[]).length
  const bestStreak = (habits||[]).reduce((max, h) => Math.max(max, getStreak(h.log, h.targetDays)), 0)

  return (
    <div className="view">
      <div style={{ display:'flex', alignItems:'flex-end', gap:18, marginBottom:22 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">Ежедневно</div>
          <div className="pg-title">Привычки</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {habits?.length > 0 && (
            <button className="tb-btn" onClick={exportCSV}>
              <Icon name="note" size={14}/> Экспорт CSV
            </button>
          )}
          <button className="btn-primary" onClick={() => { setEditId(null); setDraft({ name:'', icon:'⭐', color:COLORS[0], weeklyTarget:7 }); setShowAdd(true) }}>
            <Icon name="plus" size={15}/> Добавить
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:22 }}>
        {[
          { label:'Сегодня',      val:`${todayDone}/${totalHab}`, icon:'check', color:'var(--c-calm)'         },
          { label:'Выполнено',    val:`${totalHab ? Math.round(todayDone/totalHab*100) : 0}%`, icon:'spark', color:'var(--acc-text)' },
          { label:'Лучшая серия', val:`${bestStreak}д`,           icon:'zap',   color:'#fbbf24'            },
        ].map(s => (
          <div key={s.label} className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`color-mix(in oklch,${s.color} 15%,transparent)`, display:'grid', placeItems:'center', color:s.color, flexShrink:0 }}>
              <Icon name={s.icon} size={17}/>
            </div>
            <div>
              <div style={{ fontFamily:'"Space Grotesk"', fontSize:22, fontWeight:700, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Список привычек */}
      {(!habits || habits.length === 0) ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 0', color:'var(--t-mute)' }}>
          <div style={{ fontSize:48 }}>🌱</div>
          <div style={{ fontWeight:600, fontSize:16 }}>Добавь первую привычку</div>
          <div style={{ fontSize:13.5, color:'var(--t-mute)', textAlign:'center', maxWidth:300, lineHeight:1.6 }}>
            Маленькие привычки каждый день — большие результаты через месяц.
          </div>
          <button className="btn-primary" onClick={() => { setPresets(true); setShowAdd(true) }}>
            Выбрать из пресетов
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {(habits||[]).map(h => (
            <HabitRow key={h.id} habit={h} today={today}
              onToggle={() => toggle(h.id)}
              onDelete={() => remove(h.id)}
              onEdit={() => openEdit(h)}
            />
          ))}
        </div>
      )}

      {/* Форма добавления/редактирования */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={e => e.target===e.currentTarget && (setShowAdd(false), setPresets(false), setEditId(null))}>
          <div style={{ width:460, background:'rgba(12,12,18,.96)', border:'1px solid var(--line)', borderRadius:20, padding:26, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>
              {editId ? 'Редактировать привычку' : 'Новая привычка'}
            </div>

            {/* Пресеты (только при добавлении) */}
            {showPresets && !editId && (
              <div>
                <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:8, fontFamily:'"JetBrains Mono"' }}>Быстрый выбор</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                  {PRESET_HABITS.map(p => (
                    <button key={p.name} onClick={() => addHabit(p.name, p.icon, p.color, 7, [])}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 4px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', cursor:'pointer', transition:'border-color .15s' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--acc-line)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--line)'}
                    >
                      <span style={{ fontSize:22 }}>{p.icon}</span>
                      <span style={{ fontSize:11, color:'var(--t-dim)', textAlign:'center' }}>{p.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ height:1, background:'var(--line)', margin:'12px 0' }}/>
              </div>
            )}

            {/* Иконка + название */}
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <input value={draft.icon} onChange={e=>setDraft(d=>({...d,icon:e.target.value}))}
                style={{ width:52, padding:'9px', textAlign:'center', fontSize:22, borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', outline:'none' }}/>
              <input autoFocus={!showPresets} value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}
                onKeyDown={e=>e.key==='Enter'&&addHabit(draft.name,draft.icon,draft.color,draft.weeklyTarget,draft.targetDays||[])}
                placeholder="Название привычки…"
                style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13.5, outline:'none' }}/>
            </div>

            {/* Цель на неделю */}
            <div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:8, fontFamily:'"JetBrains Mono"' }}>Цель на неделю (раз в 7 дней)</div>
              <div style={{ display:'flex', gap:6 }}>
                {[1,2,3,4,5,6,7].map(n => (
                  <button key={n} onClick={() => setDraft(d=>({...d,weeklyTarget:n}))}
                    style={{ flex:1, padding:'7px 0', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .15s',
                      borderColor: draft.weeklyTarget===n ? 'var(--acc-line)' : 'var(--line)',
                      background:  draft.weeklyTarget===n ? 'color-mix(in oklch,var(--acc) 20%,transparent)' : 'var(--surf-2)',
                      color:       draft.weeklyTarget===n ? 'var(--acc-text)' : 'var(--t-mute)',
                    }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Дни выполнения */}
            <div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:7, fontFamily:'"JetBrains Mono"' }}>Дни выполнения <span style={{ color:'var(--t-mute)' }}>(пусто = каждый день)</span></div>
              <div style={{ display:'flex', gap:4 }}>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day, i) => {
                  const active = (draft.targetDays||[]).includes(i)
                  return (
                    <button key={i} onClick={() => setDraft(d => {
                      const days = d.targetDays || []
                      return { ...d, targetDays: active ? days.filter(x => x !== i) : [...days, i] }
                    })}
                      style={{ flex:1, padding:'6px 0', borderRadius:7, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .15s',
                        borderColor: active ? 'var(--acc-line)' : 'var(--line)',
                        background:  active ? 'color-mix(in oklch,var(--acc) 20%,transparent)' : 'var(--surf-2)',
                        color:       active ? 'var(--acc-text)' : 'var(--t-mute)',
                      }}>{day}</button>
                  )
                })}
              </div>
            </div>

            {/* Цвет */}
            <div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:7, fontFamily:'"JetBrains Mono"' }}>Цвет</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setDraft(d=>({...d,color:c}))}
                    style={{ width:26, height:26, borderRadius:99, background:c, cursor:'pointer', border:draft.color===c?'2.5px solid #fff':'2.5px solid transparent', boxShadow:draft.color===c?`0 0 0 2px ${c}`:'none', transition:'all .12s' }}/>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              {!showPresets && !editId && <button className="tb-btn" style={{ fontSize:12 }} onClick={() => setPresets(true)}>Пресеты</button>}
              <button className="btn-primary" style={{ flex:1 }} onClick={() => addHabit(draft.name,draft.icon,draft.color,draft.weeklyTarget,draft.targetDays||[])}>
                {editId ? 'Сохранить' : 'Добавить'}
              </button>
              <button className="tb-btn" onClick={() => { setShowAdd(false); setPresets(false); setEditId(null) }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HabitRow({ habit, today, onToggle, onDelete, onEdit }) {
  const [hover, setHover] = useState(false)
  const [histDays, setHistDays] = useState(7)
  const done       = (habit.log||[]).includes(today)
  const streak     = getStreak(habit.log, habit.targetDays)
  const last7      = getLast7(habit.log)
  const last30     = getLast30(habit.log)
  const weekDone   = last7.filter(d=>d.done).length
  const weekTarget = habit.weeklyTarget || 7
  const onTrack    = weekDone >= weekTarget
  const histData   = histDays === 7 ? last7 : last30

  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:14, border:'1px solid', borderColor:done?`color-mix(in oklch,${habit.color} 35%,transparent)`:'var(--line)', background:done?`color-mix(in oklch,${habit.color} 8%,var(--surf-2))`:'var(--surf-2)', transition:'all .2s' }}>

      {/* Чекбокс */}
      <div onClick={onToggle}
        style={{ width:36, height:36, borderRadius:10, flexShrink:0, display:'grid', placeItems:'center', cursor:'pointer', fontSize:18, border:'2px solid', borderColor:done?habit.color:'var(--line)', background:done?habit.color:'transparent', transition:'all .2s', boxShadow:done?`0 0 14px ${habit.color}55`:'none' }}>
        {done ? '✓' : habit.icon}
      </div>

      {/* Название + статистика */}
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:14.5, color:done?habit.color:'var(--t)', transition:'color .2s' }}>{habit.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, flexWrap:'wrap' }}>
          {streak > 0 && (
            <span style={{ fontSize:11.5, fontFamily:'"JetBrains Mono"', color:'#fbbf24' }}>🔥 {streak} дн.</span>
          )}
          {/* Трекер с переключением 7/30 дней */}
          <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
            {histData.map((d, i) => (
              <div key={i} title={d.date}
                style={{ width: histDays===30 ? 10 : 14, height: histDays===30 ? 10 : 14, borderRadius: histDays===30 ? 3 : 4, background:d.done?habit.color:'var(--surf-hi)', opacity:d.done?1:0.4, transition:'background .2s', boxShadow:d.done?`0 0 6px ${habit.color}66`:'none' }}/>
            ))}
          </div>
          {/* Переключатель 7д/30д */}
          <button onClick={() => setHistDays(h => h===7 ? 30 : 7)}
            style={{ fontFamily:'"JetBrains Mono"', fontSize:10, color:'var(--t-mute)', background:'var(--surf-hi)', border:'1px solid var(--line)', borderRadius:5, padding:'1px 6px', cursor:'pointer' }}>
            {histDays}д
          </button>
          {/* Цель на неделю */}
          <span style={{ fontSize:11, fontFamily:'"JetBrains Mono"', color: onTrack ? habit.color : 'var(--t-mute)' }}>
            {weekDone}/{weekTarget} нед.{onTrack ? ' ✓' : ''}
          </span>
        </div>
      </div>

      {/* Действия */}
      <div style={{ display:'flex', gap:4, opacity:hover?1:0, transition:'opacity .15s' }}>
        <button onClick={onEdit}   style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }}><Icon name="edit"  size={13}/></button>
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }}><Icon name="trash" size={14}/></button>
      </div>
    </div>
  )
}
