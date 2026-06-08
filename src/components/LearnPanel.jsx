import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from './Icons'

// ── Категоризация результата ──────────────────────────────────────────────
function classify(result) {
  const url  = (result.url  || '').toLowerCase()
  const text = ((result.title || '') + ' ' + (result.snippet || '')).toLowerCase()

  if (url.includes('youtube.com') || url.includes('youtu.be'))
    return 'video'
  if (
    url.includes('coursera')  || url.includes('stepik')   ||
    url.includes('udemy')     || url.includes('skillbox') ||
    url.includes('hexlet')    || url.includes('netology') ||
    url.includes('geekbrains')|| url.includes('edx.org')  ||
    url.includes('Khan')      || url.includes('swayam')   ||
    text.includes('курс ')    || text.includes('course ')
  )
    return 'course'
  if (
    text.includes('книга')  || text.includes('учебник') ||
    text.includes(' book ') || text.includes(' pdf')    ||
    text.includes('издание')|| text.includes('глава ')
  )
    return 'book'
  return 'article'
}

const CAT_META = {
  video:   { icon: '📺', label: 'Видео' },
  course:  { icon: '🎓', label: 'Курсы' },
  book:    { icon: '📚', label: 'Книги' },
  article: { icon: '🔗', label: 'Статьи' },
}

const ORDER = ['video', 'course', 'book', 'article']

// ── Главный компонент ─────────────────────────────────────────────────────
export function LearnPanel({ query, onClose }) {
  const [status,  setStatus]  = useState('loading') // сразу loading — нет мигания idle
  const [items,   setItems]   = useState([])
  const [tab,     setTab]     = useState('article') // откат, перезапишется после загрузки
  const didLoad = useRef(false)

  const loadResources = useCallback(async () => {
    setStatus('loading')
    if (!window.jarvis?.web?.search) { setStatus('error'); return }
    const all = []
    try {
      // 2 запроса параллельно: видео/лекции + курсы/книги
      const [r1, r2] = await Promise.allSettled([
        window.jarvis.web.search({ query: `${query} youtube лекция урок туториал`, maxResults: 6 }),
        window.jarvis.web.search({ query: `${query} онлайн курс учебник обучение`, maxResults: 7 }),
      ])
      if (r1.status === 'fulfilled') all.push(...(r1.value?.results || []))
      if (r2.status === 'fulfilled') all.push(...(r2.value?.results || []))
    } catch {}

    // Убираем дубли по URL
    const seen = new Set()
    const unique = all.filter(r => {
      if (!r.title && !r.snippet) return false
      const key = r.url || r.title
      if (seen.has(key)) return false
      seen.add(key); return true
    })

    const classified = unique.map(r => ({ ...r, _cat: classify(r) }))
    setItems(classified)

    // Выбираем первую вкладку с результатами
    const firstAvail = ORDER.find(c => classified.some(r => r._cat === c))
    if (firstAvail) setTab(firstAvail)

    setStatus('done')
  }, [query])

  // Запуск при монтировании — useRef гарантирует ровно один вызов
  useEffect(() => {
    if (didLoad.current) return
    didLoad.current = true
    loadResources()
  }, [loadResources])

  const byTab = items.filter(r => r._cat === tab)

  // Считаем, сколько в каждой категории
  const counts = {}
  for (const c of ORDER) counts[c] = items.filter(r => r._cat === c).length

  return (
    <div style={{
      position:'fixed', right:24, bottom:24, width:400, maxHeight:560,
      background:'var(--surface-1-solid)', border:'1px solid var(--line-accent)',
      borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,.65)',
      display:'flex', flexDirection:'column', zIndex:510,
      animation:'slideUpIn .22s ease', overflow:'hidden',
    }}>

      {/* ── Шапка ── */}
      <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <span style={{ fontSize:14 }}>📖</span>
              <span style={{ fontSize:10.5, color:'var(--accent-soft)', fontFamily:'var(--font-mono)', letterSpacing:'.05em', fontWeight:600 }}>
                МАТЕРИАЛЫ ДЛЯ ИЗУЧЕНИЯ
              </span>
            </div>
            <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {query}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-mute)', display:'grid', placeItems:'center', padding:4, flexShrink:0, borderRadius:7 }}>
            <Icon name="x" size={15}/>
          </button>
        </div>

        {/* ── Вкладки категорий ── */}
        {status === 'done' && (
          <div style={{ display:'flex', gap:4, marginTop:10 }}>
            {ORDER.map(c => (
              counts[c] > 0 && (
                <button key={c} onClick={() => setTab(c)}
                  style={{
                    display:'flex', alignItems:'center', gap:5, padding:'5px 11px',
                    borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                    transition:'all .15s',
                    background: tab === c ? 'var(--accent)' : 'var(--surface-2)',
                    color:      tab === c ? '#fff' : 'var(--text-mute)',
                    boxShadow:  tab === c ? '0 2px 8px var(--accent-glow)' : 'none',
                  }}>
                  <span>{CAT_META[c].icon}</span>
                  <span>{CAT_META[c].label}</span>
                  <span style={{ opacity:.7, fontSize:10.5 }}>{counts[c]}</span>
                </button>
              )
            ))}
          </div>
        )}
      </div>

      {/* ── Тело ── */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* Загрузка */}
        {status === 'loading' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'32px 0' }}>
            <div style={{ width:28, height:28, border:'2.5px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
            <span style={{ fontSize:12.5, color:'var(--text-mute)' }}>Ищу материалы…</span>
          </div>
        )}

        {/* Ошибка */}
        {status === 'error' && (
          <div style={{ padding:'28px 20px', textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>
            Нет подключения к интернету
          </div>
        )}

        {/* Пусто */}
        {status === 'done' && byTab.length === 0 && (
          <div style={{ padding:'28px 20px', textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>
            Ничего не найдено в этой категории
          </div>
        )}

        {/* Результаты */}
        {status === 'done' && byTab.map((r, i) => (
          <div key={i}
            onClick={() => r.url && window.jarvis?.openUrl?.(r.url)}
            style={{
              padding:'11px 16px',
              borderBottom: i < byTab.length - 1 ? '1px solid var(--line)' : 'none',
              cursor: r.url ? 'pointer' : 'default',
              transition:'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

            <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
              <span style={{ fontSize:12.5, fontWeight:600, color: r.url ? 'var(--accent-soft)' : 'var(--text)', lineHeight:1.35, flex:1 }}>
                {r.title || '—'}
              </span>
              {r.url && (
                <span style={{ fontSize:11, color:'var(--text-faint)', flexShrink:0, marginTop:1 }}>↗</span>
              )}
            </div>

            {r.snippet && (
              <div style={{ fontSize:11.5, color:'var(--text-mute)', marginTop:3, lineHeight:1.45 }}>
                {r.snippet.length > 140 ? r.snippet.slice(0, 140) + '…' : r.snippet}
              </div>
            )}

            {r.url && (
              <div style={{ fontSize:10.5, color:'var(--text-faint)', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {(() => { try { return new URL(r.url).hostname } catch { return r.url.slice(0, 40) } })()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Подвал ── */}
      <div style={{ padding:'8px 16px', borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontSize:11, color:'var(--text-faint)' }}>
          {status === 'done' ? `${items.length} результатов` : ''}
        </span>
        <button onClick={loadResources} disabled={status === 'loading'}
          style={{ background:'none', border:'none', cursor: status === 'loading' ? 'default' : 'pointer', fontSize:11.5, color:'var(--accent-soft)', fontFamily:'var(--font-body)', padding:'3px 8px', borderRadius:6, opacity: status === 'loading' ? .5 : 1 }}>
          Обновить
        </button>
        <button onClick={onClose}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:11.5, color:'var(--text-mute)', fontFamily:'var(--font-body)', padding:'3px 8px', borderRadius:6 }}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
