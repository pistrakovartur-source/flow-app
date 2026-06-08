// ── Общий Markdown-рендерер для Diary и Notes ─────────────────────────────
// parseInline — инлайн-форматирование: **bold**, *italic*, `code`
// renderMarkdown — блочный рендер с заголовками, списками, абзацами
// Принимает опции для точной настройки под контекст (дневник vs заметки)

export function parseInline(text) {
  const parts = []; let i = 0, buf = '', key = 0
  while (i < text.length) {
    if (text[i]==='*' && text[i+1]==='*') {
      const e = text.indexOf('**', i+2)
      if (e !== -1) { if (buf) { parts.push(buf); buf='' } parts.push(<strong key={key++}>{text.slice(i+2,e)}</strong>); i=e+2; continue }
    }
    if (text[i]==='*' && text[i+1]!=='*') {
      const e = text.indexOf('*', i+1)
      if (e !== -1) { if (buf) { parts.push(buf); buf='' } parts.push(<em key={key++}>{text.slice(i+1,e)}</em>); i=e+1; continue }
    }
    if (text[i]==='`') {
      const e = text.indexOf('`', i+1)
      if (e !== -1) { if (buf) { parts.push(buf); buf='' }
        parts.push(<code key={key++} style={{ background:'var(--surface-3)', padding:'1px 5px', borderRadius:4, fontSize:'0.88em', fontFamily:'var(--font-mono)' }}>{text.slice(i+1,e)}</code>)
        i=e+1; continue }
    }
    buf += text[i]; i++
  }
  if (buf) parts.push(buf)
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
}

/**
 * @param {string} text - исходный Markdown-текст
 * @param {'diary'|'note'} mode - 'diary' = крупнее (дневник), 'note' = компактнее (карточка заметки)
 */
export function renderMarkdown(text, mode = 'diary') {
  if (!text) return null
  const isDiary = mode === 'diary'
  const lines = text.split('\n')
  const result = []
  let list = []
  let k = 0

  const flushList = () => {
    if (!list.length) return
    result.push(
      <ul key={k++} style={{ paddingLeft:18, margin: isDiary ? '6px 0' : '4px 0 6px', display: isDiary ? undefined : 'flex', flexDirection: isDiary ? undefined : 'column', gap: isDiary ? undefined : 2 }}>
        {list}
      </ul>
    )
    list = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      flushList()
      result.push(<div key={k++} style={{ height: isDiary ? 10 : 6 }} />)
      continue
    }
    if (t.startsWith('# ')) {
      flushList()
      result.push(
        isDiary
          ? <h1 key={k++} style={{ fontSize:20, fontWeight:700, margin:'10px 0 4px', fontFamily:'var(--font-display)' }}>{parseInline(t.slice(2))}</h1>
          : <div key={k++} style={{ fontWeight:700, fontSize:15, margin:'4px 0 2px', lineHeight:1.3 }}>{parseInline(t.slice(2))}</div>
      )
      continue
    }
    if (t.startsWith('## ')) {
      flushList()
      result.push(
        isDiary
          ? <h2 key={k++} style={{ fontSize:16, fontWeight:700, margin:'8px 0 3px' }}>{parseInline(t.slice(3))}</h2>
          : <div key={k++} style={{ fontWeight:700, fontSize:13.5, margin:'3px 0 2px' }}>{parseInline(t.slice(3))}</div>
      )
      continue
    }
    if (t.startsWith('- ') || t.startsWith('* ')) {
      list.push(
        <li key={k++} style={{ marginBottom: isDiary ? 2 : 0, color:'var(--text)', fontSize: isDiary ? undefined : 13, lineHeight: isDiary ? undefined : 1.55 }}>
          {parseInline(t.slice(2))}
        </li>
      )
      continue
    }
    flushList()
    result.push(
      isDiary
        ? <p key={k++} style={{ margin:'3px 0', lineHeight:1.85 }}>{parseInline(t)}</p>
        : <div key={k++} style={{ fontSize:13, lineHeight:1.6 }}>{parseInline(t)}</div>
    )
  }
  flushList()
  return isDiary ? result : <div>{result}</div>
}
