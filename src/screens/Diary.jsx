import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useStore, uid } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'
import {
  getSentiment, extractKeywords, getMoodByDow, getMoodTrend,
  generateInsights, getSuggestions, detectThemes, scoreEntry,
} from '../services/diaryAnalysis'
import { LearnPanel } from '../components/LearnPanel'
import { parseInline, renderMarkdown } from '../services/markdown.jsx'
import { fmtDateLong, fmtDateShort } from '../utils/date'

// ── Настроения ────────────────────────────────────────────────────────────
const MOODS = [
  { id:'great',   emoji:'🤩', label:'Отлично',     color:'#fbbf24' },
  { id:'happy',   emoji:'😊', label:'Хорошо',      color:'#34d399' },
  { id:'neutral', emoji:'😐', label:'Нейтрально',  color:'#94a3b8' },
  { id:'tired',   emoji:'😴', label:'Устал',       color:'#a78bfa' },
  { id:'sad',     emoji:'😔', label:'Грустно',     color:'#60a5fa' },
  { id:'anxious', emoji:'😰', label:'Тревожно',    color:'#f97316' },
  { id:'angry',   emoji:'😤', label:'Злюсь',       color:'#f87171' },
  { id:'love',    emoji:'🥰', label:'Влюблён',     color:'#f472b6' },
]

// Подсказки для вдохновения
const PROMPTS = [
  'Что сегодня тебя удивило?',
  'Три вещи, за которые ты благодарен сегодня.',
  'Что ты хочешь запомнить об этом дне?',
  'Как ты себя чувствуешь прямо сейчас — и почему?',
  'Что было самым сложным сегодня?',
  'Чего ты достиг сегодня, даже если это мелочь?',
  'О чём ты думал весь день?',
  'Что бы ты сказал себе прошлому?',
  'Опиши этот день в одном предложении.',
  'Что тебя мотивирует прямо сейчас?',
]

// ── Утилиты ───────────────────────────────────────────────────────────────
const TODAY = () => new Date().toISOString().slice(0, 10)

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

// fmtDate и fmtShort — импортированы из utils/date.js как fmtDateLong / fmtDateShort
const fmtDate  = fmtDateLong
const fmtShort = fmtDateShort

function dailyPrompt(date) {
  const day = parseInt(date.slice(8, 10), 10)
  return PROMPTS[day % PROMPTS.length]
}

// parseInline и renderMarkdown — импортированы из services/markdown.js

// ── Главный экран ──────────────────────────────────────────────────────────
export function Diary() {
  const [entries, setEntries] = useStore('diary_entries', [])

  const [habits] = useStore('habits_v2', [])
  const [tasks]  = useStore('tasks', [])

  const today = TODAY()
  const [selDate,      setSelDate]      = useState(today)
  const [calMonth,     setCalMonth]     = useState(today.slice(0, 7))
  const [draft,        setDraft]        = useState('')
  const [mood,         setMood]         = useState(null)
  const [preview,      setPreview]      = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [search,       setSearch]       = useState('')
  const [showDel,      setShowDel]      = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [suggestions,  setSuggestions]  = useState([])
  const [showLearn,    setShowLearn]    = useState(false)
  const [learnQuery,   setLearnQuery]   = useState('')
  const [yearAgoEntry, setYearAgoEntry] = useState(null)  // запись год назад
  const textRef = useRef(null)

  // Загружаем запись при смене даты
  const currentEntry = useMemo(() => entries.find(e => e.date === selDate), [entries, selDate])

  // Запись год назад
  useEffect(() => {
    const d = new Date(selDate + 'T12:00:00')
    d.setFullYear(d.getFullYear() - 1)
    const yearAgoDate = d.toISOString().slice(0, 10)
    const found = entries.find(e => e.date === yearAgoDate)
    setYearAgoEntry(found || null)
  }, [selDate, entries])

  useEffect(() => {
    setDraft(currentEntry?.body || '')
    setMood(currentEntry?.mood || null)
    setSaved(false)
    setPreview(false)
    setShowDel(false)
    setTimeout(() => textRef.current?.focus(), 80)
  }, [selDate])

  // Авто-сохранение каждые 10 секунд если есть изменения
  const isDirty = draft !== (currentEntry?.body || '') || mood !== (currentEntry?.mood || null)
  useEffect(() => {
    if (!isDirty || !draft.trim()) return
    const t = setTimeout(() => saveEntry(true), 10000)
    return () => clearTimeout(t)
  }, [draft, mood, isDirty])

  const saveEntry = useCallback((silent = false) => {
    if (!draft.trim()) return
    const saved_entry = { date: selDate, body: draft, mood }
    setEntries(prev => {
      const ex = prev.find(e => e.date === selDate)
      if (ex) return prev.map(e => e.id === ex.id ? { ...e, body: draft, mood, updated: Date.now() } : e)
      return [...prev, { id: uid(), ...saved_entry, created: Date.now(), updated: Date.now() }]
    })
    if (!silent) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      // Генерируем советы после сохранения
      const allForSugg = [...entries.filter(e => e.date !== selDate), { ...saved_entry, id:'_tmp' }]
      setSuggestions(getSuggestions(saved_entry, allForSugg, habits, tasks))
      setShowInsights(true)
      // Извлекаем ключевые слова для поиска материалов
      if (draft.trim().length > 30) {
        const kws = extractKeywords([{ ...saved_entry, id:'_tmp' }], 5)
        const q = kws.map(k => k.word).join(' ')
        if (q) setLearnQuery(q)
      }
    }
  }, [draft, mood, selDate, setEntries, entries, habits, tasks])

  const deleteEntry = () => {
    if (!currentEntry) return
    setEntries(prev => prev.filter(e => e.id !== currentEntry.id))
    setDraft(''); setMood(null); setShowDel(false)
  }

  // Ctrl+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveEntry() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveEntry])

  // Серия дней подряд
  const streak = useMemo(() => {
    const dates = new Set(entries.map(e => e.date))
    let s = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10)
      if (!dates.has(key)) {
        if (i === 0) { d.setDate(d.getDate() - 1); continue }
        break
      }
      s++
      d.setDate(d.getDate() - 1)
    }
    return s
  }, [entries])

  // Данные мини-календаря
  const calDays = useMemo(() => {
    const [y, m] = calMonth.split('-').map(Number)
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Пн=0
    const total = new Date(y, m, 0).getDate()
    const entrySet = new Set(entries.map(e => e.date))
    const days = Array(firstDow).fill(null)
    for (let d = 1; d <= total; d++) {
      const date = `${calMonth}-${String(d).padStart(2, '0')}`
      const entry = entries.find(e => e.date === date)
      days.push({ d, date, hasEntry: entrySet.has(date), mood: entry?.mood || null })
    }
    return days
  }, [calMonth, entries])

  // Список записей (для левой панели)
  const entryList = useMemo(() => {
    const q = search.toLowerCase()
    return [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(e => !q || e.body.toLowerCase().includes(q) || e.date.includes(q))
      .slice(0, 60)
  }, [entries, search])

  const prevMonth = () => { const d = new Date(calMonth + '-15'); d.setMonth(d.getMonth() - 1); setCalMonth(d.toISOString().slice(0, 7)) }
  const nextMonth = () => { const d = new Date(calMonth + '-15'); d.setMonth(d.getMonth() + 1); setCalMonth(d.toISOString().slice(0, 7)) }
  const wc = wordCount(draft)
  const prompt = dailyPrompt(selDate)
  const moodObj = MOODS.find(m => m.id === mood)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'30px 38px 24px' }}>

      {/* ── Заголовок ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">личный журнал</div>
          <div className="pg-title" style={{ marginBottom:0 }}>Дневник</div>
        </div>

        {streak > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:12, background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.25)', flexShrink:0 }}>
            <span style={{ fontSize:17 }}>🔥</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#fbbf24', lineHeight:1 }}>{streak}</div>
              <div style={{ fontSize:10, color:'var(--t-mute)', lineHeight:1.2 }}>дней подряд</div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button className="tb-btn" style={{ fontSize:12, padding:'7px 14px', gap:5 }} onClick={() => { setSelDate(today); setCalMonth(today.slice(0,7)) }}>
            <Icon name="calendar" size={13} /> Сегодня
          </button>
          {entries.length > 1 && (
            <button className="tb-btn" style={{ fontSize:12, padding:'7px 14px' }}
              title="Случайная запись"
              onClick={() => {
                const others = entries.filter(e => e.date !== selDate)
                if (!others.length) return
                const rnd = others[Math.floor(Math.random() * others.length)]
                setSelDate(rnd.date)
                setCalMonth(rnd.date.slice(0,7))
              }}>
              🎲
            </button>
          )}
          {learnQuery && (
            <button
              onClick={() => setShowLearn(o => !o)}
              style={{
                padding:'7px 14px', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', gap:5,
                display:'flex', alignItems:'center', transition:'all .15s',
                border: showLearn ? 'none' : '1px solid var(--line)',
                background: showLearn ? 'linear-gradient(135deg,#34d399,#059669)' : 'transparent',
                color: showLearn ? '#fff' : 'var(--t-mute)',
                boxShadow: showLearn ? '0 4px 16px -4px rgba(52,211,153,.4)' : 'none',
              }}
            >
              📚 Материалы
              {!showLearn && (
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', display:'inline-block', flexShrink:0 }} />
              )}
            </button>
          )}
          <button
            onClick={() => setShowInsights(o => !o)}
            style={{
              padding:'7px 14px', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', gap:6,
              display:'flex', alignItems:'center', transition:'all .15s',
              border: showInsights ? 'none' : '1px solid var(--line)',
              background: showInsights ? 'linear-gradient(135deg,#a78bfa,var(--acc))' : 'transparent',
              color: showInsights ? '#fff' : 'var(--t-mute)',
              boxShadow: showInsights ? '0 4px 16px -4px color-mix(in oklch, var(--acc) 40%, transparent)' : 'none',
            }}
          >
            ✨ Инсайты
            {entries.length > 0 && !showInsights && (
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--acc)', display:'inline-block', flexShrink:0 }} />
            )}
          </button>
          <div style={{ display:'flex', borderRadius:10, border:'1px solid var(--line)', overflow:'hidden' }}>
            <button
              onClick={() => setPreview(false)}
              style={{ padding:'7px 13px', fontSize:12, border:'none', cursor:'pointer', fontWeight:600, background:!preview?'var(--acc)':'transparent', color:!preview?'#fff':'var(--t-mute)', transition:'all .15s' }}
            >✏ Писать</button>
            <button
              onClick={() => setPreview(true)}
              style={{ padding:'7px 13px', fontSize:12, border:'none', cursor:'pointer', fontWeight:600, background:preview?'var(--acc)':'transparent', color:preview?'#fff':'var(--t-mute)', transition:'all .15s' }}
            >👁 Читать</button>
          </div>
        </div>
      </div>

      {/* ── Основной лейаут ── */}
      <div style={{ display:'flex', gap:16, flex:1, minHeight:0 }}>

        {/* ── Левая панель ── */}
        <div style={{ width:232, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Мини-календарь */}
          <div className="card" style={{ padding:'14px 12px', flexShrink:0 }}>
            {/* Навигация месяца */}
            <div style={{ display:'flex', alignItems:'center', marginBottom:10, gap:4 }}>
              <button onClick={prevMonth} style={{ width:26, height:26, borderRadius:7, border:'1px solid var(--line)', background:'var(--surf-2)', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', fontSize:14, flexShrink:0 }}>‹</button>
              <div style={{ flex:1, textAlign:'center', fontSize:12, fontWeight:700, color:'var(--t)', textTransform:'capitalize' }}>
                {new Date(calMonth + '-15').toLocaleDateString('ru-RU', { month:'long', year:'numeric' })}
              </div>
              <button onClick={nextMonth} style={{ width:26, height:26, borderRadius:7, border:'1px solid var(--line)', background:'var(--surf-2)', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', fontSize:14, flexShrink:0 }}>›</button>
            </div>

            {/* Пн–Вс */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:9, color:'var(--t-mute)', padding:'2px 0', fontWeight:700, letterSpacing:'.03em' }}>{d}</div>
              ))}
            </div>

            {/* Числа */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {calDays.map((day, i) => !day ? <div key={i} /> : (
                <button
                  key={day.date}
                  onClick={() => { setSelDate(day.date); setCalMonth(day.date.slice(0,7)) }}
                  title={day.date}
                  style={{
                    position:'relative', padding:'4px 0', borderRadius:7, border:'none', cursor:'pointer',
                    fontSize:11, fontWeight:day.date===today?700:500, textAlign:'center',
                    background: day.date===selDate ? 'var(--acc)'
                      : day.date===today ? 'color-mix(in oklch,var(--acc) 18%,transparent)'
                      : 'transparent',
                    color: day.date===selDate ? '#fff' : day.date===today ? 'var(--acc)' : 'var(--t-mute)',
                  }}
                >
                  {day.d}
                  {day.hasEntry && day.date !== selDate && (
                    <span style={{
                      position:'absolute', bottom:1, left:'50%', transform:'translateX(-50%)',
                      fontSize:7, lineHeight:1,
                    }}>
                      {MOODS.find(m=>m.id===day.mood)?.emoji || '·'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Поиск */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <Icon name="search" size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t-mute)', pointerEvents:'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по записям…"
              style={{ width:'100%', padding:'7px 10px 7px 28px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf)', color:'var(--t)', fontSize:12, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Список записей */}
          <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
            {entryList.length === 0 ? (
              <div style={{ textAlign:'center', padding:'28px 0', color:'var(--t-mute)', fontSize:12 }}>
                {search ? 'Ничего не найдено' : 'Пока нет записей'}
              </div>
            ) : entryList.map(e => {
              const m = MOODS.find(m => m.id === e.mood)
              const isSel = e.date === selDate
              return (
                <button
                  key={e.id}
                  onClick={() => setSelDate(e.date)}
                  style={{
                    display:'flex', flexDirection:'column', gap:3, padding:'9px 10px',
                    borderRadius:10, border:`1px solid ${isSel ? 'var(--acc-line)' : 'var(--line)'}`,
                    background: isSel ? 'color-mix(in oklch,var(--acc) 9%,transparent)' : 'var(--surf)',
                    cursor:'pointer', textAlign:'left', width:'100%', transition:'all .12s',
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {m && <span style={{ fontSize:13 }}>{m.emoji}</span>}
                    <span style={{ fontSize:11.5, fontWeight:700, color: isSel ? 'var(--acc-text)' : 'var(--t)', flex:1 }}>
                      {fmtShort(e.date)}
                      {e.date === today && <span style={{ marginLeft:5, fontSize:9, color:'var(--acc-text)', fontWeight:600 }}>сегодня</span>}
                    </span>
                    <span style={{ fontSize:10, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>
                      {wordCount(e.body)}сл
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--t-mute)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:195 }}>
                    {e.body.slice(0, 70)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Статистика */}
          {entries.length > 0 && (
            <div style={{ flexShrink:0, padding:'10px 12px', borderRadius:10, background:'var(--surf)', border:'1px solid var(--line)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--t)', fontFamily:'"Space Grotesk"' }}>{entries.length}</div>
                <div style={{ fontSize:10, color:'var(--t-mute)' }}>записей</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--t)', fontFamily:'"Space Grotesk"' }}>
                  {Math.round(entries.reduce((s, e) => s + wordCount(e.body), 0) / Math.max(1, entries.length))}
                </div>
                <div style={{ fontSize:10, color:'var(--t-mute)' }}>слов / запись</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Правая панель: редактор ── */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', borderRadius:'var(--r)', border:'1px solid var(--line)', overflow:'hidden', background:'var(--surf)' }}>

          {/* Шапка записи */}
          <div style={{ padding:'16px 22px 14px', borderBottom:'1px solid var(--line)', flexShrink:0, background:'linear-gradient(180deg,color-mix(in oklch,var(--acc) 4%,transparent),transparent)' }}>
            {/* Дата */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:'var(--t)', fontFamily:'"Space Grotesk"', textTransform:'capitalize', lineHeight:1.2 }}>
                  {fmtDate(selDate)}
                </div>
                {selDate === today && (
                  <div style={{ fontSize:11, color:'var(--acc-text)', marginTop:3, fontFamily:'"JetBrains Mono"', letterSpacing:'.06em' }}>● сегодня</div>
                )}
              </div>
              {/* Счётчик слов */}
              {draft && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--t-mute)', fontFamily:'"Space Grotesk"' }}>{wc}</div>
                  <div style={{ fontSize:10, color:'var(--t-mute)' }}>слов</div>
                </div>
              )}
            </div>

            {/* Настроение */}
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {MOODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMood(mood === m.id ? null : m.id)}
                  title={m.label}
                  style={{
                    padding:'5px 11px', borderRadius:99, cursor:'pointer', transition:'all .12s',
                    border:`1px solid ${mood === m.id ? m.color + '88' : 'var(--line)'}`,
                    background: mood === m.id ? m.color + '18' : 'transparent',
                    display:'flex', alignItems:'center', gap:5,
                  }}
                >
                  <span style={{ fontSize:14 }}>{m.emoji}</span>
                  <span style={{ fontSize:11, fontWeight:mood===m.id?700:500, color: mood===m.id ? m.color : 'var(--t-mute)' }}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Область текста / превью */}
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            {preview ? (
              <div style={{ padding:'22px 26px', overflowY:'auto', height:'100%', lineHeight:1.85, fontSize:15, color:'var(--t)', boxSizing:'border-box' }}>
                {draft
                  ? renderMarkdown(draft, 'diary')
                  : <span style={{ color:'var(--t-mute)', fontStyle:'italic' }}>Нечего показывать…</span>
                }
              </div>
            ) : (
              <>
                <textarea
                  ref={textRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder={`${prompt}\n\nНачни писать…`}
                  style={{
                    width:'100%', height:'100%', padding:'22px 26px',
                    background:'transparent', border:'none', outline:'none', resize:'none',
                    color:'var(--t)', fontSize:15, lineHeight:1.9,
                    fontFamily:'"Hanken Grotesk"', boxSizing:'border-box',
                    caretColor:'var(--acc)',
                  }}
                />
                {/* Подсказка когда пусто */}
                {!draft && (
                  <div style={{ position:'absolute', bottom:16, right:20, fontSize:11, color:'var(--t-mute)', fontStyle:'italic', pointerEvents:'none', textAlign:'right' }}>
                    Ctrl+S — сохранить
                  </div>
                )}
              </>
            )}
          </div>

          {/* Нижняя панель кнопок */}
          <div style={{
            padding:'10px 16px', borderTop:'1px solid var(--line)', flexShrink:0,
            display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
          }}>
            {/* Информация */}
            <div style={{ display:'flex', gap:10, alignItems:'center', flex:1, minWidth:0 }}>
              {currentEntry && (
                <>
                  <span style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', whiteSpace:'nowrap' }}>
                    {new Date(currentEntry.updated).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                  {moodObj && (
                    <span style={{ fontSize:12, padding:'2px 8px', borderRadius:99, background:moodObj.color+'18', color:moodObj.color, fontWeight:600, whiteSpace:'nowrap' }}>
                      {moodObj.emoji} {moodObj.label}
                    </span>
                  )}
                </>
              )}
              {isDirty && <span style={{ fontSize:11, color:'var(--t-mute)' }}>● не сохранено</span>}
            </div>

            {/* Кнопки действий */}
            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
              {/* Удалить */}
              {currentEntry && !showDel && (
                <button
                  onClick={() => setShowDel(true)}
                  style={{ padding:'7px 13px', borderRadius:9, border:'1px solid rgba(248,113,113,.25)', background:'rgba(248,113,113,.07)', color:'#f87171', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, transition:'all .15s' }}
                >
                  <Icon name="trash" size={12} /> Удалить
                </button>
              )}
              {showDel && (
                <>
                  <span style={{ fontSize:12, color:'#f87171' }}>Удалить запись?</span>
                  <button onClick={deleteEntry} style={{ padding:'7px 12px', borderRadius:9, border:'1px solid rgba(248,113,113,.4)', background:'rgba(248,113,113,.15)', color:'#f87171', cursor:'pointer', fontSize:12, fontWeight:700 }}>Да</button>
                  <button onClick={() => setShowDel(false)} className="tb-btn" style={{ padding:'7px 12px', fontSize:12 }}>Нет</button>
                </>
              )}

              {/* Отменить изменения */}
              {isDirty && !showDel && (
                <button
                  onClick={() => { setDraft(currentEntry?.body||''); setMood(currentEntry?.mood||null); setSaved(false) }}
                  className="tb-btn"
                  style={{ padding:'7px 13px', fontSize:12 }}
                >
                  Отмена
                </button>
              )}

              {/* Сохранить */}
              {!showDel && (
                <button
                  onClick={() => saveEntry()}
                  disabled={!draft.trim() || (saved && !isDirty)}
                  style={{
                    padding:'7px 18px', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .15s',
                    border: saved ? '1px solid rgba(52,211,153,.4)' : isDirty && draft.trim() ? 'none' : '1px solid var(--line)',
                    background: saved ? 'rgba(52,211,153,.12)' : isDirty && draft.trim() ? 'linear-gradient(180deg,var(--acc-text),var(--acc))' : 'var(--surf-2)',
                    color: saved ? '#34d399' : isDirty && draft.trim() ? '#fff' : 'var(--t-mute)',
                    boxShadow: isDirty && draft.trim() && !saved ? '0 4px 16px -4px color-mix(in oklch, var(--acc) 40%, transparent)' : 'none',
                    opacity: !draft.trim() ? .4 : 1,
                  }}
                >
                  {saved ? '✓ Сохранено' : 'Сохранить'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── «В этот день год назад» ── */}
        {yearAgoEntry && (
          <div style={{ marginTop:12, padding:'12px 18px', borderRadius:14, border:'1px solid var(--line)', background:'var(--surf-2)', display:'flex', gap:12, alignItems:'flex-start' }}>
            <span style={{ fontSize:22, flexShrink:0 }}>📅</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', marginBottom:4 }}>
                В ЭТОТ ДЕНЬ ГОД НАЗАД · {new Date(yearAgoEntry.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}
                {yearAgoEntry.mood && ' · ' + (MOODS.find(m=>m.id===yearAgoEntry.mood)?.emoji || '')}
              </div>
              <div style={{ fontSize:13, color:'var(--t-dim)', lineHeight:1.6, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' }}>
                {yearAgoEntry.body}
              </div>
              <button onClick={() => { setSelDate(yearAgoEntry.date); setCalMonth(yearAgoEntry.date.slice(0,7)) }}
                style={{ marginTop:6, background:'none', border:'none', cursor:'pointer', fontSize:11.5, color:'var(--acc-text)', padding:0, fontFamily:'"Hanken Grotesk"' }}>
                Открыть запись →
              </button>
            </div>
          </div>
        )}

        {/* ── Панель инсайтов ── */}
        {showInsights && (
          <InsightsPanel
            entries={entries}
            habits={habits}
            tasks={tasks}
            suggestions={suggestions}
            currentEntry={currentEntry}
            selDate={selDate}
            onNavigate={navScreen => window.jarvis?.openUrl?.('') || (() => {})}
            onSelectDate={setSelDate}
          />
        )}
      </div>
    </div>
  )
}

// ── Панель инсайтов ────────────────────────────────────────────────────────
function InsightsPanel({ entries, habits, tasks, suggestions, currentEntry, selDate, onSelectDate }) {
  const MOOD_EMOJI = { great:'🤩', happy:'😊', neutral:'😐', tired:'😴', sad:'😔', anxious:'😰', angry:'😤', love:'🥰' }
  const MOOD_COLOR = { great:'#fbbf24', happy:'#34d399', neutral:'#94a3b8', tired:'#a78bfa', sad:'#60a5fa', anxious:'#f97316', angry:'#f87171', love:'#f472b6' }

  const [tab, setTab] = useState('suggest') // 'suggest' | 'patterns' | 'words'

  const insights = useMemo(() => generateInsights(entries, habits, tasks), [entries, habits, tasks])
  const trend = useMemo(() => getMoodTrend(entries, 14), [entries])
  const keywords = useMemo(() => extractKeywords(entries.slice(0, 20), 20), [entries])
  const dowData = useMemo(() => getMoodByDow(entries), [entries])
  const entryScore = useMemo(() => currentEntry ? scoreEntry(currentEntry.body) : null, [currentEntry])

  return (
    <div style={{
      width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
      animation: 'slideInRight .2s ease',
    }}>
      {/* Заголовок */}
      <div style={{ display:'flex', alignItems:'center', gap:8, paddingLeft:2 }}>
        <span style={{ fontSize:16 }}>✨</span>
        <span style={{ fontSize:14, fontWeight:700, color:'var(--t)' }}>Инсайты</span>
        {entries.length > 0 && (
          <span style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', marginLeft:'auto' }}>
            {entries.length} записей
          </span>
        )}
      </div>

      {/* Вкладки */}
      <div style={{ display:'flex', borderRadius:10, border:'1px solid var(--line)', overflow:'hidden', flexShrink:0 }}>
        {[['suggest','💡 Советы'],['patterns','📊 Паттерны'],['words','☁️ Слова']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, padding:'6px 0', fontSize:11, border:'none', cursor:'pointer', fontWeight:600,
            background: tab===id ? 'var(--acc)' : 'transparent',
            color: tab===id ? '#fff' : 'var(--t-mute)', transition:'all .15s',
          }}>{label}</button>
        ))}
      </div>

      {/* Скроллируемый контент */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:10 }}>

        {/* ── Советы ── */}
        {tab === 'suggest' && (
          <>
            {/* Оценка текущей записи */}
            {entryScore && (
              <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--surf)', border:'1px solid var(--line)' }}>
                <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:8, fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>ЗАПИСЬ {selDate}</div>
                <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, padding:'3px 9px', borderRadius:99, background:'var(--surf-2)', color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>
                    {entryScore.wordCount} слов
                  </span>
                  <span style={{ fontSize:12, padding:'3px 9px', borderRadius:99,
                    background: entryScore.sentiment.label==='positive' ? 'rgba(52,211,153,.12)' : entryScore.sentiment.label==='negative' ? 'rgba(248,113,113,.12)' : 'var(--surf-2)',
                    color: entryScore.sentiment.label==='positive' ? '#34d399' : entryScore.sentiment.label==='negative' ? '#f87171' : 'var(--t-mute)',
                  }}>
                    {entryScore.sentiment.label==='positive' ? '😊 позитивно' : entryScore.sentiment.label==='negative' ? '😔 негативно' : '😐 нейтрально'}
                  </span>
                </div>
                {entryScore.themes.length > 0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {entryScore.themes.map(t => (
                      <span key={t.id} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--surf-hi)', color:'var(--t-mute)' }}>
                        {t.emoji} {t.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Персональные советы после сохранения */}
            {suggestions.length > 0 && (
              <div style={{ padding:'12px 14px', borderRadius:12, background:'color-mix(in oklch,var(--acc) 6%,transparent)', border:'1px solid var(--acc-line)' }}>
                <div style={{ fontSize:11, color:'var(--acc-text)', marginBottom:8, fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>ДЛЯ ТЕБЯ СЕЙЧАС</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {suggestions.map((s, i) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{s.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12.5, color:'var(--t)', lineHeight:1.5 }}>{s.text}</div>
                        {s.action && (
                          <button
                            onClick={() => { /* navigation handled by parent */ }}
                            style={{ marginTop:5, fontSize:11, padding:'3px 10px', borderRadius:99, border:'1px solid var(--acc-line)', background:'transparent', color:'var(--acc-text)', cursor:'pointer' }}
                          >→ {s.action}</button>
                        )}
                        {s.date && (
                          <button
                            onClick={() => onSelectDate(s.date)}
                            style={{ marginTop:5, fontSize:11, padding:'3px 10px', borderRadius:99, border:'1px solid var(--line)', background:'transparent', color:'var(--t-mute)', cursor:'pointer' }}
                          >Открыть запись</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Инсайты из паттернов */}
            {insights.map(ins => (
              <div key={ins.id} style={{
                padding:'12px 14px', borderRadius:12, border:'1px solid var(--line)',
                background: ins.type==='care' ? 'rgba(96,165,250,.07)' : ins.type==='correlation' ? 'rgba(167,139,250,.07)' : 'var(--surf)',
              }}>
                <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{ins.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12.5, fontWeight:700, color:'var(--t)', marginBottom:4 }}>{ins.title}</div>
                    <div style={{ fontSize:12, color:'var(--t-mute)', lineHeight:1.55 }}>{ins.text}</div>
                    {ins.tip && (
                      <div style={{ marginTop:6, fontSize:11.5, color:'var(--t-dim)', fontStyle:'italic', lineHeight:1.5 }}>💡 {ins.tip}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {suggestions.length === 0 && insights.length === 0 && (
              <div style={{ textAlign:'center', padding:'28px 16px', color:'var(--t-mute)', fontSize:12, lineHeight:1.6 }}>
                Сохрани запись —<br/>появятся персональные советы
              </div>
            )}
          </>
        )}

        {/* ── Паттерны ── */}
        {tab === 'patterns' && (
          <>
            {/* Тренд 14 дней */}
            <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--surf)', border:'1px solid var(--line)' }}>
              <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:10, fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>14 ДНЕЙ</div>
              <div style={{ display:'flex', gap:3, alignItems:'flex-end', flexWrap:'wrap' }}>
                {trend.map((d, i) => {
                  const color = d.mood ? MOOD_COLOR[d.mood] : 'var(--line)'
                  const emoji = d.mood ? MOOD_EMOJI[d.mood] : null
                  const dayLabel = new Date(d.date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'numeric'})
                  return (
                    <div
                      key={i}
                      title={`${dayLabel}${d.mood ? ' · ' + d.mood : ' · нет записи'}`}
                      onClick={() => d.haEntry && onSelectDate(d.date)}
                      style={{
                        width:16, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                        cursor: d.haEntry ? 'pointer' : 'default',
                        opacity: d.date > new Date().toISOString().slice(0,10) ? 0.3 : 1,
                      }}
                    >
                      <div style={{ fontSize:10, lineHeight:1 }}>{emoji || '·'}</div>
                      <div style={{ width:8, height: d.haEntry ? 24 : 8, borderRadius:4, background: d.haEntry ? color : 'var(--surf-hi)', transition:'height .15s' }} />
                      {i % 7 === 0 && <div style={{ fontSize:8, color:'var(--t-mute)', whiteSpace:'nowrap' }}>{dayLabel}</div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* По дням недели */}
            <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--surf)', border:'1px solid var(--line)' }}>
              <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:10, fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>НАСТРОЕНИЕ ПО ДНЯМ</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {dowData.map(d => (
                  <div key={d.day} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:20, fontSize:11, fontWeight:700, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>{d.day}</span>
                    <div style={{ flex:1, height:8, borderRadius:4, background:'var(--surf-hi)', overflow:'hidden' }}>
                      <div style={{
                        height:'100%', borderRadius:4, transition:'width .3s',
                        width: `${Math.max(0, Math.min(100, (d.score + 2) / 4 * 100))}%`,
                        background: d.score > 0.5 ? '#34d399' : d.score < -0.5 ? '#f87171' : 'var(--acc)',
                      }} />
                    </div>
                    <span style={{ fontSize:13, width:20, textAlign:'center' }}>
                      {d.topMood ? MOOD_EMOJI[d.topMood] : '—'}
                    </span>
                    {d.total > 0 && <span style={{ fontSize:10, color:'var(--t-mute)' }}>{d.total}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Тональность */}
            {entries.length >= 5 && (() => {
              const sents = entries.slice(0, 20).map(e => getSentiment(e.body))
              const avgPos = sents.reduce((s, x) => s + x.pos, 0) / sents.length
              const avgNeg = sents.reduce((s, x) => s + x.neg, 0) / sents.length
              const ratio = avgPos / Math.max(1, avgPos + avgNeg)
              return (
                <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--surf)', border:'1px solid var(--line)' }}>
                  <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:8, fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>ТОНАЛЬНОСТЬ ЗАПИСЕЙ</div>
                  <div style={{ display:'flex', gap:4, height:10, borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                    <div style={{ width:`${ratio*100}%`, background:'#34d399', borderRadius:'99px 0 0 99px', minWidth:4 }} />
                    <div style={{ flex:1, background:'#f87171', borderRadius:'0 99px 99px 0' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t-mute)' }}>
                    <span>😊 {Math.round(ratio * 100)}% позитивных</span>
                    <span>{Math.round((1-ratio)*100)}% негативных 😔</span>
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* ── Ключевые слова ── */}
        {tab === 'words' && (
          <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--surf)', border:'1px solid var(--line)' }}>
            <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:10, fontFamily:'"JetBrains Mono"', letterSpacing:'.04em' }}>ЧАСТО ВСТРЕЧАЮТСЯ</div>
            {keywords.length === 0 ? (
              <div style={{ textAlign:'center', padding:16, color:'var(--t-mute)', fontSize:12 }}>Нужно больше записей</div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {keywords.map((kw, i) => {
                  const maxScore = keywords[0]?.score || 1
                  const size = 11 + Math.round((kw.score / maxScore) * 7)
                  const opacity = 0.5 + (kw.score / maxScore) * 0.5
                  return (
                    <span key={kw.word} style={{
                      fontSize: size, fontWeight: i < 5 ? 700 : 500,
                      color: `color-mix(in oklch, var(--acc) ${Math.round(opacity*100)}%, var(--t-mute))`,
                      padding:'3px 8px', borderRadius:99,
                      background: i < 3 ? 'color-mix(in oklch,var(--acc) 10%,transparent)' : 'var(--surf-2)',
                      border:`1px solid ${i < 3 ? 'var(--acc-line)' : 'var(--line)'}`,
                      cursor:'default',
                    }} title={`встречается ${kw.freq} раз`}>
                      {kw.word}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Панель обучающих материалов ── */}
      {showLearn && learnQuery && (
        <LearnPanel query={learnQuery} onClose={() => setShowLearn(false)} />
      )}
    </div>
  )
}
