import { useState, useEffect, useCallback } from 'react'
import { Store } from '../store'
import { Icon } from '../components/Icons'
import { getYandexMail, yandexMailAuthUrl, yandexExchangeCode, yandexRefresh, getYandexProfile } from '../integrations/yandex'

const openUrl = url => { if (window.jarvis?.openUrl) window.jarvis.openUrl(url); else window.open(url,'_blank') }

const FOLDERS = [
  { id:'inbox',  label:'Входящие',    url:'https://mail.yandex.ru/#inbox',         icon:'📥' },
  { id:'sent',   label:'Отправленные',url:'https://mail.yandex.ru/#sent',           icon:'📤' },
  { id:'drafts', label:'Черновики',   url:'https://mail.yandex.ru/#draft',          icon:'📝' },
  { id:'spam',   label:'Спам',        url:'https://mail.yandex.ru/#spam',           icon:'🚫' },
  { id:'trash',  label:'Корзина',     url:'https://mail.yandex.ru/#trash',          icon:'🗑️'  },
]

function fmtDate(isoDate, rawDate) {
  const d = isoDate ? new Date(isoDate) : rawDate ? new Date(rawDate) : null
  if (!d || isNaN(d)) return rawDate || ''
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60)    return 'только что'
  if (diff < 3600)  return `${Math.floor(diff/60)} мин`
  if (diff < 86400) return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
  if (diff < 7*86400) return d.toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'})
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'2-digit'})
}

function trimAddr(from) {
  if (!from) return ''
  const m = from.match(/^"?([^"<]+)"?\s*</)
  return m ? m[1].trim() : from.replace(/<[^>]+>/,'').trim() || from
}

function getInitial(from) {
  const name = trimAddr(from)
  return name ? name[0].toUpperCase() : '?'
}

const AVATAR_COLORS = ['#5b8dee','#34d399','#a78bfa','#f87171','#fbbf24','#f472b6','#60a5fa','#fb923c']
function avatarColor(from) {
  let h = 0; for (const c of (from||'')) h = (h*31 + c.charCodeAt(0)) & 0xfffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Mail({ onNavigate }) {
  const [messages,  setMessages]  = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [needsMail, setNeedsMail] = useState(false)
  const [selected,  setSelected]  = useState(null)
  const [search,    setSearch]    = useState('')
  const [folder,    setFolder]    = useState('inbox')
  const [reauthing, setReauthing] = useState(false)

  const auth       = Store.get('yandex_auth', null)
  const token      = auth?.access_token
  const email      = auth?.profile?.email
  const login      = auth?.profile?.login
  const appPassword = Store.get('yandex_mail_pwd', '') || null

  const CACHE_KEY = `mail_cache_${login || 'anon'}`

  const loadMessages = useCallback(async (force = false) => {
    if (!token || !email) { setNeedsAuth(true); return }
    if (!appPassword) { setNeedsMail(true); setLoading(false); return }

    // Показываем кешированные мгновенно
    if (!force) {
      const cached = Store.get(CACHE_KEY, null)
      if (cached?.messages?.length) {
        setMessages(cached.messages)
        setError(null)
      }
    }

    setLoading(true)
    setError(null)
    setNeedsMail(false)
    try {
      const result = await getYandexMail(token, email, appPassword)
      if (result.error) {
        if (result.error === 'xoauth2_failed') {
          setNeedsMail(true)
        } else {
          setError(result.error)
        }
        setLoading(false)
        return
      }
      setMessages(result.messages || [])
      Store.set(CACHE_KEY, { messages: result.messages || [], at: Date.now() })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [token, email, appPassword, CACHE_KEY])

  useEffect(() => { loadMessages() }, [])

  // Запросить доступ к почте через re-auth
  const requestMailAccess = async () => {
    const creds = Store.get('yandex_creds', {})
    if (!creds?.clientId) { alert('Сначала войди в Яндекс в Настройках'); return }
    setReauthing(true)
    try {
      const url = yandexMailAuthUrl(creds.clientId)
      await window.jarvis.oauth.open(url)
      const { code, error: oauthErr } = await window.jarvis.oauth.listen()
      if (oauthErr || !code) { setReauthing(false); return }
      const tokens = await yandexExchangeCode(creds.clientId, creds.clientSecret, code)
      if (tokens.error) { setError(tokens.error); setReauthing(false); return }
      let profile = null
      try { profile = await getYandexProfile(tokens.access_token) } catch {}
      Store.set('yandex_auth', { ...tokens, profile, savedAt: Date.now() })
      setReauthing(false)
      setNeedsMail(false)
      setTimeout(() => loadMessages(true), 300)
    } catch (e) {
      setError(e.message)
      setReauthing(false)
    }
  }

  const filtered = (messages || []).filter(m => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (m.from||'').toLowerCase().includes(q) || (m.subject||'').toLowerCase().includes(q)
  })

  const unread = (messages||[]).filter(m => !m.read).length

  return (
    <div className="page" style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* ── Заголовок ── */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <div style={{ flex:1 }}>
          <div className="page-kicker">Яндекс</div>
          <div className="page-title" style={{ marginBottom:0 }}>
            Почта
            {unread > 0 && (
              <span style={{ marginLeft:10, fontSize:14, fontWeight:600, color:'#fc3f1d', background:'rgba(252,63,29,0.12)', padding:'2px 10px', borderRadius:99, border:'1px solid rgba(252,63,29,0.25)' }}>
                {unread} новых
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize:12, gap:6 }}
          onClick={() => loadMessages(true)} disabled={loading}>
          <Icon name={loading?'clock':'repeat'} size={13}/> {loading ? 'Загрузка…' : 'Обновить'}
        </button>
        <button className="btn btn-primary" onClick={() => openUrl('https://mail.yandex.ru/#compose')}>
          <Icon name="edit" size={14}/> Написать
        </button>
      </div>

      {/* ── Состояние: не авторизован ── */}
      {needsAuth && (
        <div className="card card-pad" style={{ textAlign:'center', padding:'48px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:48 }}>📭</div>
          <div style={{ fontWeight:700, fontSize:16 }}>Войди в Яндекс</div>
          <div style={{ fontSize:13.5, color:'var(--text-mute)' }}>Для просмотра почты нужно войти через Настройки</div>
          <button className="btn btn-primary" onClick={() => openUrl('flow://settings')}>
            Перейти в Настройки
          </button>
        </div>
      )}

      {/* ── Нужен пароль приложения ── */}
      {needsMail && !needsAuth && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, padding:'48px 32px', textAlign:'center' }}>
          <div style={{ fontSize:56 }}>🔑</div>
          <div>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Нужен пароль приложения</div>
            <div style={{ fontSize:14, color:'var(--text-mute)', lineHeight:1.7, maxWidth:420 }}>
              Яндекс не даёт IMAP-доступ через обычный OAuth для личных аккаунтов. Используй <b>пароль приложения</b> — это безопасно и работает всегда.
            </div>
          </div>

          <div className="card card-pad" style={{ width:'100%', maxWidth:460, textAlign:'left' }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Как настроить за 1 минуту</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { n:1, text:'Включи IMAP в Яндекс Почте', link:'https://mail.yandex.ru/#setup/client', linkLabel:'Открыть настройки ↗' },
                { n:2, text:'Создай пароль приложения для Почты', link:'https://id.yandex.ru/security/app-passwords', linkLabel:'Создать пароль ↗' },
                { n:3, text:'Вставь пароль в Настройки → Яндекс Почта · IMAP', link:null },
              ].map(s => (
                <div key={s.n} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:24, height:24, borderRadius:99, background:'var(--accent)', color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:700, flexShrink:0, marginTop:1 }}>{s.n}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:500, color:'var(--text)' }}>{s.text}</div>
                    {s.link && <button className="btn btn-ghost" style={{ fontSize:11.5, padding:'3px 9px', marginTop:4 }} onClick={() => openUrl(s.link)}>{s.linkLabel}</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ fontSize:14, padding:'10px 28px' }} onClick={() => onNavigate?.('settings')}>
            <Icon name="settings" size={15}/> Открыть Настройки
          </button>
        </div>
      )}

      {/* ── Основной контент ── */}
      {!needsAuth && (
        <div style={{ display:'flex', gap:16, flex:1, minHeight:0 }}>

          {/* Левая колонка: папки */}
          <div style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:4 }}>
            {FOLDERS.map(f => (
              <button key={f.id} onClick={() => { setFolder(f.id); if (f.id !== 'inbox') openUrl(f.url) }}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10,
                  border:'1px solid', cursor:'pointer', textAlign:'left', transition:'all .15s', width:'100%',
                  borderColor: folder===f.id ? 'var(--line-accent)' : 'transparent',
                  background:  folder===f.id ? 'color-mix(in oklch,var(--accent) 10%,var(--surface-2))' : 'transparent',
                  color: folder===f.id ? 'var(--text)' : 'var(--text-mute)',
                }}>
                <span style={{ fontSize:16 }}>{f.icon}</span>
                <span style={{ fontSize:13, fontWeight: folder===f.id ? 600 : 400 }}>{f.label}</span>
                {f.id === 'inbox' && unread > 0 && (
                  <span style={{ marginLeft:'auto', fontSize:11, fontFamily:'var(--font-mono)', color:'#fc3f1d', fontWeight:700 }}>{unread}</span>
                )}
              </button>
            ))}

            <div style={{ marginTop:'auto', borderTop:'1px solid var(--line)', paddingTop:12 }}>
              <button onClick={() => openUrl('https://mail.yandex.ru')}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', cursor:'pointer', color:'var(--text-mute)', fontSize:12.5, width:'100%' }}>
                <span>🌐</span> Открыть в браузере
              </button>
            </div>
          </div>

          {/* Правая колонка: письма */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

            {/* Поиск */}
            <div style={{ position:'relative', marginBottom:12 }}>
              <Icon name="search" size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-mute)', pointerEvents:'none' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по письмам…"
                style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', color:'var(--text)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
            </div>

            {/* Список писем */}
            {loading && !messages && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {Array.from({length:6}).map((_,i) => (
                  <div key={i} style={{ height:62, borderRadius:12, background:'var(--surface-2)', opacity:0.5+(i*0.05), animation:'blink 1.5s ease infinite', animationDelay:`${i*0.1}s` }}/>
                ))}
              </div>
            )}

            {!loading && !needsMail && messages && messages.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-mute)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
                <div style={{ fontWeight:600 }}>Входящих нет</div>
              </div>
            )}

            {filtered.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:4, overflowY:'auto' }}>
                {filtered.map((msg, i) => (
                  <MailRow key={`${msg.uid}-${i}`} msg={msg}
                    selected={selected === i}
                    onClick={() => {
                      setSelected(i)
                      openUrl('https://mail.yandex.ru/#inbox')
                    }}
                  />
                ))}
                <div style={{ padding:'12px 0', textAlign:'center', fontSize:12, color:'var(--text-mute)' }}>
                  {filtered.length} {plural(filtered.length,'письмо','письма','писем')} · данные из IMAP
                </div>
              </div>
            )}

            {error && !needsMail && (
              <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(251,113,133,0.08)', border:'1px solid rgba(251,113,133,0.2)', color:'#fb7185', fontSize:12.5, fontFamily:'var(--font-mono)', marginTop:8 }}>
                ⚠ {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MailRow({ msg, selected, onClick }) {
  const [hover, setHover] = useState(false)
  const color = avatarColor(msg.from)
  const initial = getInitial(msg.from)
  const senderName = trimAddr(msg.from)
  const dateStr = fmtDate(msg.isoDate, msg.date)

  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '11px 14px',
        borderRadius: 12,
        cursor:       'pointer',
        transition:   'all .12s',
        border:       '1px solid',
        borderColor:  selected ? 'var(--line-accent)' : hover ? 'var(--line)' : 'transparent',
        background:   selected ? 'color-mix(in oklch,var(--accent) 8%,var(--surface-2))' : hover ? 'var(--surface-2)' : 'transparent',
      }}>

      {/* Аватар */}
      <div style={{ width:38, height:38, borderRadius:99, flexShrink:0, background:color, display:'grid', placeItems:'center', color:'#fff', fontWeight:700, fontSize:15, fontFamily:'var(--font-display)' }}>
        {initial}
      </div>

      {/* Контент */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          {!msg.read && (
            <div style={{ width:7, height:7, borderRadius:99, background:'#fc3f1d', flexShrink:0, boxShadow:'0 0 6px rgba(252,63,29,0.5)' }}/>
          )}
          <div style={{ fontWeight: msg.read ? 500 : 700, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
            {senderName}
          </div>
          <div style={{ fontSize:11.5, color:'var(--text-mute)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
            {dateStr}
          </div>
        </div>
        <div style={{ fontSize:13, color: msg.read ? 'var(--text-mute)' : 'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {msg.subject || '(без темы)'}
        </div>
      </div>

      {/* Стрелка при наведении */}
      {hover && (
        <Icon name="chevron" size={14} style={{ color:'var(--text-mute)', flexShrink:0 }}/>
      )}
    </div>
  )
}

function plural(n, one, few, many) {
  const m10=n%10, m100=n%100
  if(m10===1&&m100!==11) return one
  if([2,3,4].includes(m10)&&![12,13,14].includes(m100)) return few
  return many
}
