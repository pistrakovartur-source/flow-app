import { useState, useEffect } from 'react'
import { useStore, Store, musicPollStart, musicPollStop } from '../store'

const MODES = {
  work:  { label:'Работа',     color:'#5b8dee', emoji:'🎯' },
  short: { label:'Мини-пауза', color:'#34d399', emoji:'☕' },
  long:  { label:'Длинная',    color:'#a78bfa', emoji:'🧘' },
}

const NO_DRAG = { WebkitAppRegion:'no-drag' }
function pad(n) { return String(Math.max(0,n)).padStart(2,'0') }
const ctrl = a => window.jarvis?.music?.control?.(a)

export function DynamicIsland({ onNavigate }) {
  const [integrations] = useStore('integrations', {})
  const [reminders]    = useStore('reminders',    [])
  const [focusLive]    = useStore('focus_live',   {})

  const [now,     setNow]   = useState(Date.now())
  const [hovered, setHover] = useState(false)
  const [view,    setView]  = useState(null)
  const [track]             = useStore('music_track', null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    musicPollStart()
    return () => musicPollStop()
  }, [])

  // Фокус-таймер
  const focusRunning = !!focusLive?.running
  const modeId  = focusLive?.modeId || 'work'
  const mode    = MODES[modeId] || MODES.work
  const total   = focusLive?.totalSeconds || 1500
  const elapsed = focusRunning
    ? Math.floor((now - (focusLive.startedAt || now)) / 1000)
    : (focusLive?.elapsed || 0)
  const left     = Math.max(0, total - elapsed)
  const pct      = Math.min((elapsed / total) * 100, 100)
  const timerStr = `${pad(Math.floor(left/60))}:${pad(left%60)}`

  const notifList  = (reminders||[]).slice(0,3)
  const timeStr    = new Date(now).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
  const isPlaying  = !!track?.playing
  const trackShort = track?.title
    ? (track.title.length > 18 ? track.title.slice(0,18)+'…' : track.title)
    : null

  const expanded    = hovered
  const defaultView = focusRunning ? 'focus' : track?.title ? 'music' : notifList.length ? 'notify' : 'time'
  const activeView  = view || defaultView

  const tabs = [
    focusRunning     && { id:'focus',  color:mode.color, label:timerStr,   dot:true },
    track?.title     && { id:'music',  color:'#ffcc00',  label:trackShort, emoji:isPlaying?'▶':'♪' },
    notifList.length && { id:'notify', color:'#fbbf24',  label:`${notifList.length}`, emoji:'🔔' },
    !focusRunning && !track?.title && !notifList.length &&
                       { id:'time',   color:'rgba(255,255,255,0.4)', label:timeStr },
  ].filter(Boolean)

  const pillW = track?.title ? 218 : focusRunning ? 175 : 155

  return (
    <div
      style={NO_DRAG}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setView(null) }}
    >
      <div style={{
        background:     'rgba(4,5,12,0.96)',
        backdropFilter: 'blur(48px) saturate(220%)',
        border:         '1px solid rgba(255,255,255,0.11)',
        /* Ключевое: сильное скругление при раскрытии */
        borderRadius:   expanded ? '32px' : '999px',
        overflow:       'hidden',
        transition:     [
          'width .42s cubic-bezier(0.34,1.4,0.64,1)',
          'border-radius .42s cubic-bezier(0.34,1.4,0.64,1)',
          'box-shadow .3s ease',
        ].join(','),
        width:     expanded ? '355px' : `${pillW}px`,
        boxShadow: expanded
          ? '0 16px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.09)'
          : '0 2px 18px rgba(0,0,0,0.65)',
      }}>

        {/* ── ПИЛЮЛЯ — всегда сверху, в потоке ── */}
        <div style={{
          height:         32,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            9,
          padding:        '0 13px',
          flexShrink:     0,
        }}>
          {tabs.map((t, i) => (
            <span key={t.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
              {i > 0 && (
                <span style={{ width:1, height:11, background:'rgba(255,255,255,0.13)', margin:'0 1px' }}/>
              )}

              {t.dot && (
                <span style={{
                  width:6, height:6, borderRadius:99, background:mode.color,
                  boxShadow:`0 0 7px ${mode.color}`, animation:'blink 1.5s ease infinite', flexShrink:0,
                }}/>
              )}
              {!t.dot && t.emoji && (
                <span style={{ fontSize:11, lineHeight:1 }}>{t.emoji}</span>
              )}

              <span style={{
                fontSize:      t.id==='focus'||t.id==='time' ? 12.5 : 12,
                fontFamily:    t.id==='focus'||t.id==='time' ? '"JetBrains Mono"' : '"Hanken Grotesk"',
                fontWeight:    t.id==='focus' ? 700 : 500,
                color:         t.color,
                letterSpacing: t.id==='focus' ? '-0.03em' : 0,
                maxWidth:      t.id==='music' ? 108 : 'auto',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>
                {t.label}
              </span>

              {/* Мини-кнопки трека — видны всегда когда есть трек */}
              {t.id==='music' && track?.title && (
                <span style={{ display:'flex', gap:2, marginLeft:1 }}>
                  <MiniBtn onClick={e => { e.stopPropagation(); ctrl('prev') }}>⏮</MiniBtn>
                  <MiniBtn onClick={e => { e.stopPropagation(); ctrl('toggle') }} accent={isPlaying}>
                    {isPlaying ? '⏸' : '▶'}
                  </MiniBtn>
                  <MiniBtn onClick={e => { e.stopPropagation(); ctrl('next') }}>⏭</MiniBtn>
                </span>
              )}
            </span>
          ))}
        </div>

        {/* ── ПАНЕЛЬ — раскрывается строго ВНИЗ под пилюлей ── */}
        <div style={{
          maxHeight:  expanded ? '160px' : '0px',
          overflow:   'hidden',
          transition: 'max-height .42s cubic-bezier(0.34,1.4,0.64,1)',
        }}>
          <div style={{
            padding:    '2px 16px 14px',
            opacity:     expanded ? 1 : 0,
            transform:   expanded ? 'none' : 'translateY(6px)',
            transition: 'opacity .22s ease .12s, transform .22s ease .12s',
          }}>
            {/* Разделитель */}
            <div style={{ height:1, background:'rgba(255,255,255,0.07)', marginBottom:12 }}/>

            {/* Переключатели если несколько активных */}
            {tabs.length > 1 && (
              <div style={{ display:'flex', gap:3, marginBottom:10 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setView(t.id)} style={{
                    padding:'2px 9px', borderRadius:99, border:'none', cursor:'pointer',
                    fontSize:10.5, fontFamily:'"JetBrains Mono"', transition:'all .15s',
                    background: activeView===t.id ? t.color : 'rgba(255,255,255,0.07)',
                    color:      activeView===t.id ? (t.id==='music'?'#000':'#fff') : 'rgba(255,255,255,0.4)',
                    fontWeight: activeView===t.id ? 700 : 400,
                  }}>
                    {t.id==='focus'?'🎯':''}
                    {t.id==='music'?'🎵':''}
                    {t.id==='notify'?'🔔':''}
                    {t.id==='time'?'🕐':''}
                    {' '}
                    {t.id==='focus'?'Фокус':t.id==='music'?'Музыка':t.id==='notify'?'Напом.':'Время'}
                  </button>
                ))}
              </div>
            )}

            {activeView==='focus'  && <FocusView  mode={mode} timerStr={timerStr} pct={pct} left={left} focusRunning={focusRunning} onNavigate={onNavigate} />}
            {activeView==='music'  && <MusicView  track={track} onNavigate={onNavigate} />}
            {activeView==='notify' && <NotifyView reminders={notifList} />}
            {activeView==='time'   && <TimeView   timeStr={timeStr} now={now} />}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function MiniBtn({ onClick, children, accent }) {
  return (
    <button onClick={onClick} style={{
      width:18, height:18, borderRadius:5, border:'none', flexShrink:0,
      background: accent ? 'rgba(255,204,0,0.3)' : 'rgba(255,255,255,0.11)',
      color:      accent ? '#ffcc00' : 'rgba(255,255,255,0.65)',
      cursor:'pointer', fontSize:9, display:'grid', placeItems:'center', lineHeight:1,
    }}>
      {children}
    </button>
  )
}

function Btn({ onClick, children, accent }) {
  return (
    <button onClick={onClick} style={{
      width:28, height:28, borderRadius:8,
      border: '1px solid rgba(255,255,255,0.1)',
      background: accent ? '#ffcc00' : 'rgba(255,255,255,0.09)',
      color:      accent ? '#000'    : 'rgba(255,255,255,0.8)',
      cursor:'pointer', fontSize:12, display:'grid', placeItems:'center',
      transition:'transform .1s',
      boxShadow: accent ? '0 0 12px rgba(255,204,0,0.5)' : 'none',
    }}
      onMouseDown={e => e.currentTarget.style.transform='scale(0.88)'}
      onMouseUp={e   => e.currentTarget.style.transform='scale(1)'}
    >
      {children}
    </button>
  )
}

// ─── Музыка ───────────────────────────────────────────────────────────────────
function MusicView({ track, onNavigate }) {
  if (!track?.title) {
    return (
      <div style={{ textAlign:'center', padding:'4px 0' }}>
        <button onClick={() => onNavigate?.('music')} style={{
          padding:'7px 22px', borderRadius:12,
          border:'1px solid rgba(255,204,0,0.3)', background:'rgba(255,204,0,0.1)',
          color:'#ffcc00', cursor:'pointer', fontSize:13, fontWeight:600,
        }}>🎵 Открыть плеер</button>
      </div>
    )
  }
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
      {track.cover
        ? <img src={track.cover} alt="" style={{ width:42, height:42, borderRadius:10, flexShrink:0, objectFit:'cover' }}/>
        : <div style={{ width:42, height:42, borderRadius:10, flexShrink:0, background:'rgba(255,204,0,0.15)', display:'grid', placeItems:'center', fontSize:20 }}>🎵</div>
      }
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'rgba(255,255,255,0.95)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {track.title}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {track.artist}
        </div>
        <div style={{ display:'flex', gap:5, marginTop:8, alignItems:'center' }}>
          <Btn onClick={() => ctrl('prev')}>⏮</Btn>
          <Btn onClick={() => ctrl('toggle')} accent={track.playing}>{track.playing ? '⏸' : '▶'}</Btn>
          <Btn onClick={() => ctrl('next')}>⏭</Btn>
          <button onClick={() => onNavigate?.('music')} style={{
            marginLeft:4, padding:'3px 9px', borderRadius:7,
            border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)',
            color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:10,
          }}>открыть →</button>
        </div>
      </div>
    </div>
  )
}

// ─── Фокус ────────────────────────────────────────────────────────────────────
function FocusView({ mode, timerStr, pct, left, focusRunning, onNavigate }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <div style={{ width:36, height:36, borderRadius:11, flexShrink:0, display:'grid', placeItems:'center', fontSize:18, background:`color-mix(in oklch,${mode.color} 16%,transparent)`, border:`1px solid color-mix(in oklch,${mode.color} 28%,transparent)` }}>
          {mode.emoji}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, fontFamily:'"JetBrains Mono"', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:1 }}>
            {mode.label} {focusRunning ? '· идёт' : '· пауза'}
          </div>
          <div style={{ fontSize:26, fontFamily:'"Space Grotesk"', fontWeight:800, color:mode.color, lineHeight:1, letterSpacing:'-0.04em' }}>
            {timerStr}
          </div>
        </div>
        <button onClick={() => onNavigate?.('focus')} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11 }}>→</button>
      </div>
      <div style={{ height:3, borderRadius:99, background:'rgba(255,255,255,0.08)' }}>
        <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${mode.color},color-mix(in oklch,${mode.color} 70%,#fff))`, width:`${pct}%`, transition:'width 1s linear', boxShadow:`0 0 8px ${mode.color}88` }}/>
      </div>
      <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.25)', fontFamily:'"JetBrains Mono"', marginTop:5, textAlign:'right' }}>
        {Math.floor(left/60)} мин
      </div>
    </div>
  )
}

// ─── Напоминания ──────────────────────────────────────────────────────────────
function NotifyView({ reminders }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      {reminders.map((r, i) => (
        <div key={r.id||i} style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:6, height:6, borderRadius:99, background:'#fbbf24', flexShrink:0, boxShadow:'0 0 6px #fbbf2488' }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)' }}>{r.title}</div>
            {r.sub && <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{r.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Время ────────────────────────────────────────────────────────────────────
function TimeView({ timeStr, now }) {
  const d = new Date(now)
  const dateStr = d.toLocaleDateString('ru-RU',{ weekday:'short', day:'numeric', month:'short' })
  return (
    <div style={{ textAlign:'center', padding:'2px 0' }}>
      <div style={{ fontSize:34, fontFamily:'"Space Grotesk"', fontWeight:800, color:'rgba(255,255,255,0.9)', letterSpacing:'-0.05em', lineHeight:1 }}>
        {timeStr}
      </div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginTop:5, textTransform:'capitalize' }}>
        {dateStr}
      </div>
    </div>
  )
}
