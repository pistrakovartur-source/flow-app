import { useState, useMemo } from 'react'
import { useStore, uid } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Segmented } from '../components/UIKit'

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MONTHS   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const COLORS   = ['#5b8dee','#f87171','#fbbf24','#34d399','#a78bfa','#f472b6','#60a5fa','#fb923c']
const HOUR_H   = 48  // px per hour in week view

function ymd(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function Calendar() {
  const [events, setEvents] = useStore('calendar_events', [])
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [selected, setSelected] = useState(ymd(new Date()))
  const [view, setView]   = useState('month') // 'month' | 'week'
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft]   = useState(emptyDraft())
  const [editId, setEditId] = useState(null)
  const [deleteRecurring, setDeleteRecurring] = useState(null) // { ev, all }

  const todayStr = ymd(new Date())

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1) }
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1) }

  const prevWeek = () => {
    const d = new Date(selected + 'T00:00:00'); d.setDate(d.getDate()-7)
    setSelected(ymd(d))
  }
  const nextWeek = () => {
    const d = new Date(selected + 'T00:00:00'); d.setDate(d.getDate()+7)
    setSelected(ymd(d))
  }

  // Неделя для week-view
  const weekDays = useMemo(() => {
    const base = new Date(selected + 'T00:00:00')
    let dow = base.getDay() - 1; if (dow < 0) dow = 6
    const monday = new Date(base)
    monday.setDate(base.getDate() - dow)
    return Array.from({length:7}, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      const iso = ymd(d)
      return { iso, d:d.getDate(), dow:i, isToday: iso === todayStr }
    })
  }, [selected, todayStr])

  // Сетка месяца
  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    let dow = first.getDay() - 1; if(dow<0) dow=6
    const daysInMonth = new Date(year, month+1, 0).getDate()
    const daysInPrev  = new Date(year, month, 0).getDate()
    const grid = []
    for(let i=dow-1; i>=0; i--) grid.push({ d: daysInPrev-i, cur:false, date:null })
    for(let d=1; d<=daysInMonth; d++) {
      const date = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      grid.push({ d, cur:true, date })
    }
    const rem = 42 - grid.length
    for(let d=1; d<=rem; d++) grid.push({ d, cur:false, date:null })
    return grid
  }, [year, month])

  // Карта событий (с генерацией recurring)
  const eventsMap = useMemo(() => {
    const m = {}
    const add = (date, ev) => { if (!m[date]) m[date] = []; m[date].push(ev) }

    ;(events||[]).forEach(ev => {
      add(ev.date, ev)
      if (ev.repeat && ev.repeat !== 'none') {
        const end = ev.repeatEnd ? new Date(ev.repeatEnd + 'T00:00:00') : new Date(year, month+3, 0)
        const d = new Date(ev.date + 'T00:00:00')
        let safety = 0
        while (safety++ < 400) {
          if (ev.repeat === 'daily')   d.setDate(d.getDate()+1)
          else if (ev.repeat === 'weekly')  d.setDate(d.getDate()+7)
          else if (ev.repeat === 'monthly') d.setMonth(d.getMonth()+1)
          if (d > end) break
          const iso = ymd(d)
          add(iso, { ...ev, date:iso, _recurring:true })
        }
      }
    })
    return m
  }, [events, year, month])

  const selectedEvents = useMemo(() =>
    (eventsMap[selected]||[]).sort((a,b)=>(a.allDay?'00':a.time||'').localeCompare(b.allDay?'00':b.time||'')),
    [eventsMap, selected])

  const openAdd = (date = selected, time = '', allDay = false) => {
    setDraft({ ...emptyDraft(), color:COLORS[0], time, allDay })
    setEditId(null)
    setShowForm(true)
    if (date !== selected) setSelected(date)
  }

  const openEdit = (ev) => {
    setDraft({ title:ev.title, time:ev.time||'', endTime:ev.endTime||'', color:ev.color||COLORS[0], desc:ev.desc||'', allDay:!!ev.allDay, repeat:ev.repeat||'none', repeatEnd:ev.repeatEnd||'' })
    setEditId(ev._recurring ? null : ev.id)
    setShowForm(true)
    if (ev._recurring) setEditId(ev.id) // still store base id
  }

  const save = () => {
    if (!draft.title.trim()) return
    if (editId) {
      setEvents(evs => evs.map(e => e.id===editId ? {...e, ...draft, title:draft.title.trim()} : e))
    } else {
      setEvents(evs => [...(evs||[]), { id:uid(), date:selected, ...draft, title:draft.title.trim() }])
    }
    setShowForm(false)
  }

  const remove = (ev) => {
    if (ev._recurring) {
      setDeleteRecurring(ev)
    } else {
      setEvents(evs => evs.filter(e => e.id !== ev.id))
    }
  }

  const confirmDeleteRecurring = (all) => {
    if (all) {
      setEvents(evs => evs.filter(e => e.id !== deleteRecurring.id))
    }
    setDeleteRecurring(null)
  }

  // Ближайшие события (30 дней)
  const upcoming = useMemo(() => {
    const today = todayStr
    return (events||[])
      .filter(e => e.date >= today)
      .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
      .slice(0, 10)
  }, [events, todayStr])

  return (
    <div className="view">
      <PageHeader icon="calendar" eyebrow="КАЛЕНДАРЬ" title={`${MONTHS[month]} ${year}`}
        sub="Выбери день, чтобы увидеть расписание и события."
        right={
          <div className="row-r">
            <Segmented value={view} options={[['month','Месяц'],['week','Неделя']]} onChange={setView} />
            <div className="month-nav">
              {view === 'month' ? (
                <>
                  <button onClick={prevMonth}><Icon name="arrow" size={15} style={{ transform:'rotate(180deg)' }}/></button>
                  <button onClick={nextMonth}><Icon name="arrow" size={15}/></button>
                </>
              ) : (
                <>
                  <button onClick={prevWeek}><Icon name="arrow" size={15} style={{ transform:'rotate(180deg)' }}/></button>
                  <button onClick={nextWeek}><Icon name="arrow" size={15}/></button>
                </>
              )}
            </div>
            <button className="btn-primary" onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); setSelected(todayStr) }} style={{ padding:'8px 14px' }}>Сегодня</button>
            <button className="btn-primary" onClick={openAdd}><Icon name="plus" size={15}/> Событие</button>
          </div>
        } />

      {view === 'month' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
          {/* Сетка месяца */}
          <div>
            {/* Дни недели */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:11.5, fontFamily:'"JetBrains Mono"', color:'var(--t-mute)', padding:'4px 0' }}>{d}</div>
              ))}
            </div>
            {/* Ячейки */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
              {days.map((cell, i) => {
                const evs = cell.date ? (eventsMap[cell.date]||[]) : []
                const isToday   = cell.date === todayStr
                const isSelected = cell.date === selected
                return (
                  <div key={i} onClick={() => cell.date && setSelected(cell.date)}
                    style={{ minHeight:72, borderRadius:10, border:'1px solid', padding:'7px 8px', cursor:cell.date?'pointer':'default', transition:'all .15s',
                      borderColor: isSelected ? 'var(--acc-line)' : isToday ? 'var(--acc)' : 'var(--line)',
                      background:  isSelected ? 'color-mix(in oklch,var(--acc) 12%,transparent)' : isToday ? 'color-mix(in oklch,var(--acc) 6%,transparent)' : 'var(--surf-2)',
                      opacity: cell.cur ? 1 : 0.3,
                    }}>
                    <div style={{ fontWeight: isToday ? 700 : 500, fontSize:13.5, color: isToday ? 'var(--acc)' : 'var(--t)', marginBottom:4 }}>
                      {cell.d}
                    </div>
                    {evs.slice(0,3).map((ev, idx) => (
                      <div key={idx} style={{ fontSize:10.5, borderRadius:4, padding:'2px 5px', marginBottom:2, background:ev.color||'var(--acc)', color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500, opacity: ev._recurring ? 0.85 : 1 }}>
                        {ev.allDay ? '◆ ' : (ev.time ? ev.time+' ' : '')}{ev.title}
                      </div>
                    ))}
                    {evs.length > 3 && <div style={{ fontSize:10, color:'var(--t-mute)' }}>+{evs.length-3}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Боковая панель */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:16 }}>{fmtSelectedDate(selected)}</div>
                  <div style={{ fontSize:12, color:'var(--t-mute)', marginTop:2 }}>{selectedEvents.length} событий</div>
                </div>
                <button className="btn-primary" style={{ fontSize:12, padding:'6px 13px' }} onClick={() => openAdd(selected)}>
                  <Icon name="plus" size={13}/> Добавить
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--t-mute)' }}>
                  <Icon name="calendar" size={28} style={{ opacity:.2, display:'block', margin:'0 auto 8px' }}/>
                  <div style={{ fontSize:13 }}>Событий нет</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {selectedEvents.map((ev, idx) => (
                    <EventRow key={idx} ev={ev} onEdit={() => openEdit(ev)} onDelete={() => remove(ev)} />
                  ))}
                </div>
              )}
            </div>

            {upcoming.length > 0 && (
              <div className="card">
                <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:12 }}>Ближайшие</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {upcoming.map(ev => (
                    <div key={ev.id} onClick={() => setSelected(ev.date)}
                      style={{ display:'flex', gap:10, cursor:'pointer', padding:'6px 8px', borderRadius:9, transition:'background .12s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surf-2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ width:3, borderRadius:99, background:ev.color||'var(--acc)', flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{ev.title}</div>
                        <div style={{ fontSize:11, color:'var(--t-mute)', marginTop:2, fontFamily:'"JetBrains Mono"' }}>
                          {fmtDate(ev.date)}{ev.time && ` · ${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ''}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'week' && (
        <WeekView
          weekDays={weekDays}
          eventsMap={eventsMap}
          todayStr={todayStr}
          onCellClick={(date, time) => openAdd(date, time, !time)}
          onEditEvent={openEdit}
          onDeleteEvent={remove}
        />
      )}

      {/* Форма события */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ width:460, maxHeight:'88vh', overflowY:'auto', background:'var(--surf)', border:'1px solid var(--line)', borderRadius:20, padding:26, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>
              {editId ? 'Редактировать событие' : `Событие — ${fmtSelectedDate(selected)}`}
            </div>

            <input autoFocus value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&save()} placeholder="Название события…" style={inp}/>

            <textarea value={draft.desc} onChange={e=>setDraft(d=>({...d,desc:e.target.value}))}
              placeholder="Описание (необязательно)…" style={{...inp, minHeight:60, resize:'vertical'}}/>

            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--t-dim)' }}>
              <input type="checkbox" checked={draft.allDay} onChange={e=>setDraft(d=>({...d,allDay:e.target.checked, time:'', endTime:''}))}/>
              Весь день
            </label>

            {!draft.allDay && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Начало</div>
                  <input type="time" value={draft.time} onChange={e=>setDraft(d=>({...d,time:e.target.value}))} style={inp}/>
                </div>
                <div>
                  <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Конец</div>
                  <input type="time" value={draft.endTime||''} onChange={e=>setDraft(d=>({...d,endTime:e.target.value}))} style={inp}/>
                </div>
              </div>
            )}

            {/* Повтор */}
            <div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Повтор</div>
              <select value={draft.repeat||'none'} onChange={e=>setDraft(d=>({...d,repeat:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                <option value="none">Без повтора</option>
                <option value="daily">Ежедневно</option>
                <option value="weekly">Еженедельно</option>
                <option value="monthly">Ежемесячно</option>
              </select>
            </div>
            {draft.repeat && draft.repeat !== 'none' && (
              <div>
                <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Конец повтора (необязательно)</div>
                <input type="date" value={draft.repeatEnd||''} onChange={e=>setDraft(d=>({...d,repeatEnd:e.target.value}))} style={inp}/>
              </div>
            )}

            <div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:8, fontFamily:'"JetBrains Mono"' }}>Цвет</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setDraft(d=>({...d,color:c}))}
                    style={{ width:26, height:26, borderRadius:99, background:c, cursor:'pointer', border: draft.color===c ? '2px solid #fff' : '2px solid transparent', boxShadow: draft.color===c ? `0 0 0 2px ${c}` : 'none', transition:'all .15s' }}/>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={save}>
                {editId ? 'Сохранить' : 'Добавить'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог удаления повторяющегося события */}
      {deleteRecurring && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:'var(--surf)', border:'1px solid var(--line)', borderRadius:16, padding:'24px 28px', display:'flex', flexDirection:'column', gap:16, minWidth:320 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:16 }}>Удалить повторяющееся событие?</div>
            <div style={{ fontSize:13.5, color:'var(--t-mute)' }}>Это событие повторяется. Удалить все повторения?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn" style={{ flex:1, borderColor:'rgba(251,113,133,.4)', color:'#fb7185', background:'rgba(251,113,133,.07)' }} onClick={() => confirmDeleteRecurring(true)}>Все повторения</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setDeleteRecurring(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Недельный вид ─────────────────────────────────────────────────────────────

function WeekView({ weekDays, eventsMap, todayStr, onCellClick, onEditEvent, onDeleteEvent }) {
  const HOURS = Array.from({length:24}, (_, h) => h)

  return (
    <div className="card" style={{ overflow:'hidden' }}>
      {/* Заголовки дней */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--line)' }}>
        <div style={{ width:52, flexShrink:0 }}/>
        {weekDays.map(day => (
          <div key={day.iso} style={{ flex:1, textAlign:'center', padding:'8px 4px', borderLeft:'1px solid var(--line)', background: day.isToday ? 'color-mix(in oklch,var(--acc) 6%,transparent)' : 'transparent', cursor:'pointer' }}
            onClick={() => onCellClick(day.iso, '')}>
            <div style={{ fontSize:10.5, color: day.isToday ? 'var(--acc)' : 'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>{WEEKDAYS[day.dow]}</div>
            <div style={{ fontSize:20, fontWeight:700, color: day.isToday ? 'var(--acc)' : 'var(--t)', lineHeight:1.2 }}>{day.d}</div>
          </div>
        ))}
      </div>

      {/* All-day события */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--line)', minHeight:30 }}>
        <div style={{ width:52, flexShrink:0, fontSize:9, color:'var(--t-mute)', textAlign:'right', paddingRight:6, paddingTop:8, lineHeight:1.3 }}>весь<br/>день</div>
        {weekDays.map(day => {
          const allDayEvs = (eventsMap[day.iso]||[]).filter(ev => ev.allDay)
          return (
            <div key={day.iso} style={{ flex:1, borderLeft:'1px solid var(--line)', padding:'3px 2px', display:'flex', flexDirection:'column', gap:2 }}>
              {allDayEvs.map((ev, idx) => (
                <div key={idx} onClick={() => onEditEvent(ev)}
                  style={{ fontSize:10.5, padding:'2px 5px', borderRadius:4, background:ev.color||'var(--acc)', color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', opacity: ev._recurring ? 0.85 : 1 }}>
                  {ev.title}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Временная сетка */}
      <div style={{ display:'flex', overflowY:'auto', maxHeight:560 }}>
        {/* Метки часов */}
        <div style={{ width:52, flexShrink:0 }}>
          {HOURS.map(h => (
            <div key={h} style={{ height:HOUR_H, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:8, paddingTop:4 }}>
              <span style={{ fontSize:9.5, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>
                {String(h).padStart(2,'0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Колонки дней */}
        {weekDays.map(day => {
          const timedEvs = (eventsMap[day.iso]||[]).filter(ev => !ev.allDay && ev.time)
          return (
            <div key={day.iso} style={{ flex:1, borderLeft:'1px solid var(--line)', position:'relative', height: HOUR_H * 24 }}>
              {/* Часовые строки (кликабельные) */}
              {HOURS.map(h => (
                <div key={h}
                  onClick={() => onCellClick(day.iso, `${String(h).padStart(2,'0')}:00`)}
                  style={{ position:'absolute', top:h*HOUR_H, left:0, right:0, height:HOUR_H, borderTop: h > 0 ? '1px solid var(--line)' : 'none', cursor:'pointer', boxSizing:'border-box' }}
                  onMouseEnter={e => e.currentTarget.style.background='color-mix(in oklch,var(--acc) 5%,transparent)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                />
              ))}

              {/* События */}
              {timedEvs.map((ev, idx) => {
                const [h, m] = (ev.time||'00:00').split(':').map(Number)
                const top = (h + m/60) * HOUR_H
                let height = HOUR_H
                if (ev.endTime) {
                  const [eh, em] = ev.endTime.split(':').map(Number)
                  height = Math.max(((eh*60+em) - (h*60+m)) / 60 * HOUR_H, 22)
                }
                return (
                  <div key={idx} onClick={() => onEditEvent(ev)}
                    style={{ position:'absolute', top, left:2, right:2, height, borderRadius:6, background:ev.color||'var(--acc)', color:'#fff', fontSize:10.5, padding:'3px 6px', cursor:'pointer', overflow:'hidden', zIndex:2, boxShadow:'0 2px 8px rgba(0,0,0,.25)', opacity: ev._recurring ? 0.85 : 1 }}>
                    <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {ev.time}{ev.endTime ? `–${ev.endTime}` : ''} {ev.title}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({ ev, onEdit, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'var(--surf-2)', border:'1px solid var(--line)' }}>
      <div style={{ width:3, height:36, borderRadius:99, background:ev.color||'var(--acc)', flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:13.5 }}>
          {ev.title}
          {ev._recurring && <span style={{ fontSize:10, color:'var(--t-mute)', marginLeft:5, fontFamily:'"JetBrains Mono"' }}>↻</span>}
        </div>
        {(ev.time || ev.allDay) && (
          <div style={{ fontSize:11.5, color:'var(--t-mute)', marginTop:2, fontFamily:'"JetBrains Mono"' }}>
            {ev.allDay ? 'Весь день' : `${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ''}`}
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:2, opacity: hover ? 1 : 0, transition:'opacity .15s' }}>
        <button onClick={onEdit}   style={iconBtn}><Icon name="edit"  size={13}/></button>
        <button onClick={onDelete} style={iconBtn}><Icon name="trash" size={13}/></button>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyDraft() {
  return { title:'', time:'', endTime:'', color:COLORS[0], desc:'', allDay:false, repeat:'none', repeatEnd:'' }
}

function fmtSelectedDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' })
  } catch { return iso }
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    const today = ymd(new Date())
    const tomorrow = ymd(new Date(Date.now() + 86400000))
    if (iso === today) return 'Сегодня'
    if (iso === tomorrow) return 'Завтра'
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })
  } catch { return iso }
}

const navBtn  = { background:'var(--surf-2)', border:'1px solid var(--line)', borderRadius:9, cursor:'pointer', color:'var(--t)', display:'grid', placeItems:'center', width:34, height:34 }
const iconBtn = { background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }
const inp     = { width:'100%', padding:'9px 12px', background:'var(--surf-2)', border:'1px solid var(--line)', borderRadius:10, color:'var(--t)', fontFamily:'"Hanken Grotesk"', fontSize:13.5, outline:'none', boxSizing:'border-box' }
