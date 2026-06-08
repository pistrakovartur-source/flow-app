// History.jsx — история разговоров
import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icons'
import { Orb  } from '../components/Orb'

export function History({ assistant, onNavigate }) {
  const [sessions]         = useStore('sessions', [])
  const [active, setActive] = useState(null)
  const [q, setQ]           = useState('')

  useEffect(() => { if (sessions?.length && !active) setActive(sessions[0].id) }, [sessions])

  const list    = (sessions||[]).filter(s => (s.title+(s.summary||'')).toLowerCase().includes(q.toLowerCase()))
  const current = (sessions||[]).find(s => s.id === active)
  const groups  = groupByDate(list)

  if (!sessions?.length) return (
    <div className="page" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'80%', gap:20, textAlign:'center' }}>
      <Orb size={90} state="idle" wave />
      <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, color:'var(--text-dim)', marginTop:12 }}>Ещё нет разговоров</div>
      <div style={{ fontSize:15, color:'var(--text-mute)', maxWidth:300, lineHeight:1.6 }}>Начни с голосового режима — история появится здесь.</div>
      <button className="btn btn-primary" onClick={() => onNavigate?.('voice')}><Icon name="mic" size={15}/> Начать разговор</button>
    </div>
  )

  return (
    <div className="page" style={{ paddingRight:0, paddingBottom:0, height:'100%' }}>
      <div className="page-head" style={{ paddingRight:38 }}>
        <div className="page-kicker">Память разговоров</div>
        <div className="page-title">История</div>
      </div>
      <div style={{ display:'flex', alignItems:'stretch', height:'calc(100% - 120px)' }}>
        {/* Список */}
        <div style={{ flex:'0 0 340px', display:'flex', flexDirection:'column', gap:12, paddingRight:22, borderRight:'1px solid var(--line)', overflowY:'auto' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:11,background:'var(--surface-2)',border:'1px solid var(--line)' }}>
            <Icon name="search" size={16} style={{color:'var(--text-mute)'}}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск…" style={{ flex:1,background:'none',border:'none',outline:'none',color:'var(--text)',fontFamily:'var(--font-body)',fontSize:14 }}/>
          </div>
          {list.length===0&&<div style={{ color:'var(--text-mute)',fontSize:13,textAlign:'center',padding:'20px 0' }}>Ничего не найдено</div>}
          {groups.map(g=>(
            <div key={g.label} style={{ display:'flex',flexDirection:'column',gap:5 }}>
              <div style={{ fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-faint)',padding:'4px 4px' }}>{g.label}</div>
              {g.items.map(s=>(
                <div key={s.id} onClick={()=>setActive(s.id)} style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'10px 11px',borderRadius:11,cursor:'pointer',background:active===s.id?'color-mix(in oklch,var(--accent) 15%,transparent)':'transparent',border:'1px solid',borderColor:active===s.id?'var(--line-accent)':'transparent' }}>
                  <div style={{ width:28,height:28,flexShrink:0,borderRadius:8,display:'grid',placeItems:'center',background:'var(--surface-2)',color:'var(--accent-soft)' }}><Icon name={s.kind==='voice'?'mic':'note'} size={14}/></div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:600,fontSize:13 }}>{s.title}</div>
                    {s.summary&&<div style={{ fontSize:12,color:'var(--text-mute)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.summary}</div>}
                  </div>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-mute)',whiteSpace:'nowrap' }}>{fmt(s.created)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Тред */}
        {current ? (
          <div style={{ flex:1, padding:'0 36px', overflowY:'auto' }}>
            <div style={{ display:'flex',alignItems:'center',gap:12,padding:'4px 0 16px',position:'sticky',top:0,background:'var(--bg-app)',zIndex:2 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)',fontSize:17,fontWeight:600 }}>{current.title}</div>
                <div style={{ fontFamily:'var(--font-mono)',fontSize:11.5,color:'var(--text-mute)',marginTop:2 }}>{current.kind==='voice'?'голосовой':'текстовый'} · {fmtFull(current.created)}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => onNavigate?.('voice')}><Icon name="mic" size={14}/> Продолжить</button>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:14,paddingBottom:28 }}>
              {(current.messages||[]).length===0&&<div style={{ color:'var(--text-mute)',fontSize:13.5 }}>Сообщения не сохранились</div>}
              {(current.messages||[]).map((m,i)=>
                m.role==='user'
                  ? <div key={i} className="msg-me">{m.content}</div>
                  : <div key={i} style={{ display:'flex',gap:10,alignItems:'flex-start',maxWidth:'86%' }}><div style={{flexShrink:0,marginTop:2}}><Orb size={28} state="idle" wave={false}/></div><div className="msg-ai">{m.content}</div></div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex:1,display:'grid',placeItems:'center',color:'var(--text-mute)',fontSize:14 }}>Выбери разговор</div>
        )}
      </div>
    </div>
  )
}

function groupByDate(sessions) {
  const today = new Date(), yesterday = new Date(today)
  yesterday.setDate(today.getDate()-1)
  const map = {}
  sessions.forEach(s=>{
    const d = new Date(s.created)
    const label = sameDay(d,today)?'Сегодня':sameDay(d,yesterday)?'Вчера':d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})
    if (!map[label]) map[label]=[]
    map[label].push(s)
  })
  return Object.entries(map).map(([label,items])=>({label,items}))
}
const sameDay   = (a,b) => a.getDate()===b.getDate()&&a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear()
const fmt       = ts => new Date(ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})
const fmtFull   = ts => new Date(ts).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})
