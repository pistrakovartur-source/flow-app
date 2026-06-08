import { useState, useEffect, useMemo, useRef } from 'react'
import { Icon } from './Icons'
import { Store } from '../store'

const TYPE_LABELS = { task:'Задача', note:'Заметка', event:'Событие', habit:'Привычка' }

const QUICK_NAV = [
  { screen:'dashboard', icon:'grid',     label:'Главная'   },
  { screen:'tasks',     icon:'check',    label:'Задачи'    },
  { screen:'calendar',  icon:'calendar', label:'Календарь' },
  { screen:'focus',     icon:'timer',    label:'Фокус'     },
  { screen:'habits',    icon:'repeat',   label:'Привычки'  },
  { screen:'budget',    icon:'tag',      label:'Бюджет'    },
  { screen:'notes',     icon:'note',     label:'Заметки'   },
]

function fuzzyMatch(text, q) {
  const words = q.split(/\s+/).filter(Boolean)
  return words.every(w => text.includes(w))
}

export function GlobalSearch({ onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 80)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') setCursor(c => c + 1)
      if (e.key === 'ArrowUp') setCursor(c => Math.max(0, c - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase()
    const titleHits = [], bodyHits = []

    const tasks = Store.get('tasks', [])
    tasks.forEach(t => {
      const inTitle = fuzzyMatch(t.text.toLowerCase(), q)
      const inBody  = fuzzyMatch((t.note||'').toLowerCase(), q)
      if (inTitle) titleHits.push({ type:'task', screen:'tasks', icon:'check', label:t.text, sub:t.tag||'' })
      else if (inBody) bodyHits.push({ type:'task', screen:'tasks', icon:'check', label:t.text, sub:t.tag||'' })
    })

    const notes = Store.get('notes', [])
    notes.forEach(n => {
      const inTitle = fuzzyMatch((n.title||'').toLowerCase(), q)
      const inBody  = fuzzyMatch((n.body||'').toLowerCase(), q)
      if (inTitle) titleHits.push({ type:'note', screen:'notes', icon:'note', label:n.title || (n.body||'').slice(0,50) || 'Без заголовка', sub:n.tag||'' })
      else if (inBody) bodyHits.push({ type:'note', screen:'notes', icon:'note', label:n.title || (n.body||'').slice(0,50) || 'Без заголовка', sub:n.tag||'' })
    })

    const events = Store.get('calendar_events', [])
    events.forEach(e => {
      if (fuzzyMatch((e.title||'').toLowerCase(), q))
        titleHits.push({ type:'event', screen:'calendar', icon:'calendar', label:e.title, sub:e.date||'' })
    })

    const habits = Store.get('habits_v2', [])
    habits.forEach(h => {
      if (fuzzyMatch((h.name||'').toLowerCase(), q))
        titleHits.push({ type:'habit', screen:'habits', icon:'repeat', label:h.name, sub:'' })
    })

    return [...titleHits, ...bodyHits].slice(0, 20)
  }, [debouncedQuery])

  const go = (screen) => { onNavigate(screen); onClose() }

  const idx = cursor % Math.max(results.length, 1)

  const handleKey = (e) => {
    if (e.key === 'Enter' && results.length > 0) go(results[idx].screen)
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.72)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:9998, paddingTop:110 }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div style={{ width:580, background:'var(--surface-1-solid)', border:'1px solid var(--line-accent)', borderRadius:20, overflow:'hidden', boxShadow:'0 28px 90px rgba(0,0,0,.65)' }}>

        {/* Search input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
          <Icon name="search" size={18} style={{ color:'var(--accent-soft)', flexShrink:0 }}/>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={handleKey}
            placeholder="Поиск задач, заметок, событий…"
            style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text)', fontFamily:'var(--font-body)', fontSize:16 }}
          />
          <kbd style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-mute)', background:'var(--surface-3)', padding:'3px 7px', borderRadius:6, border:'1px solid var(--line)', flexShrink:0 }}>ESC</kbd>
        </div>

        {/* Results */}
        {debouncedQuery.trim() ? (
          <div style={{ maxHeight:360, overflowY:'auto' }}>
            {results.length === 0 ? (
              <div style={{ padding:'28px', textAlign:'center' }}>
                <div style={{ fontSize:22, marginBottom:8 }}>🔍</div>
                <div style={{ color:'var(--text-mute)', fontSize:14, marginBottom:4 }}>Ничего не найдено</div>
                <div style={{ color:'var(--text-faint)', fontSize:12 }}>Попробуй другое слово или сократи запрос</div>
              </div>
            ) : (
              <div style={{ padding:'8px 0' }}>
                {results.map((r, i) => (
                  <div key={i} onClick={() => go(r.screen)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px', cursor:'pointer', transition:'background .12s', background: i===idx ? 'var(--surface-2)' : 'transparent' }}
                    onMouseEnter={e=>{ e.currentTarget.style.background='var(--surface-2)'; setCursor(i) }}
                    onMouseLeave={e=>e.currentTarget.style.background= i===idx ? 'var(--surface-2)' : 'transparent'}
                  >
                    <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, display:'grid', placeItems:'center', background:'var(--surface-3)', color:'var(--accent-soft)' }}>
                      <Icon name={r.icon} size={16}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</div>
                      {r.sub && <div style={{ fontSize:12, color:'var(--text-mute)', marginTop:1 }}>{r.sub}</div>}
                    </div>
                    <span className="pill" style={{ fontSize:10.5 }}>{TYPE_LABELS[r.type]}</span>
                    {i===idx && <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-mute)' }}>↵</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding:'14px 18px 16px' }}>
            <div style={{ fontSize:10.5, color:'var(--text-mute)', fontFamily:'var(--font-mono)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Быстрый переход</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {QUICK_NAV.map(n => (
                <button key={n.screen} onClick={() => go(n.screen)}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', cursor:'pointer', color:'var(--text-dim)', fontSize:13, transition:'all .15s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--line-accent)'; e.currentTarget.style.color='var(--text)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--line)'; e.currentTarget.style.color='var(--text-dim)' }}
                >
                  <Icon name={n.icon} size={14}/>
                  {n.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop:14, fontSize:12, color:'var(--text-faint)', fontFamily:'var(--font-mono)' }}>
              ↑↓ навигация &nbsp;·&nbsp; ↵ перейти &nbsp;·&nbsp; ESC закрыть
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
