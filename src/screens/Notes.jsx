import { useState, useMemo } from 'react'
import { useStore, uid } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'
import { NOTE_TAGS } from '../constants'
import { renderMarkdown } from '../services/markdown.jsx'

const NOTE_COLORS = [
  { id:'default', bg:'var(--surf-2)',                            border:'var(--line)' },
  { id:'blue',    bg:'color-mix(in oklch,#5b8dee 12%,transparent)', border:'#5b8dee44'  },
  { id:'green',   bg:'color-mix(in oklch,#34d399 12%,transparent)', border:'#34d39944'  },
  { id:'yellow',  bg:'color-mix(in oklch,#fbbf24 12%,transparent)', border:'#fbbf2444'  },
  { id:'red',     bg:'color-mix(in oklch,#f87171 12%,transparent)', border:'#f8717144'  },
  { id:'purple',  bg:'color-mix(in oklch,#a78bfa 12%,transparent)', border:'#a78bfa44'  },
]

function emptyDraft() {
  return { title:'', body:'', color:'default', tag:'', customTag:'' }
}

// parseInline и renderMarkdown — импортированы из services/markdown.js

// ── Компонент ─────────────────────────────────────────────────────────────────

export function Notes() {
  const [notes, setNotes] = useStore('notes', [])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [editId, setEditId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [mdPreview, setMdPreview] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const openAdd = () => {
    setDraft(emptyDraft())
    setEditId(null)
    setMdPreview(false)
    setShowForm(true)
  }

  const openEdit = (note) => {
    const isCustom = note.tag && !NOTE_TAGS.includes(note.tag)
    setDraft({
      title: note.title||'',
      body: note.body||'',
      color: note.color||'default',
      tag: isCustom ? '__custom__' : (note.tag||''),
      customTag: isCustom ? (note.tag||'') : '',
    })
    setEditId(note.id)
    setMdPreview(false)
    setShowForm(true)
  }

  const save = () => {
    if (!draft.title.trim() && !draft.body.trim()) return
    const finalTag = draft.tag === '__custom__' ? draft.customTag.trim() : draft.tag
    const now = Date.now()
    if (editId) {
      setNotes(ns => ns.map(n => n.id===editId ? { ...n, title:draft.title.trim(), body:draft.body, color:draft.color, tag:finalTag, updated:now } : n))
    } else {
      setNotes(ns => [...(ns||[]), { id:uid(), title:draft.title.trim(), body:draft.body, color:draft.color, tag:finalTag, pinned:false, created:now, updated:now }])
    }
    setShowForm(false)
  }

  const togglePin = (id) => setNotes(ns => ns.map(n => n.id===id ? { ...n, pinned:!n.pinned } : n))
  const remove = (id) => setConfirmId(id)
  const confirmRemove = () => {
    setNotes(ns => ns.filter(n => n.id !== confirmId))
    setConfirmId(null)
  }

  const toggleSelect = (id) => setSelectedIds(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const exportMd = () => {
    const sel = (notes||[]).filter(n => selectedIds.has(n.id))
    const content = sel.map(n => {
      const parts = []
      if (n.title) parts.push(`# ${n.title}`)
      if (n.tag) parts.push(`*Тег: ${n.tag}*`)
      if (n.body) parts.push(n.body)
      return parts.join('\n\n')
    }).join('\n\n---\n\n')
    const blob = new Blob([content], { type:'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `notes-${new Date().toISOString().slice(0,10)}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    let list = notes || []
    if (tagFilter)     list = list.filter(n => n.tag === tagFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n => (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      return (b.updated||0) - (a.updated||0)
    })
  }, [notes, search, tagFilter])

  const usedTags = useMemo(() => [...new Set((notes||[]).map(n=>n.tag).filter(Boolean))], [notes])

  return (
    <div className="view">
      <div style={{ display:'flex', alignItems:'flex-end', gap:18, marginBottom:22 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">Записи</div>
          <div className="pg-title">Заметки</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {selectMode && selectedIds.size > 0 && (
            <button className="tb-btn" onClick={exportMd}>
              <Icon name="note" size={14}/> Экспорт .md ({selectedIds.size})
            </button>
          )}
          {(notes||[]).length > 0 && (
            <button className="tb-btn" onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()) }}>
              {selectMode ? 'Отмена' : 'Выбрать'}
            </button>
          )}
          <button className="btn-primary" onClick={openAdd}>
            <Icon name="plus" size={15}/> Новая заметка
          </button>
        </div>
      </div>

      {/* Поиск и теги */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Icon name="search" size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t-mute)', pointerEvents:'none' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по заметкам…"
            style={{ width:'100%', padding:'7px 11px 7px 32px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={() => setTagFilter('')}
            style={{ padding:'6px 13px', borderRadius:99, border:'1px solid', cursor:'pointer', fontSize:12.5, transition:'all .15s',
              borderColor: !tagFilter ? 'var(--acc-line)' : 'var(--line)',
              background:  !tagFilter ? 'color-mix(in oklch,var(--acc) 15%,transparent)' : 'var(--surf-2)',
              color:       !tagFilter ? 'var(--acc-text)' : 'var(--t-mute)',
            }}>Все</button>
          {usedTags.map(t => (
            <button key={t} onClick={() => setTagFilter(tagFilter===t ? '' : t)}
              style={{ padding:'6px 13px', borderRadius:99, border:'1px solid', cursor:'pointer', fontSize:12.5, transition:'all .15s',
                borderColor: tagFilter===t ? 'var(--acc-line)' : 'var(--line)',
                background:  tagFilter===t ? 'color-mix(in oklch,var(--acc) 15%,transparent)' : 'var(--surf-2)',
                color:       tagFilter===t ? 'var(--acc-text)' : 'var(--t-mute)',
              }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Сетка заметок */}
      {filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'60px 0', color:'var(--t-mute)' }}>
          <Icon name="note" size={40} style={{ opacity:.15 }}/>
          <div style={{ fontWeight:600, fontSize:15 }}>{search || tagFilter ? 'Ничего не найдено' : 'Заметок пока нет'}</div>
          {!search && !tagFilter && (
            <button className="btn-primary" onClick={openAdd}><Icon name="plus" size={14}/> Создать заметку</button>
          )}
        </div>
      ) : (
        <div style={{ columns:'3 200px', gap:14 }}>
          {filtered.map(note => (
            <NoteCard key={note.id} note={note}
              onEdit={() => openEdit(note)}
              onDelete={() => remove(note.id)}
              onPin={() => togglePin(note.id)}
              selectMode={selectMode}
              selected={selectedIds.has(note.id)}
              onSelect={() => toggleSelect(note.id)}
            />
          ))}
        </div>
      )}

      {/* Подтверждение удаления */}
      {confirmId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={() => setConfirmId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--surf)', border:'1px solid var(--line)', borderRadius:16, padding:'24px 28px', display:'flex', flexDirection:'column', gap:16, minWidth:300 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:16 }}>Удалить заметку?</div>
            <div style={{ fontSize:13.5, color:'var(--t-mute)' }}>Это действие нельзя отменить.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn" style={{ flex:1, borderColor:'rgba(251,113,133,.4)', color:'#fb7185', background:'rgba(251,113,133,.07)' }} onClick={confirmRemove}>Удалить</button>
              <button className="tb-btn" style={{ flex:1 }} onClick={() => setConfirmId(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Форма */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ width:500, maxHeight:'88vh', overflowY:'auto', background:'var(--surf)', border:'1px solid var(--line)', borderRadius:20, padding:28, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>
              {editId ? 'Редактировать заметку' : 'Новая заметка'}
            </div>

            <input value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} autoFocus
              placeholder="Заголовок…"
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontFamily:'"Space Grotesk"', fontSize:16, fontWeight:600, outline:'none', boxSizing:'border-box' }}
            />

            {/* Edit / Preview tabs */}
            <div>
              <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                {[['edit','Редактировать'],['preview','Просмотр']].map(([id, label]) => (
                  <button key={id} onClick={() => setMdPreview(id==='preview')}
                    style={{ padding:'4px 12px', borderRadius:7, border:'1px solid', cursor:'pointer', fontSize:12, transition:'all .12s',
                      borderColor: (id==='preview')===mdPreview ? 'var(--acc-line)' : 'var(--line)',
                      background:  (id==='preview')===mdPreview ? 'color-mix(in oklch,var(--acc) 14%,transparent)' : 'var(--surf-2)',
                      color:       (id==='preview')===mdPreview ? 'var(--acc-text)' : 'var(--t-mute)',
                    }}>{label}</button>
                ))}
                <span style={{ marginLeft:'auto', fontSize:10.5, color:'var(--t-mute)', alignSelf:'center', fontFamily:'"JetBrains Mono"' }}>
                  Поддерживается **жирный**, *курсив*, `код`, # заголовки, - списки
                </span>
              </div>

              {mdPreview ? (
                <div style={{ minHeight:140, padding:'9px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13.5, lineHeight:1.55, boxSizing:'border-box', overflowY:'auto', maxHeight:280 }}>
                  {draft.body.trim() ? renderMarkdown(draft.body, 'note') : <span style={{ color:'var(--t-mute)', fontStyle:'italic' }}>Пусто — переключись на редактирование</span>}
                </div>
              ) : (
                <div style={{ position:'relative' }}>
                  <textarea value={draft.body} onChange={e=>setDraft(d=>({...d,body:e.target.value}))}
                    placeholder="Текст заметки… (поддерживается Markdown)"
                    style={{ width:'100%', minHeight:140, padding:'9px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontFamily:'"Hanken Grotesk"', fontSize:13.5, outline:'none', resize:'vertical', boxSizing:'border-box', lineHeight:1.55 }}
                  />
                  <div style={{ position:'absolute', bottom:8, right:10, fontSize:10.5, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', pointerEvents:'none' }}>
                    {draft.body.length} симв.
                  </div>
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:12, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Тег</div>
                <select value={draft.tag} onChange={e=>setDraft(d=>({...d,tag:e.target.value,customTag:''}))}
                  style={{ width:'100%', padding:'8px 11px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', cursor:'pointer' }}>
                  <option value="">— Без тега —</option>
                  {NOTE_TAGS.map(t => <option key={t}>{t}</option>)}
                  <option value="__custom__">Свой тег…</option>
                </select>
                {draft.tag === '__custom__' && (
                  <input value={draft.customTag} onChange={e=>setDraft(d=>({...d,customTag:e.target.value}))}
                    autoFocus placeholder="Введи тег…"
                    style={{ width:'100%', marginTop:6, padding:'8px 11px', borderRadius:9, border:'1px solid var(--acc-line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}
                  />
                )}
              </div>
              <div>
                <div style={{ fontSize:11.5, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Цвет</div>
                <div style={{ display:'flex', gap:5 }}>
                  {NOTE_COLORS.map(c => (
                    <div key={c.id} onClick={() => setDraft(d=>({...d,color:c.id}))}
                      style={{ width:24, height:24, borderRadius:99, background:c.bg, border:`2px solid ${draft.color===c.id ? 'var(--acc)' : c.border}`, cursor:'pointer', transition:'all .12s', transform: draft.color===c.id ? 'scale(1.2)' : 'scale(1)' }}/>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={save}>
                {editId ? 'Сохранить' : 'Создать'}
              </button>
              <button className="tb-btn" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoteCard({ note, onEdit, onDelete, onPin, selectMode, selected, onSelect }) {
  const [hover, setHover] = useState(false)
  const scheme = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0]

  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onClick={selectMode ? onSelect : undefined}
      style={{ display:'inline-block', width:'100%', marginBottom:14, borderRadius:14, border:`1px solid ${selected ? 'var(--acc-line)' : note.pinned ? 'var(--acc-line)' : scheme.border}`, background:scheme.bg, padding:'15px 16px', verticalAlign:'top', boxSizing:'border-box', transition:'transform .15s, box-shadow .15s', transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? '0 8px 24px rgba(0,0,0,.15)' : selected ? '0 0 0 2px color-mix(in oklch, var(--acc) 40%, transparent)' : note.pinned ? '0 0 0 1px color-mix(in oklch, var(--acc) 40%, transparent)' : 'none', cursor: selectMode ? 'pointer' : 'default' }}>

      {/* Заголовок + действия */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 }}>
        {selectMode && (
          <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, marginTop:2, display:'grid', placeItems:'center', cursor:'pointer', border: selected ? 'none' : '1.5px solid var(--line-2)', background: selected ? 'var(--acc)' : 'transparent', transition:'all .15s' }}>
            {selected && <Icon name="check" size={11} style={{ color:'#fff' }}/>}
          </div>
        )}
        <div style={{ flex:1 }}>
          {note.title && <div style={{ fontWeight:700, fontSize:14.5, lineHeight:1.3, marginBottom:4 }}>{note.title}</div>}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
            {note.pinned && <span style={{ fontSize:11, color:'var(--acc-text)', fontFamily:'"JetBrains Mono"' }}>📌 закреплена</span>}
            {note.tag && <span className="tcard-tag" style={{ fontSize:10.5 }}>{note.tag}</span>}
          </div>
        </div>
        {!selectMode && (
          <div style={{ display:'flex', gap:2, opacity: hover ? 1 : 0, transition:'opacity .15s', flexShrink:0 }}>
            <button onClick={onPin}    style={{...iconBtn, color: note.pinned ? 'var(--acc-text)' : 'var(--t-mute)' }} title={note.pinned ? 'Открепить' : 'Закрепить'}>📌</button>
            <button onClick={onEdit}   style={iconBtn}><Icon name="edit"  size={13}/></button>
            <button onClick={onDelete} style={iconBtn}><Icon name="trash" size={13}/></button>
          </div>
        )}
      </div>

      {note.body && (
        <div style={{ fontSize:13, color:'var(--t-dim)', lineHeight:1.6, wordBreak:'break-word', maxHeight:160, overflow:'hidden' }}>
          {renderMarkdown(note.body.slice(0, 300), 'note')}
          {note.body.length > 300 && <span style={{ color:'var(--t-mute)' }}>…</span>}
        </div>
      )}

      <div style={{ fontSize:11, color:'var(--t-mute)', marginTop:10, fontFamily:'"JetBrains Mono"' }}>
        {fmtDate(note.updated || note.created)}
      </div>
    </div>
  )
}

function fmtDate(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60)    return 'только что'
    if (diff < 3600)  return `${Math.floor(diff/60)} мин назад`
    if (diff < 86400) return `${Math.floor(diff/3600)} ч назад`
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })
  } catch { return '' }
}

const iconBtn = { background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4, borderRadius:6, fontSize:12 }
