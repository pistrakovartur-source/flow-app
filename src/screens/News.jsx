import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'
import { timeAgo } from '../utils/date'

// ── RSS источники ──────────────────────────────────────────────────────────
const RSS_SOURCES = [
  { url: 'https://habr.com/ru/rss/all/all/',         name: 'Хабр',        tags: ['Технологии', 'Программирование'] },
  { url: 'https://hnrss.org/frontpage',               name: 'Hacker News', tags: ['Технологии'] },
  { url: 'https://lenta.ru/rss/news',                 name: 'Лента.ру',    tags: ['Новости', 'Россия'] },
  { url: 'https://rss.rbc.ru/v10/main.rss',           name: 'РБК',         tags: ['Финансы', 'Бизнес'] },
  { url: 'https://feeds.bbci.co.uk/russian/rss.xml',  name: 'BBC Русская', tags: ['Мир', 'Политика'] },
  { url: 'https://techcrunch.com/feed/',              name: 'TechCrunch',  tags: ['Технологии', 'Стартапы'] },
]

const SOURCE_COLOR = {
  'Хабр':        '#f87c1f',
  'Hacker News': '#ff6600',
  'Лента.ру':    '#0066cc',
  'РБК':         '#cc0000',
  'BBC Русская': '#bb1919',
  'TechCrunch':  '#0d8a41',
}

const CACHE_TTL = 30 * 60 * 1000 // 30 мин

// ── Парсинг RSS/Atom ───────────────────────────────────────────────────────
function parseFeed(xmlText, source) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
    const isAtom = doc.documentElement.tagName.toLowerCase() === 'feed'
    const items = Array.from(doc.querySelectorAll(isAtom ? 'entry' : 'item'))

    return items.slice(0, 18).map(item => {
      // title
      let title = item.querySelector('title')?.textContent?.trim() || ''
      title = title.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()

      // link
      let url = ''
      if (isAtom) {
        const linkEl = item.querySelector('link[rel="alternate"], link')
        url = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || ''
      } else {
        const linkEls = item.getElementsByTagName('link')
        for (const el of linkEls) {
          const href = el.getAttribute('href') || el.textContent?.trim() || ''
          if (href.startsWith('http')) { url = href; break }
        }
      }

      // description
      const rawDesc = item.querySelector(isAtom ? 'summary, content' : 'description')?.textContent?.trim() || ''
      const description = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)

      // date
      const dateStr = item.querySelector(
        isAtom ? 'published, updated' : 'pubDate'
      )?.textContent?.trim() || ''
      const parsedTs = dateStr ? new Date(dateStr).getTime() : NaN
      const pubDate  = isNaN(parsedTs) ? Date.now() : parsedTs

      // image
      let imageUrl = ''
      const enclosure = item.querySelector('enclosure[type^="image"]')
      if (enclosure) imageUrl = enclosure.getAttribute('url') || ''
      if (!imageUrl) {
        for (const ns of ['http://search.yahoo.com/mrss/', '']) {
          const el = ns
            ? (item.getElementsByTagNameNS(ns, 'content')[0] || item.getElementsByTagNameNS(ns, 'thumbnail')[0])
            : null
          if (el) { imageUrl = el.getAttribute('url') || ''; break }
        }
      }
      if (!imageUrl) {
        const m = rawDesc.match(/src=["']([^"']+\.(?:jpg|jpeg|png|webp))/i)
        if (m) imageUrl = m[1]
      }

      return { id: url || `${source.name}::${title}`, title, url, description, imageUrl, pubDate, source: source.name, sourceTags: source.tags }
    }).filter(a => a.title && a.url)
  } catch { return [] }
}

// ── Вспомогательные ───────────────────────────────────────────────────────
// timeAgo импортирован из utils/date.js

function scoreArticle(article, weights, reactions) {
  if (reactions[article.id] === 'dislike') return -999
  const topicScore = article.sourceTags.reduce((s, t) => s + (weights[t] ?? 1), 0)
  const ageH = (Date.now() - article.pubDate) / 3600000
  const freshness = Math.max(0, 1 - ageH / 72)
  return topicScore * (0.65 + 0.35 * freshness)
}

// ── Главный экран ──────────────────────────────────────────────────────────
export function News() {
  const [profile]  = useStore('profile', {})
  const [tasks]    = useStore('tasks', [])
  const [cache,     setCache]     = useStore('news_cache', null)
  const [reactions, setReactions] = useStore('news_reactions', {})
  const [weights,   setWeights]   = useStore('news_topic_weights', {})
  const [userTopics, setUserTopics] = useStore('news_user_topics', [])
  const [savedNews,  setSavedNews]  = useStore('news_saved', [])

  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [activeTopic,  setActiveTopic]  = useState('Все')
  const [addingTopic,  setAddingTopic]  = useState(false)
  const [newTopicText, setNewTopicText] = useState('')

  const articles   = cache?.articles || []
  const fetchedAt  = cache?.ts || null

  // Темы: фиксированные + из профиля + из тегов задач + пользовательские
  const profileTopics = Array.isArray(profile?.interests) ? profile.interests : []
  const taskTags      = [...new Set((tasks || []).map(t => t.tag).filter(Boolean))]
  const baseTags      = [...new Set(RSS_SOURCES.flatMap(s => s.tags))]
  const allTopics     = ['Все', '🔖 Сохранённое', ...new Set([...baseTags, ...profileTopics, ...taskTags, ...userTopics])]

  const toggleSave = (article) => {
    setSavedNews(prev => {
      const exists = (prev||[]).some(a => a.id === article.id)
      if (exists) return (prev||[]).filter(a => a.id !== article.id)
      return [...(prev||[]), { ...article, savedAt: Date.now() }]
    })
  }
  const savedIds = new Set((savedNews||[]).map(a => a.id))

  const fetchNews = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return
    setLoading(true)
    setError(null)
    try {
      const settled = await Promise.allSettled(
        RSS_SOURCES.map(async src => {
          const res = await window.jarvis?.news?.fetch(src.url)
          if (!res || res.error || !res.text) return []
          return parseFeed(res.text, src)
        })
      )
      const all = settled
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value)
      const seen = new Set()
      const unique = all.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true })
      setCache({ ts: Date.now(), articles: unique })
    } catch {
      setError('Не удалось загрузить новости — проверь подключение')
    } finally {
      setLoading(false)
    }
  }, [cache])

  useEffect(() => { fetchNews() }, [])

  // Реакция на статью
  const react = (article, reaction) => {
    const cur = reactions[article.id]
    const r   = { ...reactions }
    const w   = { ...weights }

    const adjust = (tags, dir) => tags.forEach(t => {
      w[t] = Math.max(0.1, (w[t] ?? 1) + dir)
    })

    if (cur === reaction) {
      delete r[article.id]
      adjust(article.sourceTags, reaction === 'like' ? -1 : +0.5)
    } else {
      if (cur === 'like')    adjust(article.sourceTags, -1)
      if (cur === 'dislike') adjust(article.sourceTags, +0.5)
      r[article.id] = reaction
      adjust(article.sourceTags, reaction === 'like' ? +1 : -0.5)
    }
    setReactions(r)
    setWeights(w)
  }

  const addTopic = () => {
    const t = newTopicText.trim()
    if (!t) return
    setUserTopics([...userTopics, t])
    setNewTopicText('')
    setAddingTopic(false)
  }

  const removeTopic = (t) => setUserTopics(userTopics.filter(u => u !== t))

  const filtered = (activeTopic === '🔖 Сохранённое' ? (savedNews||[]) : articles
    .filter(a => activeTopic === 'Все' || a.sourceTags.includes(activeTopic))
    .filter(a => reactions[a.id] !== 'dislike')
    .sort((a, b) => scoreArticle(b, weights, reactions) - scoreArticle(a, weights, reactions)))

  return (
    <div className="view">
      {/* Заголовок */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:18 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">персональный фид</div>
          <div className="pg-title">Новости</div>
          <div className="pg-sub">
            {fetchedAt ? `Обновлено ${timeAgo(fetchedAt)}` : 'Загружаю актуальный фид…'}
          </div>
        </div>
        <button
          className="tb-btn"
          style={{ gap:6, fontSize:13, marginTop:6 }}
          onClick={() => fetchNews(true)}
          disabled={loading}
        >
          <Icon name="refresh" size={14} style={loading ? { animation:'spin 1s linear infinite' } : {}} />
          {loading ? 'Загрузка…' : 'Обновить'}
        </button>
      </div>

      {/* Фильтр по темам */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:20 }}>
        {allTopics.map(t => {
          const w = weights[t]
          const boosted  = w && w > 1.5
          const muted    = w && w < 0.7
          return (
            <button
              key={t}
              onClick={() => setActiveTopic(t)}
              style={{
                padding:'5px 13px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
                border: activeTopic === t ? 'none' : '1px solid var(--line)',
                background: activeTopic === t ? 'var(--acc)' : 'var(--surf-2)',
                color: activeTopic === t ? '#fff' : muted ? 'var(--t-mute)' : 'var(--t-mute)',
                transition:'all .15s', display:'flex', alignItems:'center', gap:4,
              }}
            >
              {t}
              {t !== 'Все' && boosted  && <span style={{ fontSize:9, opacity:.8 }}>↑</span>}
              {t !== 'Все' && muted    && <span style={{ fontSize:9, opacity:.8 }}>↓</span>}
            </button>
          )
        })}

        {/* Пользовательские темы — крестик */}
        {userTopics.map(t => (
          <button
            key={`rm-${t}`}
            onClick={() => removeTopic(t)}
            title={`Удалить тему «${t}»`}
            style={{ padding:'5px 8px', borderRadius:99, fontSize:11, cursor:'pointer', border:'1px dashed var(--line)', background:'transparent', color:'var(--t-mute)' }}
          >
            ×
          </button>
        ))}

        {/* Добавить тему */}
        {addingTopic ? (
          <div style={{ display:'flex', gap:4 }}>
            <input
              autoFocus
              value={newTopicText}
              onChange={e => setNewTopicText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTopic(); if (e.key === 'Escape') setAddingTopic(false) }}
              placeholder="Тема…"
              style={{ padding:'4px 10px', borderRadius:99, fontSize:12, background:'var(--surf-2)', border:'1px solid var(--acc)', color:'var(--t)', outline:'none', width:110 }}
            />
            <button className="btn-primary" style={{ padding:'4px 10px', fontSize:12, borderRadius:99 }} onClick={addTopic}>+</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTopic(true)}
            style={{ padding:'5px 10px', borderRadius:99, fontSize:12, border:'1px dashed var(--line)', background:'transparent', color:'var(--t-mute)', cursor:'pointer' }}
          >
            + Тема
          </button>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <div style={{ padding:'12px 16px', background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)', borderRadius:12, color:'#f87171', fontSize:13, marginBottom:16 }}>
          {error}
        </div>
      )}

      {/* Скелет загрузки */}
      {loading && articles.length === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height:200, borderRadius:'var(--r)', background:'var(--surf)', border:'1px solid var(--line)', opacity:.5 }} />
          ))}
        </div>
      )}

      {/* Сетка статей */}
      {filtered.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {filtered.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              reaction={reactions[article.id]}
              saved={savedIds.has(article.id)}
              onReact={r => react(article, r)}
              onSave={() => toggleSave(article)}
              onOpen={() => window.jarvis?.openUrl(article.url)}
            />
          ))}
        </div>
      )}

      {/* Пусто — нет статей по теме */}
      {!loading && filtered.length === 0 && articles.length > 0 && (
        <EmptyState icon="🗞" text={`Нет новостей по теме «${activeTopic}»`} />
      )}

      {/* Пусто — ещё не загружено */}
      {!loading && articles.length === 0 && !error && (
        <EmptyState icon="📰" text="Нажми «Обновить», чтобы загрузить новости" />
      )}
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'72px 0', color:'var(--t-mute)' }}>
      <div style={{ fontSize:40, marginBottom:14 }}>{icon}</div>
      <div style={{ fontSize:14 }}>{text}</div>
    </div>
  )
}

// ── Карточка статьи ────────────────────────────────────────────────────────
function ArticleCard({ article, reaction, saved, onReact, onSave, onOpen }) {
  const [imgErr, setImgErr] = useState(false)
  const color = SOURCE_COLOR[article.source] || 'var(--acc)'

  return (
    <div
      style={{
        background:'var(--surf)', border:'1px solid var(--line)',
        borderRadius:'var(--r)', overflow:'hidden',
        display:'flex', flexDirection:'column',
        transition:'box-shadow .15s, transform .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,.18)'; e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform='' }}
    >
      {/* Картинка */}
      {article.imageUrl && !imgErr && (
        <div style={{ height:130, overflow:'hidden', flexShrink:0, background:'var(--surf-2)' }}>
          <img
            src={article.imageUrl}
            alt=""
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            onError={() => setImgErr(true)}
          />
        </div>
      )}

      {/* Тело */}
      <div style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        {/* Источник + время */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
            background:`${color}22`, color,
          }}>
            {article.source}
          </span>
          <span style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>
            {timeAgo(article.pubDate)}
          </span>
        </div>

        {/* Заголовок */}
        <div style={{
          fontSize:13.5, fontWeight:600, lineHeight:1.45, color:'var(--t)',
          display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
        }}>
          {article.title}
        </div>

        {/* Описание */}
        {article.description && (
          <div style={{
            fontSize:12, color:'var(--t-dim)', lineHeight:1.55,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            {article.description}
          </div>
        )}

        {/* Действия */}
        <div style={{
          display:'flex', gap:6, marginTop:'auto', paddingTop:10,
          borderTop:'1px solid var(--line)', alignItems:'center',
        }}>
          <ReactionBtn
            active={reaction === 'like'}
            activeColor="#22c55e"
            onClick={() => onReact('like')}
            title="Нравится — больше таких тем"
            label="👍"
          />
          <ReactionBtn
            active={reaction === 'dislike'}
            activeColor="#f87171"
            onClick={() => onReact('dislike')}
            title="Не интересно — скрыть"
            label="👎"
          />
          <button onClick={onSave} title={saved ? 'Убрать из сохранённого' : 'Сохранить на потом'}
            style={{ padding:'4px 8px', borderRadius:99, fontSize:13, border:'1px solid', cursor:'pointer', transition:'all .15s',
              borderColor: saved ? 'rgba(251,191,36,.4)' : 'var(--line)',
              background:  saved ? 'rgba(251,191,36,.12)' : 'transparent',
              color:       saved ? '#fbbf24' : 'var(--t-mute)',
            }}>
            🔖
          </button>
          <button
            onClick={onOpen}
            style={{
              marginLeft:'auto', padding:'4px 12px', borderRadius:99, fontSize:12,
              border:'1px solid var(--line)', background:'transparent',
              color:'var(--t-mute)', cursor:'pointer',
              display:'flex', alignItems:'center', gap:4, transition:'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color='var(--t)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--t-mute)'}
          >
            Читать →
          </button>
        </div>
      </div>
    </div>
  )
}

function ReactionBtn({ active, activeColor, onClick, title, label }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding:'4px 10px', borderRadius:99, fontSize:13, cursor:'pointer', transition:'all .15s',
        border:`1px solid ${active ? activeColor : 'var(--line)'}`,
        background: active ? `${activeColor}22` : 'transparent',
      }}
    >
      {label}
    </button>
  )
}
