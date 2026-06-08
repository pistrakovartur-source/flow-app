import { useState, useEffect, useMemo, useCallback } from 'react'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'

// ── Утилиты ──────────────────────────────────────────────────────────────────

const APP_COLORS = [
  '#5b8dee','#f87171','#34d399','#fbbf24','#a78bfa',
  '#f472b6','#60a5fa','#fb923c','#2dd4bf','#e879f9',
]

function appColor(name) {
  if (!name) return '#888'
  let h = 0
  for (const c of (name || '').toLowerCase()) h = ((h * 31) + c.charCodeAt(0)) | 0
  return APP_COLORS[Math.abs(h) % APP_COLORS.length]
}

const APP_NAME_MAP = {
  chrome:      'Google Chrome',
  msedge:      'Microsoft Edge',
  firefox:     'Firefox',
  opera:       'Opera',
  brave:       'Brave',
  code:        'VS Code',
  devenv:      'Visual Studio',
  rider:       'Rider',
  idea64:      'IntelliJ IDEA',
  pycharm64:   'PyCharm',
  winword:     'Microsoft Word',
  excel:       'Microsoft Excel',
  powerpnt:    'PowerPoint',
  outlook:     'Outlook',
  onenote:     'OneNote',
  teams:       'Teams',
  slack:       'Slack',
  telegram:    'Telegram',
  discord:     'Discord',
  zoom:        'Zoom',
  notepad:     'Блокнот',
  'notepad++': 'Notepad++',
  sublimetext: 'Sublime Text',
  explorer:    'Проводник',
  taskmgr:     'Диспетчер задач',
  cmd:         'Командная строка',
  powershell:  'PowerShell',
  windowsterminal: 'Windows Terminal',
  electron:    'Flow',
  flow:        'Flow',
}

function friendlyAppName(raw) {
  const key = (raw || '').toLowerCase().replace(/\.exe$/, '')
  return APP_NAME_MAP[key] || raw || 'Неизвестно'
}

function fmtDuration(ms) {
  if (!ms || ms < 60000) return `${Math.round((ms||0)/1000)} сек`
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h} ч ${m % 60} мин`
  return `${m} мин`
}

function fmtTime(isoStr) {
  if (!isoStr) return ''
  try { return new Date(isoStr).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) } catch { return '' }
}

function fmtDateTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60)    return 'только что'
    if (diff < 3600)  return `${Math.floor(diff/60)} мин назад`
    if (diff < 86400) return `сегодня в ${d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`
    return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
  } catch { return '' }
}

// Объединяет подряд идущие сессии одного приложения/окна в одну запись
function mergeConsecutive(log) {
  if (!log.length) return log
  const out = [{ ...log[0] }]
  for (let i = 1; i < log.length; i++) {
    const prev = out[out.length - 1]
    const curr = log[i]
    if (prev.appName === curr.appName && prev.windowTitle === curr.windowTitle) {
      prev.endTs    = curr.endTs
      prev.durationMs = (prev.durationMs || 0) + (curr.durationMs || 0)
    } else {
      out.push({ ...curr })
    }
  }
  return out
}

// ── Главный экран ────────────────────────────────────────────────────────────

export function Activity() {
  const [tab, setTab]           = useState('timeline')
  const today                   = new Date().toISOString().slice(0,10)
  const [selectedDate, setDate] = useState(today)
  const [log, setLog]           = useState([])
  const [history, setHistory]   = useState([])
  const [files, setFiles]       = useState([])
  const [logLoading, setLogLoading]   = useState(false)
  const [histLoading, setHistLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [histLoaded, setHistLoaded]   = useState(false)
  const [filesLoaded, setFilesLoaded] = useState(false)
  const [refreshKey, setRefreshKey]   = useState(0)

  // Трекинг стартует при открытии экрана
  useEffect(() => {
    window.jarvis?.activity?.start?.()
  }, [])

  // Загрузка лога при смене даты или обновлении
  useEffect(() => {
    setLogLoading(true)
    window.jarvis?.activity?.getLog?.(selectedDate)
      .then(d => setLog(mergeConsecutive(d || [])))
      .catch(() => setLog([]))
      .finally(() => setLogLoading(false))
  }, [selectedDate, refreshKey])

  // История браузера — загружаем один раз при переходе на вкладку
  useEffect(() => {
    if (tab !== 'browser' || histLoaded) return
    setHistLoading(true)
    window.jarvis?.activity?.getBrowserHistory?.(200)
      .then(d => { setHistory(d || []); setHistLoaded(true) })
      .catch(() => { setHistory([]); setHistLoaded(true) })
      .finally(() => setHistLoading(false))
  }, [tab])

  // Файлы — загружаем один раз при переходе на вкладку
  useEffect(() => {
    if (tab !== 'files' || filesLoaded) return
    setFilesLoading(true)
    window.jarvis?.activity?.getRecentFiles?.()
      .then(d => { setFiles(d || []); setFilesLoaded(true) })
      .catch(() => { setFiles([]); setFilesLoaded(true) })
      .finally(() => setFilesLoading(false))
  }, [tab])

  const TABS = [
    { id:'timeline', label:'Таймлайн',    icon:'clock' },
    { id:'apps',     label:'Приложения',  icon:'grid'  },
    { id:'browser',  label:'Браузер',     icon:'link'  },
    { id:'files',    label:'Файлы',       icon:'note'  },
  ]

  // Итоговая статистика дня
  const totalTracked = useMemo(() => log.reduce((s,x) => s + (x.durationMs||0), 0), [log])

  const exportActivityCSV = () => {
    const lines = ['Приложение,Окно,Начало,Конец,Длительность (мин)']
    log.forEach(s => {
      const start = new Date(s.startTs).toLocaleTimeString('ru-RU')
      const end   = s.endTs ? new Date(s.endTs).toLocaleTimeString('ru-RU') : ''
      const dur   = Math.round((s.durationMs||0) / 60000)
      lines.push(`"${friendlyAppName(s.appName)}","${(s.windowTitle||'').replace(/"/g,'""')}","${start}","${end}",${dur}`)
    })
    const blob = new Blob(['﻿' + lines.join('\n')], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `activity-${selectedDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view">
      {/* Заголовок */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:18, marginBottom:22 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">Мониторинг</div>
          <div className="pg-title">Активность</div>
          <div className="pg-sub">
            {log.length > 0 ? `Отслежено ${fmtDuration(totalTracked)} за выбранный день` : 'История активности на вашем устройстве'}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Пульсирующий индикатор */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:99, background:'color-mix(in oklch,var(--c-calm) 12%,transparent)', border:'1px solid color-mix(in oklch,var(--c-calm) 30%,transparent)' }}>
            <div style={{ width:7, height:7, borderRadius:99, background:'var(--c-calm)', boxShadow:'0 0 5px var(--c-calm)', animation:'orbPulse 2s ease infinite' }}/>
            <span style={{ fontSize:12, color:'var(--c-calm)', fontFamily:'"JetBrains Mono"' }}>трекинг активен</span>
          </div>
          {/* Кнопка обновить */}
          <button onClick={() => { setRefreshKey(k => k+1); setHistLoaded(false); setFilesLoaded(false) }}
            className="tb-btn" style={{ fontSize:12, padding:'5px 11px' }}>
            <Icon name="repeat" size={13}/> Обновить
          </button>
          {/* CSV экспорт */}
          {tab === 'apps' && log.length > 0 && (
            <button onClick={exportActivityCSV} className="tb-btn" style={{ fontSize:12, padding:'5px 11px' }}>
              <Icon name="note" size={13}/> CSV
            </button>
          )}
          {/* Выбор даты */}
          <input type="date" value={selectedDate} max={today}
            onChange={e => setDate(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', cursor:'pointer' }}
          />
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ display:'flex', gap:4, background:'var(--surf-2)', borderRadius:10, padding:4, border:'1px solid var(--line)', marginBottom:20, width:'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'6px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:500, transition:'all .15s', display:'flex', alignItems:'center', gap:6,
              background: tab===t.id ? 'var(--acc)' : 'transparent',
              color:      tab===t.id ? '#fff' : 'var(--t-mute)',
              boxShadow:  tab===t.id ? '0 2px 8px color-mix(in oklch, var(--acc) 40%, transparent)' : 'none',
            }}>
            <Icon name={t.icon} size={13}/>
            {t.label}
          </button>
        ))}
      </div>

      {/* Содержимое вкладок */}
      {tab === 'timeline' && (logLoading
        ? <Spinner/>
        : <TimelineView log={log} date={selectedDate} isToday={selectedDate === today} />
      )}
      {tab === 'apps' && (logLoading
        ? <Spinner/>
        : <AppStatsView log={log} />
      )}
      {tab === 'browser' && (histLoading
        ? <Spinner text="Читаю историю браузера…"/>
        : <BrowserHistoryView history={history} />
      )}
      {tab === 'files' && (filesLoading
        ? <Spinner text="Читаю недавние файлы…"/>
        : <RecentFilesView files={files} />
      )}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ text = 'Загрузка…' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 0', color:'var(--t-mute)' }}>
      <div style={{ width:32, height:32, borderRadius:99, border:'3px solid var(--surf-hi)', borderTopColor:'var(--acc)', animation:'spin 0.8s linear infinite' }}/>
      <div style={{ fontSize:13 }}>{text}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Таймлайн ─────────────────────────────────────────────────────────────────

function TimelineView({ log, date, isToday }) {
  const nowPct = useMemo(() => {
    if (!isToday) return null
    const n = new Date()
    return (n.getHours() * 60 + n.getMinutes()) / (24 * 60) * 100
  }, [isToday])

  const uniqueApps = useMemo(() => [...new Set(log.map(s => s.appName))], [log])

  if (!log.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 0', color:'var(--t-mute)' }}>
        <Icon name="history" size={40} style={{ opacity:.15 }}/>
        <div style={{ fontWeight:600, fontSize:15 }}>Нет данных за выбранный день</div>
        <div style={{ fontSize:13, color:'var(--t-mute)', maxWidth:360, textAlign:'center', lineHeight:1.6 }}>
          Приложение записывает активность каждые 10 секунд. Данные появятся через некоторое время.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* 24-часовая полоска */}
      <div className="card">
        <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:14 }}>
          24-часовая шкала
        </div>
        {/* Метки часов */}
        <div style={{ position:'relative', height:18, marginBottom:4 }}>
          {[0,4,8,12,16,20].map(h => (
            <div key={h} style={{ position:'absolute', left:`${h/24*100}%`, fontSize:9.5, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', transform:'translateX(-50%)' }}>
              {String(h).padStart(2,'0')}:00
            </div>
          ))}
        </div>
        {/* Полоска */}
        <div style={{ position:'relative', height:48, background:'var(--surf-hi)', borderRadius:10, overflow:'hidden' }}>
          {log.map((s, i) => {
            const start   = new Date(s.startTs)
            const end     = new Date(s.endTs || new Date())
            const startMin = start.getHours() * 60 + start.getMinutes()
            const endMin   = end.getHours()   * 60 + end.getMinutes()
            const left  = (startMin / 1440) * 100
            const width = Math.max(((endMin - startMin) / 1440) * 100, 0.2)
            return (
              <div key={i} title={`${friendlyAppName(s.appName)}\n${fmtTime(s.startTs)} – ${fmtTime(s.endTs)}\n${fmtDuration(s.durationMs)}`}
                style={{ position:'absolute', top:0, height:'100%', left:`${left}%`, width:`${width}%`, background:appColor(s.appName), opacity:0.9, transition:'opacity .15s', cursor:'default' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                onMouseLeave={e=>e.currentTarget.style.opacity='0.9'}
              />
            )
          })}
          {/* Линия текущего времени */}
          {nowPct !== null && (
            <div style={{ position:'absolute', top:0, height:'100%', left:`${nowPct}%`, width:2, background:'rgba(255,255,255,0.9)', boxShadow:'0 0 8px rgba(255,255,255,0.6)', zIndex:10 }}/>
          )}
        </div>
        {/* Легенда */}
        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          {uniqueApps.slice(0, 10).map(name => (
            <div key={name} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:99, background:'var(--surf-hi)', border:'1px solid var(--line)' }}>
              <div style={{ width:8, height:8, borderRadius:2, background:appColor(name), flexShrink:0 }}/>
              <span style={{ fontSize:11, color:'var(--t-dim)' }}>{friendlyAppName(name)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Список сессий */}
      <div className="card">
        <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:12 }}>
          Сессии ({log.length})
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {[...log].reverse().map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, background:'var(--surf-2)', border:'1px solid var(--line)' }}>
              <div style={{ width:10, height:10, borderRadius:3, flexShrink:0, background:appColor(s.appName) }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {friendlyAppName(s.appName)}
                </div>
                {s.windowTitle && s.windowTitle !== s.appName && (
                  <div style={{ fontSize:11.5, color:'var(--t-mute)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>
                    {s.windowTitle}
                  </div>
                )}
              </div>
              <div style={{ fontFamily:'"JetBrains Mono"', fontSize:11, color:'var(--t-mute)', flexShrink:0 }}>
                {fmtTime(s.startTs)}
              </div>
              <div style={{ height:16, width:1, background:'var(--line)' }}/>
              <div style={{ fontFamily:'"JetBrains Mono"', fontSize:11.5, color:'var(--t-dim)', flexShrink:0, minWidth:54, textAlign:'right' }}>
                {fmtDuration(s.durationMs)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Статистика приложений ─────────────────────────────────────────────────────

function AppStatsView({ log }) {
  const stats = useMemo(() => {
    const map = {}
    for (const s of log) {
      const key = s.appName || 'unknown'
      if (!map[key]) map[key] = { name: key, totalMs: 0, sessions: 0 }
      map[key].totalMs  += s.durationMs || 0
      map[key].sessions += 1
    }
    return Object.values(map).sort((a, b) => b.totalMs - a.totalMs)
  }, [log])

  const maxMs      = Math.max(...stats.map(a => a.totalMs), 1)
  const totalMs    = stats.reduce((s, a) => s + a.totalMs, 0)
  const totalSess  = log.length

  if (!stats.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 0', color:'var(--t-mute)' }}>
        <Icon name="timer" size={40} style={{ opacity:.15 }}/>
        <div style={{ fontWeight:600, fontSize:15 }}>Нет данных</div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Карточки */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          { label:'Всего отслежено',   val:fmtDuration(totalMs), icon:'clock', color:'var(--acc-text)' },
          { label:'Приложений',        val:stats.length,         icon:'grid',  color:'#a78bfa'            },
          { label:'Сессий',            val:totalSess,            icon:'repeat',color:'#fbbf24'            },
        ].map(s => (
          <div key={s.label} className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`color-mix(in oklch,${s.color} 15%,transparent)`, display:'grid', placeItems:'center', color:s.color, flexShrink:0 }}>
              <Icon name={s.icon} size={17}/>
            </div>
            <div>
              <div style={{ fontFamily:'"Space Grotesk"', fontSize:20, fontWeight:700, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:11.5, color:'var(--t-mute)', marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Бары */}
      <div className="card">
        <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:16 }}>
          Время по приложениям
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {stats.map(app => {
            const pct   = (app.totalMs / maxMs) * 100
            const color = appColor(app.name)
            const sharePct = totalMs > 0 ? Math.round(app.totalMs / totalMs * 100) : 0
            return (
              <div key={app.name}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0 }}/>
                    <span style={{ fontSize:13.5, fontWeight:500 }}>{friendlyAppName(app.name)}</span>
                    <span style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>
                      {app.sessions} сессий
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:11, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"' }}>{sharePct}%</span>
                    <span style={{ fontFamily:'"JetBrains Mono"', fontSize:13, color:'var(--t-dim)', minWidth:70, textAlign:'right' }}>
                      {fmtDuration(app.totalMs)}
                    </span>
                  </div>
                </div>
                <div style={{ height:7, borderRadius:99, background:'var(--surf-hi)' }}>
                  <div style={{ height:'100%', borderRadius:99, background:color, width:`${pct}%`, transition:'width .5s ease', boxShadow:`0 0 8px ${color}55` }}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── История браузера ──────────────────────────────────────────────────────────

function BrowserHistoryView({ history }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return history
    const q = search.toLowerCase()
    return history.filter(h =>
      (h.title||'').toLowerCase().includes(q) ||
      (h.url||'').toLowerCase().includes(q)
    )
  }, [history, search])

  if (!history.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 0', color:'var(--t-mute)' }}>
        <Icon name="link" size={40} style={{ opacity:.15 }}/>
        <div style={{ fontWeight:600, fontSize:15 }}>История браузера недоступна</div>
        <div style={{ fontSize:13, color:'var(--t-mute)', maxWidth:380, textAlign:'center', lineHeight:1.6 }}>
          Поддерживаются Chrome, Edge и Firefox. Если браузер открыт, попробуй закрыть его, нажать «Обновить» и зайти снова на эту вкладку.
        </div>
      </div>
    )
  }

  const BROWSER_COLORS = { Chrome:'#4285f4', Edge:'#0078d4', Firefox:'#ff7139' }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <Icon name="search" size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t-mute)', pointerEvents:'none' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по истории…"
            style={{ width:'100%', padding:'7px 11px 7px 32px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}
          />
        </div>
        <span style={{ fontSize:12, color:'var(--t-mute)', fontFamily:'"JetBrains Mono"', flexShrink:0 }}>
          {filtered.length} записей
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {filtered.slice(0, 150).map((item, i) => {
          let domain = ''
          try { domain = new URL(item.url).hostname.replace('www.','') } catch {}
          const bc = BROWSER_COLORS[item.browser] || 'var(--acc)'
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, background:'var(--surf-2)', border:'1px solid var(--line)' }}>
              <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, display:'grid', placeItems:'center', background:`color-mix(in oklch,${bc} 14%,transparent)`, fontSize:11.5, fontWeight:700, color:bc }}>
                {domain.slice(0,2).toUpperCase() || '?'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {item.title || domain || '(без заголовка)'}
                </div>
                <div style={{ fontSize:11.5, color:'var(--t-mute)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>
                  <span style={{ color:bc, marginRight:6 }}>{item.browser}</span>
                  {domain}
                </div>
              </div>
              <div style={{ fontFamily:'"JetBrains Mono"', fontSize:11, color:'var(--t-mute)', flexShrink:0, textAlign:'right' }}>
                {fmtDateTime(item.visitedAt)}
              </div>
            </div>
          )
        })}
        {filtered.length > 150 && (
          <div style={{ textAlign:'center', padding:'10px 0', fontSize:12, color:'var(--t-mute)' }}>
            Показано 150 из {filtered.length}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Недавние файлы ────────────────────────────────────────────────────────────

const EXT_ICONS = {
  docx:'📄', doc:'📄', pdf:'📕', xlsx:'📊', xls:'📊',
  pptx:'📊', ppt:'📊', txt:'📝', md:'📝', csv:'📊',
  jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', webp:'🖼️',
  mp4:'🎬', avi:'🎬', mkv:'🎬', mp3:'🎵', wav:'🎵',
  zip:'📦', rar:'📦', '7z':'📦',
  js:'⚙️', ts:'⚙️', py:'🐍', java:'☕',
  json:'⚙️', html:'🌐', css:'🎨', xml:'⚙️',
  exe:'⚙️', msi:'⚙️',
}

function fileIcon(filePath) {
  const ext = (filePath||'').split('.').pop()?.toLowerCase()
  return EXT_ICONS[ext] || '📄'
}

function fileName(filePath) {
  if (!filePath) return 'Неизвестный файл'
  return filePath.split(/[/\\]/).pop() || filePath
}

function RecentFilesView({ files }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return files
    const q = search.toLowerCase()
    return files.filter(f => fileName(f.path).toLowerCase().includes(q) || (f.path||'').toLowerCase().includes(q))
  }, [files, search])

  if (!files.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 0', color:'var(--t-mute)' }}>
        <Icon name="note" size={40} style={{ opacity:.15 }}/>
        <div style={{ fontWeight:600, fontSize:15 }}>Недавние файлы не найдены</div>
        <div style={{ fontSize:13, color:'var(--t-mute)', maxWidth:360, textAlign:'center', lineHeight:1.6 }}>
          Открой любой документ, папку или файл в Windows — он появится здесь после нажатия «Обновить».
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position:'relative', marginBottom:14 }}>
        <Icon name="search" size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t-mute)', pointerEvents:'none' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по файлам…"
          style={{ width:'100%', padding:'7px 11px 7px 32px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}
        />
      </div>
      <div className="card">
        <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:14 }}>
          Недавние файлы Windows ({filtered.length})
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {filtered.map((f, i) => {
            const name = fileName(f.path)
            const icon = fileIcon(f.path)
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 10px', borderRadius:9, background:'var(--surf-2)', border:'1px solid var(--line)' }}>
                <div style={{ fontSize:20, flexShrink:0, width:32, textAlign:'center' }}>{icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:500, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                  <div style={{ fontSize:11.5, color:'var(--t-mute)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{f.path}</div>
                </div>
                <div style={{ fontFamily:'"JetBrains Mono"', fontSize:11, color:'var(--t-mute)', flexShrink:0, textAlign:'right' }}>
                  {fmtDateTime(f.modifiedAt)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
