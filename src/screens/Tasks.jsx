import { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react'
import { useStore, uid } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Segmented, StatPill } from '../components/UIKit'
import { TASK_TAGS, PRIORITY, REPEAT_LABELS } from '../constants'
import { LearnPanel } from '../components/LearnPanel'

const FILTERS  = [
  { id:'all',      label:'Все'      },
  { id:'today',    label:'Сегодня'  },
  { id:'pending',  label:'Активные' },
  { id:'done',     label:'Выполнено'},
]

function todayStr() { return new Date().toISOString().slice(0, 10) }

export function Tasks({ onNavigate }) {
  const [tasks, setTasks] = useStore('tasks', [])
  // Сохраняем фильтры в Store — не сбрасываются при смене вкладки
  const [filter,    setFilter]    = useStore('tasks_filter',    'all')
  const [tagFilter, setTagFilter] = useStore('tasks_tag_filter','Все теги')
  const [search, setSearch] = useState('')
  // Дефер поиска — не пересчитываем список на каждый символ
  const deferredSearch = useDeferredValue(search)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [editId, setEditId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [hintsFor, setHintsFor] = useState(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // DnD
  const dragId = useRef(null)

  const toggle = id => setTasks(ts => {
    const task = ts.find(t => t.id === id)
    if (!task) return ts
    const nowDone = !task.done
    if (nowDone && task.repeat && task.repeat !== 'none' && task.date) {
      const nextDate = computeNextRepeatDate(task.date, task.repeat)
      const alreadyExists = ts.some(t => t.text === task.text && t.date === nextDate && !t.done)
      if (!alreadyExists) {
        return [...ts.map(t => t.id===id ? {...t, done:true} : t),
          { ...task, id:uid(), done:false, created:Date.now(), date:nextDate }]
      }
    }
    return ts.map(t => t.id===id ? {...t, done:!t.done} : t)
  })
  const remove   = id => setTasks(ts => ts.filter(t => t.id!==id))

  const bulkComplete = () => {
    setTasks(ts => ts.map(t => selected.has(t.id) ? { ...t, done:true } : t))
    setSelected(new Set()); setBulkMode(false)
  }
  const bulkDelete = () => {
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); return }
    setTasks(ts => ts.filter(t => !selected.has(t.id)))
    setSelected(new Set()); setBulkMode(false); setBulkDeleteConfirm(false)
  }
  const toggleSelect = id => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const openAdd  = () => { setDraft(emptyDraft()); setEditId(null); setShowForm(true) }

  // Ctrl+N — открыть форму добавления задачи
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        const tag = document.activeElement?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return
        e.preventDefault()
        if (!showForm) openAdd()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showForm])

  const openEdit = (task) => {
    setDraft({
      text:     task.text,
      tag:      task.tag||'Личное',
      time:     task.time||'',
      date:     task.date||'',
      priority: task.priority||'mid',
      note:     task.note||'',
      repeat:   task.repeat||'none',
      subtasks: task.subtasks||[],
    })
    setEditId(task.id)
    setShowForm(true)
  }

  const save = () => {
    if (!draft.text.trim()) return
    const isNew = !editId
    const taskText = draft.text.trim()
    if (editId) {
      setTasks(ts => ts.map(t => t.id===editId ? {...t, ...draft, text:taskText} : t))
    } else {
      setTasks(ts => [...ts, { id:uid(), ...draft, text:taskText, done:false, created:Date.now() }])
    }
    setShowForm(false)
    setEditId(null)
    if (isNew) setHintsFor({ text: taskText, tag: draft.tag, date: draft.date })
  }

  // Subtask helpers
  const toggleSubtask = (taskId, stId) => {
    setTasks(ts => ts.map(t => t.id!==taskId ? t : {
      ...t, subtasks: (t.subtasks||[]).map(s => s.id===stId ? {...s, done:!s.done} : s)
    }))
  }
  const removeSubtask = (taskId, stId) => {
    setTasks(ts => ts.map(t => t.id!==taskId ? t : {
      ...t, subtasks: (t.subtasks||[]).filter(s => s.id!==stId)
    }))
  }

  // DnD handlers
  const onDragStart = (id) => { dragId.current = id }
  const onDrop      = (id) => {
    if (!dragId.current || dragId.current === id) return
    setTasks(ts => {
      const from = ts.findIndex(t => t.id === dragId.current)
      const to   = ts.findIndex(t => t.id === id)
      if (from < 0 || to < 0) return ts
      const next = [...ts]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    dragId.current = null
  }

  const filtered = useMemo(() => {
    let list = tasks || []
    if (filter === 'today')   list = list.filter(t => t.date === todayStr())
    if (filter === 'pending') list = list.filter(t => !t.done)
    if (filter === 'done')    list = list.filter(t => t.done)
    if (tagFilter !== 'Все теги') list = list.filter(t => t.tag === tagFilter)
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase()
      list = list.filter(t => t.text.toLowerCase().includes(q) || (t.note||'').toLowerCase().includes(q))
    }
    return list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const po = { high:0, mid:1, low:2 }
      return (po[a.priority]||1) - (po[b.priority]||1)
    })
  }, [tasks, filter, tagFilter, deferredSearch])

  const stats = useMemo(() => {
    const all  = (tasks||[]).length
    const done = (tasks||[]).filter(t=>t.done).length
    return { all, done, pending: all - done }
  }, [tasks])

  return (
    <div className="view">
      <PageHeader icon="check" eyebrow="ЗАДАЧИ" title="Доска задач"
        sub="Управляй задачами, устанавливай приоритеты и отслеживай прогресс."
        right={
          <div className="row-r">
            <StatPill icon="check" value={`${stats.done}/${stats.all}`} label="готово" tone="var(--c-cool)" />
            <button className="btn-primary" onClick={() => { setBulkMode(b => !b); setSelected(new Set()) }} style={{ background: bulkMode ? 'var(--surf-2)' : undefined, border: bulkMode ? '1px solid var(--line)' : undefined, color: bulkMode ? 'var(--t)' : undefined, boxShadow: 'none' }}>
              {bulkMode ? 'Отмена' : 'Выбрать'}
            </button>
            <button className="btn-primary" onClick={openAdd}>
              <Icon name="plus" size={15}/> Новая задача
            </button>
          </div>
        } />

      {/* Фильтры + поиск */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <Segmented value={filter} options={FILTERS.map(f => [f.id, f.label])} onChange={setFilter} />
        <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf)', color:'var(--t)', fontSize:12.5, cursor:'pointer', outline:'none', fontFamily:'inherit' }}>
          {['Все теги', ...TASK_TAGS].map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="search-box" style={{ flex:1, minWidth:140 }}>
          <Icon name="search" size={14}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск…" />
        </div>
      </div>

      {/* Список задач */}
      {filtered.length === 0 ? (
        <div className="empty-big">
          <Icon name="check" size={40} style={{ opacity:.15 }}/>
          <div style={{ fontWeight:600, fontSize:15 }}>Задач нет</div>
          <button className="btn-primary" onClick={openAdd}><Icon name="plus" size={14}/> Добавить</button>
        </div>
      ) : (
        <div className="card" style={{ padding:8 }}>
          <div className="tlist">
            {filtered.map(task => (
              <TaskCard key={task.id} task={task}
                onToggle={() => toggle(task.id)}
                onDelete={() => remove(task.id)}
                onEdit={() => openEdit(task)}
                expanded={expandedId === task.id}
                onExpand={() => setExpandedId(id => id===task.id ? null : task.id)}
                onToggleSub={(stId) => toggleSubtask(task.id, stId)}
                onDeleteSub={(stId) => removeSubtask(task.id, stId)}
                onDragStart={() => onDragStart(task.id)}
                onDrop={() => onDrop(task.id)}
                bulkMode={bulkMode}
                selected={selected.has(task.id)}
                onSelect={() => toggleSelect(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Панель массовых действий */}
      {bulkMode && selected.size > 0 && (
        <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', gap:10, padding:'12px 20px', background:'rgba(12,12,18,.96)', border:'1px solid var(--acc-line)', borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,.5)', zIndex:200, alignItems:'center' }}>
          {bulkDeleteConfirm ? (
            <>
              <span style={{ fontSize:13, color:'#f87171', fontWeight:600 }}>Удалить {selected.size} задач?</span>
              <button className="btn" style={{ fontSize:13, borderColor:'rgba(248,113,113,.5)', color:'#f87171', background:'rgba(248,113,113,.12)' }} onClick={bulkDelete}>
                Да, удалить
              </button>
              <button className="btn btn-ghost" style={{ fontSize:13 }} onClick={() => setBulkDeleteConfirm(false)}>
                Отмена
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize:13, color:'var(--t-mute)' }}>Выбрано: {selected.size}</span>
              <button className="btn btn-ghost" style={{ fontSize:13 }} onClick={bulkComplete}>
                <Icon name="check" size={14}/> Выполнить ({selected.size})
              </button>
              <button className="btn" style={{ fontSize:13, borderColor:'rgba(248,113,113,.4)', color:'#f87171', background:'rgba(248,113,113,.07)' }} onClick={bulkDelete}>
                <Icon name="trash" size={14}/> Удалить ({selected.size})
              </button>
            </>
          )}
        </div>
      )}

      {/* Форма добавления/редактирования */}
      {showForm && (
        <TaskForm
          draft={draft}
          setDraft={setDraft}
          editId={editId}
          onSave={save}
          onClose={() => { setShowForm(false); setEditId(null) }}
        />
      )}

      {/* Панель подсказок */}
      {hintsFor && (
        <TaskAssistantPanel
          task={hintsFor}
          onClose={() => setHintsFor(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

// ── Форма задачи ──────────────────────────────────────────────────────────────

function TaskForm({ draft, setDraft, editId, onSave, onClose }) {
  const [stInput, setStInput] = useState('')
  const [nameError, setNameError] = useState(false)

  const handleSave = () => {
    if (!draft.text.trim()) { setNameError(true); return }
    onSave()
  }

  const addSubtask = () => {
    if (!stInput.trim()) return
    setDraft(d => ({ ...d, subtasks: [...(d.subtasks||[]), { id:uid(), text:stInput.trim(), done:false }] }))
    setStInput('')
  }
  const removeSubtask = (id) => setDraft(d => ({ ...d, subtasks: (d.subtasks||[]).filter(s => s.id!==id) }))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ width:500, maxHeight:'86vh', overflowY:'auto', background:'rgba(12,12,18,.96)', border:'1px solid var(--line)', borderRadius:20, padding:28, display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>
          {editId ? 'Редактировать задачу' : 'Новая задача'}
        </div>

        <div>
          <input autoFocus value={draft.text}
            onChange={e=>{ setDraft(d=>({...d,text:e.target.value})); setNameError(false) }}
            onKeyDown={e=>e.key==='Enter'&&handleSave()}
            placeholder="Название задачи…"
            style={{...inp, borderColor: nameError ? '#f87171' : 'var(--line)'}}/>
          {nameError && <div style={{ color:'#f87171', fontSize:12, marginTop:4 }}>Введите название задачи</div>}
        </div>

        <textarea value={draft.note} onChange={e=>setDraft(d=>({...d,note:e.target.value}))}
          placeholder="Описание (необязательно)…"
          style={{...inp, minHeight:68, resize:'vertical'}}/>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={lbl}>Дата</div>
            <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} style={inp}/>
          </div>
          <div>
            <div style={lbl}>Время</div>
            <input type="time" value={draft.time} onChange={e=>setDraft(d=>({...d,time:e.target.value}))} style={inp}/>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={lbl}>Тег</div>
            <select value={draft.tag} onChange={e=>setDraft(d=>({...d,tag:e.target.value}))} style={{...inp,cursor:'pointer'}}>
              {TASK_TAGS.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Повтор</div>
            <select value={draft.repeat||'none'} onChange={e=>setDraft(d=>({...d,repeat:e.target.value}))} style={{...inp,cursor:'pointer'}}>
              {Object.entries(REPEAT_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div style={lbl}>Приоритет</div>
          <div style={{ display:'flex', gap:6 }}>
            {[['high','Высокий'],['mid','Средний'],['low','Низкий']].map(([v,l])=>(
              <button key={v} onClick={()=>setDraft(d=>({...d,priority:v}))}
                style={{ flex:1, padding:'7px 0', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12,
                  borderColor: draft.priority===v ? PRIORITY[v] : 'var(--line)',
                  background:  draft.priority===v ? `color-mix(in oklch,${PRIORITY[v]} 18%,transparent)` : 'var(--surf-2)',
                  color:       draft.priority===v ? PRIORITY[v] : 'var(--t-mute)',
                }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Подзадачи */}
        <div>
          <div style={lbl}>Подзадачи</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:8 }}>
            {(draft.subtasks||[]).map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'var(--surf-2)', border:'1px solid var(--line)' }}>
                <div onClick={() => setDraft(d => ({ ...d, subtasks: (d.subtasks||[]).map(x => x.id===s.id?{...x,done:!x.done}:x) }))}
                  style={{ width:18, height:18, borderRadius:5, flexShrink:0, display:'grid', placeItems:'center', cursor:'pointer', border:s.done?'none':'1.5px solid var(--line-2)', background:s.done?'var(--acc)':'transparent' }}>
                  {s.done && <Icon name="check" size={11} style={{color:'#fff'}}/>}
                </div>
                <span style={{ flex:1, fontSize:13, textDecoration:s.done?'line-through':'none', color:s.done?'var(--t-mute)':'var(--t)' }}>{s.text}</span>
                <button onClick={() => removeSubtask(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center' }}>
                  <Icon name="x" size={12}/>
                </button>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={stInput} onChange={e=>setStInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSubtask()}
              placeholder="Добавить подзадачу…" style={{...inp, flex:1}}/>
            <button className="btn btn-ghost" style={{ padding:'8px 12px' }} onClick={addSubtask}>
              <Icon name="plus" size={14}/>
            </button>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave}>
            {editId ? 'Сохранить' : 'Добавить'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ── Карточка задачи ───────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onDelete, onEdit, expanded, onExpand, onToggleSub, onDeleteSub, onDragStart, onDrop, bulkMode, selected, onSelect }) {
  const [hover, setHover] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const pColor = PRIORITY[task.priority] || PRIORITY.mid
  const subtasks = task.subtasks || []
  const stDone = subtasks.filter(s=>s.done).length
  const isOverdue = !task.done && task.date && task.date < todayStr()

  return (
    <div
      draggable={!bulkMode}
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop() }}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{ display:'flex', flexDirection:'column', borderRadius:13, border:`1px solid ${dragOver ? 'var(--acc-line)' : isOverdue ? '#f8717166' : selected ? 'var(--acc-line)' : 'var(--line)'}`, background: task.done ? 'transparent' : 'var(--surf-2)', transition:'all .15s', opacity:task.done?0.5:1, cursor:'default', boxShadow: dragOver ? '0 0 0 2px var(--acc-soft)' : selected ? '0 0 0 2px var(--acc-soft)' : 'none' }}
    >
      {/* Основная строка */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:13, padding:'13px 15px' }}>
        {/* DnD ручка / bulk чекбокс */}
        {bulkMode ? (
          <div onClick={onSelect}
            style={{ width:20, height:20, borderRadius:5, flexShrink:0, marginTop:2, display:'grid', placeItems:'center', cursor:'pointer', border: selected ? 'none' : '1.5px solid var(--line-2)', background: selected ? 'var(--acc)' : 'transparent', transition:'all .15s' }}>
            {selected && <Icon name="check" size={12} style={{ color:'#fff' }}/>}
          </div>
        ) : (
          <div style={{ marginTop:3, cursor:'grab', color:'var(--t-mute)', opacity: hover ? 0.6 : 0, transition:'opacity .15s', flexShrink:0 }}>
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
              <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
              <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
            </svg>
          </div>
        )}

        {/* Чекбокс */}
        <div onClick={onToggle} style={{ width:22, height:22, borderRadius:7, flexShrink:0, marginTop:1, display:'grid', placeItems:'center', cursor:'pointer', border:task.done?'none':'1.5px solid var(--line-2)', background:task.done?'var(--acc)':'transparent' }}>
          {task.done && <Icon name="check" size={13} style={{ color:'#fff' }}/>}
        </div>

        {/* Приоритет-полоска */}
        <div style={{ width:3, height:22, borderRadius:99, flexShrink:0, marginTop:1, background:task.done?'var(--surf-hi)':pColor, opacity:task.done?0.3:1 }}/>

        {/* Контент */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:14, lineHeight:1.35, textDecoration:task.done?'line-through':'none' }}>{task.text}</div>
          {task.note && <div style={{ fontSize:12.5, color:'var(--t-mute)', marginTop:3, lineHeight:1.4 }}>{task.note}</div>}
          <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
            {task.tag  && <span className="pill" style={{ fontSize:11 }}>{task.tag}</span>}
            {task.date && <span style={{ fontFamily:'"JetBrains Mono"', fontSize:11, color: isOverdue ? '#f87171' : 'var(--t-mute)', fontWeight: isOverdue ? 600 : 400 }}>{isOverdue ? '⚠ ' : ''}{fmtDate(task.date)}</span>}
            {task.time && task.time !== '--:--' && <span style={{ fontFamily:'"JetBrains Mono"', fontSize:11, color:'var(--acc-text)' }}>{task.time}</span>}
            {task.repeat && task.repeat !== 'none' && (
              <span style={{ display:'flex', alignItems:'center', gap:4, fontFamily:'"JetBrains Mono"', fontSize:10.5, color:'#a78bfa' }}>
                <Icon name="repeat" size={11}/> {REPEAT_LABELS[task.repeat]}
              </span>
            )}
            {subtasks.length > 0 && (
              <span style={{ fontFamily:'"JetBrains Mono"', fontSize:10.5, color:'var(--t-mute)' }}>
                {stDone}/{subtasks.length} подзадач
              </span>
            )}
          </div>
          {/* Прогресс подзадач */}
          {subtasks.length > 0 && (
            <div style={{ height:3, borderRadius:99, background:'var(--surf-hi)', marginTop:6 }}>
              <div style={{ height:'100%', borderRadius:99, background:'var(--acc)', width:`${(stDone/subtasks.length)*100}%`, transition:'width .3s' }}/>
            </div>
          )}
        </div>

        {/* Действия */}
        <div style={{ display:'flex', gap:4, opacity:hover?1:0, transition:'opacity .15s' }}>
          {subtasks.length > 0 && (
            <button onClick={onExpand} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4, transform: expanded ? 'rotate(90deg)' : 'none', transition:'transform .2s' }}>
              <Icon name="chevron" size={14}/>
            </button>
          )}
          <button onClick={onEdit}   style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }}><Icon name="edit"  size={14}/></button>
          <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }}><Icon name="trash" size={14}/></button>
        </div>
      </div>

      {/* Подзадачи — расширяемый блок */}
      {expanded && subtasks.length > 0 && (
        <div style={{ padding:'0 15px 12px 52px', display:'flex', flexDirection:'column', gap:5 }}>
          {subtasks.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div onClick={() => onToggleSub(s.id)}
                style={{ width:17, height:17, borderRadius:4, flexShrink:0, display:'grid', placeItems:'center', cursor:'pointer', border:s.done?'none':'1.5px solid var(--line-2)', background:s.done?'var(--acc)':'transparent' }}>
                {s.done && <Icon name="check" size={10} style={{ color:'#fff' }}/>}
              </div>
              <span style={{ flex:1, fontSize:12.5, textDecoration:s.done?'line-through':'none', color:s.done?'var(--t-mute)':'var(--t-dim)' }}>{s.text}</span>
              <button onClick={() => onDeleteSub(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', opacity:.5 }}>
                <Icon name="x" size={11}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function computeNextRepeatDate(dateStr, repeat) {
  const d = new Date(dateStr + 'T00:00:00')
  if (repeat === 'daily')   d.setDate(d.getDate()+1)
  if (repeat === 'weekly')  d.setDate(d.getDate()+7)
  if (repeat === 'monthly') d.setMonth(d.getMonth()+1)
  if (repeat === 'workdays') {
    do { d.setDate(d.getDate()+1) } while ([0,6].includes(d.getDay()))
  }
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    const today = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
    if (d.getTime() === today.getTime()) return 'Сегодня'
    if (d.getTime() === tomorrow.getTime()) return 'Завтра'
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })
  } catch { return iso }
}

function emptyDraft() {
  return { text:'', tag:'Личное', time:'', date:new Date().toISOString().slice(0,10), priority:'mid', note:'', repeat:'none', subtasks:[] }
}

const inp = { width:'100%', padding:'9px 12px', background:'var(--surf-2)', border:'1px solid var(--line)', borderRadius:10, color:'var(--t)', fontFamily:'"Hanken Grotesk"', fontSize:13.5, outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }

// ── Умные действия: что предложить по задаче ──────────────────────────────────
function buildActions(task, onNavigate, onClose) {
  const lower = task.text.toLowerCase()
  const actions = []

  const isWork    = ['Работа','Учёба'].includes(task.tag) || /написать|сделать|изучить|выучить|создать|разработать|подготовить|прочитать|составить|сдать/.test(lower)
  const isBudget  = ['Финансы','Покупки'].includes(task.tag) || /купить|оплатить|заплатить|расход|счёт|бюджет|деньги|стоит/.test(lower)
  const isHabit   = ['Здоровье','Спорт'].includes(task.tag) || /каждый|ежедн|регулярно|привычка|тренировк|бегать|заниматься/.test(lower)
  const isMeeting = /встреча|созвон|переговоры|презентация|конференция/.test(lower)
  const isNotes   = /заметк|записать|конспект|набросок/.test(lower)

  if (isWork || (!isBudget && !isHabit)) {
    actions.push({ label:'Запустить Фокус', sub:'Pomodoro-таймер', icon:'timer', primary:true,
      action: () => { onNavigate('focus'); onClose() } })
  }
  if (task.date || isMeeting) {
    actions.push({ label:'Открыть Календарь', sub:'Посмотреть на дате', icon:'calendar', primary:false,
      action: () => { onNavigate('calendar'); onClose() } })
  }
  if (isBudget) {
    actions.push({ label:'Открыть Бюджет', sub:'Записать расход', icon:'tag', primary:true,
      action: () => { onNavigate('budget'); onClose() } })
  }
  if (isHabit) {
    actions.push({ label:'Добавить в Привычки', sub:'Отслеживать регулярно', icon:'repeat', primary:!isWork,
      action: () => { onNavigate('habits'); onClose() } })
  }
  if (isNotes) {
    actions.push({ label:'Открыть Заметки', sub:'Создать заметку по теме', icon:'note', primary:false,
      action: () => { onNavigate('notes'); onClose() } })
  }

  // Всегда — поиск в сети
  actions.push({ label:'Найти в интернете', sub:'Открыть в браузере', icon:'search', primary:false,
    action: () => window.jarvis?.openUrl?.(`https://duckduckgo.com/?q=${encodeURIComponent(task.text)}`) })

  return actions.slice(0, 4)
}

// ── Локальные советы ──────────────────────────────────────────────────────────
const TIPS_BY_TAG = {
  'Учёба':    ['Pomodoro: 25 мин фокуса → 5 мин отдыха', 'Интервальное повторение: через 1, 3 и 7 дней', 'Записывай тезисы сразу — помогает запомнить'],
  'Работа':   ['Разбей на подзадачи — так проще начать', 'Сделай самое сложное первым («лягушка»)', 'Установи чёткий дедлайн и добавь в Календарь'],
  'Здоровье': ['Маленький шаг каждый день важнее рывка', 'Добавь в Привычки — так не забудешь', 'Запланируй конкретное время в Календаре'],
  'Спорт':    ['Начни с минимума: 10–15 минут в день', 'Отмечай прогресс в Привычках', 'Измеряй результат — мотивирует продолжать'],
  'Личное':   ['Запланируй конкретное время выполнения', 'Если задача большая — добавь подзадачи', 'Поставь напоминание в Календаре'],
  'Покупки':  ['Сравни цены на нескольких площадках', 'Добавь в корзину и подожди день — часто скидки', 'Зафиксируй трату в Бюджете'],
  'Финансы':  ['Запиши расход прямо сейчас в Бюджете', 'Раздели на обязательные и необязательные', 'Проверь: не превышаешь ли месячный лимит'],
}
const TIPS_BY_KEYWORD = [
  { words:['написать','отчёт','текст','статью','документ'], tips:['Начни с outline — структура ускоряет написание', 'Пиши черновик без правок, редактируй потом', '25 минут без отвлечений — один блок Pomodoro'] },
  { words:['выучить','изучить','освоить','курс','язык'],    tips:['20–30 мин в день стабильно > редкие марафоны', 'Практикуй сразу — знание без применения исчезает', 'Запусти Pomodoro в разделе Фокус'] },
  { words:['починить','ремонт','исправить','настроить'],    tips:['Найди видеоинструкцию — экономит 80% времени', 'Подготовь инструменты заранее', 'Сфотографируй «до» — поможет при сборке обратно'] },
  { words:['встреча','созвон','переговоры','презентация'],  tips:['Подготовь повестку и список вопросов', 'Установи чёткое время окончания', 'Добавь в Календарь с напоминанием'] },
  { words:['купить','заказать','приобрести'],               tips:['Проверь отзывы перед покупкой', 'Сравни на нескольких сайтах', 'Запиши трату в Бюджет после покупки'] },
]

function getTips(text, tag) {
  const lower = text.toLowerCase()
  for (const { words, tips } of TIPS_BY_KEYWORD)
    if (words.some(w => lower.includes(w))) return tips
  return TIPS_BY_TAG[tag] || TIPS_BY_TAG['Личное']
}

// ── Панель-ассистент ──────────────────────────────────────────────────────────
function TaskAssistantPanel({ task, onClose, onNavigate }) {
  const [webStatus, setWebStatus] = useState('idle')
  const [webResults, setWebResults] = useState([])
  const [webOpen, setWebOpen] = useState(false)
  const [showLearn, setShowLearn] = useState(false)
  const actions = buildActions(task, onNavigate, onClose)
  const tips    = getTips(task.text, task.tag)

  const loadWeb = () => {
    if (webStatus !== 'idle') return
    setWebStatus('loading')
    setWebOpen(true)
    if (!window.jarvis?.web?.search) { setWebStatus('offline'); return }
    window.jarvis.web.search({ query: `${task.text} как выполнить пошагово`, maxResults: 5 })
      .then(d => { setWebResults(d?.results?.filter(r => r.snippet) || []); setWebStatus('done') })
      .catch(() => setWebStatus('error'))
  }

  return (
    <div style={{ position:'fixed', right:24, bottom:24, width:380, maxHeight:580, background:'rgba(12,12,18,.96)', border:'1px solid var(--acc-line)', borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,.65)', display:'flex', flexDirection:'column', zIndex:500, animation:'slideUpIn .22s ease', overflow:'hidden' }}>

      {/* ── Шапка ── */}
      <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--c-calm)', boxShadow:'0 0 6px var(--c-calm)' }}/>
            <span style={{ fontSize:10.5, color:'var(--c-calm)', fontFamily:'"JetBrains Mono"', letterSpacing:'.05em', fontWeight:600 }}>ЗАДАЧА ДОБАВЛЕНА</span>
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--t)', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {task.text}
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4, flexShrink:0, borderRadius:7 }}>
          <Icon name="x" size={15}/>
        </button>
      </div>

      {/* ── Чем помочь? ── */}
      <div style={{ padding:'13px 16px 14px', borderBottom:'1px solid var(--line)' }}>
        <div style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', marginBottom:10, letterSpacing:'.04em' }}>
          ЧЕМ ПОМОЧЬ?
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {actions.map((a, i) => (
            <button key={i} onClick={a.action}
              style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:3, padding:'10px 12px', borderRadius:12, border:`1px solid ${a.primary ? 'var(--acc-line)' : 'var(--line)'}`, background: a.primary ? 'color-mix(in oklch,var(--acc) 12%,transparent)' : 'var(--surf-2)', cursor:'pointer', textAlign:'left', transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--acc-line)'; e.currentTarget.style.background='color-mix(in oklch,var(--acc) 14%,transparent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = a.primary ? 'var(--acc-line)' : 'var(--line)'; e.currentTarget.style.background = a.primary ? 'color-mix(in oklch,var(--acc) 12%,transparent)' : 'var(--surf-2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Icon name={a.icon} size={13} style={{ color: a.primary ? 'var(--acc-text)' : 'var(--t-mute)' }}/>
                <span style={{ fontSize:12.5, fontWeight:600, color: a.primary ? 'var(--acc-text)' : 'var(--t)' }}>{a.label}</span>
              </div>
              <span style={{ fontSize:11, color:'var(--t-mute)', lineHeight:1.3 }}>{a.sub}</span>
            </button>
          ))}

          {/* Кнопка «Найти материалы для изучения» */}
          <button onClick={() => setShowLearn(true)}
            style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:3, padding:'10px 12px', borderRadius:12, border:'1px solid var(--line)', background:'var(--surf-2)', cursor:'pointer', textAlign:'left', transition:'all .15s', gridColumn: actions.length % 2 === 0 ? '1 / -1' : undefined }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--acc-line)'; e.currentTarget.style.background='color-mix(in oklch,var(--acc) 12%,transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--line)'; e.currentTarget.style.background='var(--surf-2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13 }}>📚</span>
              <span style={{ fontSize:12.5, fontWeight:600, color:'var(--t)' }}>Найти материалы</span>
            </div>
            <span style={{ fontSize:11, color:'var(--t-mute)', lineHeight:1.3 }}>YouTube, курсы, книги, статьи</span>
          </button>
        </div>
      </div>

      {/* ── Прокручиваемая область: советы + веб ── */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* Советы */}
        <div style={{ padding:'11px 16px 12px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ fontSize:10.5, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', marginBottom:8, letterSpacing:'.04em' }}>СОВЕТЫ</div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                <div style={{ width:15, height:15, borderRadius:4, background:'var(--surf-hi)', border:'1px solid var(--line-2)', display:'grid', placeItems:'center', flexShrink:0, marginTop:1 }}>
                  <span style={{ fontSize:8, color:'var(--t-mute)', fontWeight:700, fontFamily:'"JetBrains Mono"' }}>{i+1}</span>
                </div>
                <span style={{ fontSize:12, color:'var(--t-dim)', lineHeight:1.5 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Веб-поиск — раскрывается по кнопке */}
        <div>
          <button onClick={loadWeb} disabled={webStatus==='loading'}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'none', border:'none', cursor: webStatus==='loading' ? 'default' : 'pointer', borderBottom: webOpen ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontSize:10.5, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>ИЗ ИНТЕРНЕТА</span>
            <span style={{ display:'flex', alignItems:'center', gap:6 }}>
              {webStatus === 'loading' && (
                <div style={{ width:11, height:11, border:'1.5px solid var(--acc)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
              )}
              {webStatus === 'idle' && <span style={{ fontSize:11, color:'var(--acc-text)', fontFamily:'"JetBrains Mono"' }}>Загрузить ↓</span>}
              {webStatus === 'done' && <span style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>{webResults.length} результатов</span>}
            </span>
          </button>

          {webOpen && webStatus === 'done' && webResults.length === 0 && (
            <div style={{ padding:'10px 16px', fontSize:12, color:'var(--t-mute)', fontStyle:'italic' }}>Ничего не найдено</div>
          )}
          {webOpen && (webStatus === 'error' || webStatus === 'offline') && (
            <div style={{ padding:'10px 16px', fontSize:12, color:'var(--t-mute)', fontStyle:'italic' }}>Не удалось загрузить</div>
          )}
          {webOpen && webStatus === 'done' && webResults.map((r, i) => (
            <div key={i} onClick={() => r.url && window.jarvis?.openUrl?.(r.url)}
              style={{ padding:'9px 16px', borderBottom: i < webResults.length-1 ? '1px solid var(--line)' : 'none', cursor: r.url ? 'pointer' : 'default' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                <span style={{ fontSize:12.5, fontWeight:600, color: r.url ? 'var(--acc-text)' : 'var(--t)', lineHeight:1.3, flex:1 }}>{r.title}</span>
                {r.url && <span style={{ fontSize:11, color:'var(--t-mute)', flexShrink:0, marginTop:1 }}>↗</span>}
              </div>
              {r.snippet && (
                <div style={{ fontSize:11.5, color:'var(--t-mute)', marginTop:3, lineHeight:1.45 }}>
                  {r.snippet.length > 130 ? r.snippet.slice(0, 130)+'…' : r.snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Подвал ── */}
      <div style={{ padding:'8px 16px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'flex-end' }}>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11.5, color:'var(--t-mute)', fontFamily:'"Hanken Grotesk"', padding:'3px 8px', borderRadius:6 }}>
          Закрыть
        </button>
      </div>

      {/* ── Панель обучающих материалов ── */}
      {showLearn && (
        <LearnPanel query={task.text} onClose={() => setShowLearn(false)} />
      )}
    </div>
  )
}
