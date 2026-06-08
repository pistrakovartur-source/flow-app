// Memory.jsx — профиль, привычки, интересы, факты
import { useState } from 'react'
import { useStore, uid, Store } from '../store'
import { Icon } from '../components/Icons'

const HABIT_ICONS = ['run','book','coffee','heart','spark','clock','music','note']

export function Memory({ assistant }) {
  const [profile]              = useStore('profile',      {})
  const [habits,   setHabits]  = useStore('habits',       [])
  const [facts,    setFacts]   = useStore('memory_facts', [])

  const interests = profile?.interests || []

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-kicker">Профиль · что {assistant} знает обо мне</div>
        <div className="page-title">Память</div>
        <div className="page-sub">Всё хранится локально — ничего не уходит в облако.</div>
      </div>

      <ProfileCard profile={profile} factsCount={facts.length} />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginTop:18 }}>
        <HabitsCard    habits={habits}   setHabits={setHabits} />
        <PrefsCard     profile={profile} />
        <InterestsCard interests={interests} />
        <FactsCard     facts={facts}     setFacts={setFacts}   assistant={assistant} />
      </div>
    </div>
  )
}

function ProfileCard({ profile, factsCount }) {
  const name   = profile?.name  || ''
  const email  = profile?.email || ''
  const city   = profile?.city  || ''
  const letter = name ? name[0].toUpperCase() : '?'

  return (
    <div className="card card-pad">
      <div style={{ display:'flex', alignItems:'center', gap:20 }}>
        <div style={{ width:60,height:60,borderRadius:16,flexShrink:0,display:'grid',placeItems:'center',fontFamily:'var(--font-display)',fontWeight:700,fontSize:24,color:'#fff',background:'linear-gradient(135deg,var(--accent),#7c3aed)' }}>{letter}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-display)',fontSize:20,fontWeight:600 }}>{name||<span style={{color:'var(--text-mute)'}}>Имя не указано</span>}</div>
          <div style={{ fontSize:13.5,color:'var(--text-mute)',marginTop:3 }}>{[email,city].filter(Boolean).join(' · ')||'Данные не заполнены'}</div>
          <div style={{ display:'flex',gap:8,marginTop:10,flexWrap:'wrap' }}>
            {city&&<span className="pill"><Icon name="location" size={12}/> {city}</span>}
            {profile?.timezone&&<span className="pill"><Icon name="clock" size={12}/> {profile.timezone}</span>}
            <span className="pill ok"><Icon name="shield" size={12}/> {factsCount} фактов · локально</span>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={()=>{ Store.set('onboarding_done',false); window.location.reload() }}>Редактировать</button>
      </div>
    </div>
  )
}

function HabitsCard({ habits, setHabits }) {
  const [form, setForm]   = useState(false)
  const [draft, setDraft] = useState({ text:'', goal:'', icon:'run' })

  const add    = () => { if(!draft.text.trim()) return; setHabits(hs=>[...hs,{id:uid(),...draft,text:draft.text.trim(),streak:0}]); setDraft({text:'',goal:'',icon:'run'}); setForm(false) }
  const remove = id => setHabits(hs=>hs.filter(h=>h.id!==id))
  const inc    = id => setHabits(hs=>hs.map(h=>h.id===id?{...h,streak:h.streak+1}:h))

  return (
    <div className="card card-pad">
      <div className="card-h"><Icon name="spark" size={17} style={{color:'var(--accent-soft)'}}/><span className="ct">Привычки</span>{habits.length>0&&<span className="cm">{habits.length}</span>}</div>
      {habits.length===0&&!form&&<Empty icon="spark" text="Нет привычек" sub="Добавь первую" />}
      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {habits.map(h=>(
          <div key={h.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,background:'var(--surface-2)',border:'1px solid var(--line)' }}>
            <div style={{ width:34,height:34,flexShrink:0,borderRadius:9,display:'grid',placeItems:'center',background:'color-mix(in oklch,var(--accent) 16%,transparent)',color:'var(--accent-soft)' }}><Icon name={h.icon} size={17}/></div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600,fontSize:13.5 }}>{h.text}</div>
              {h.goal&&<div style={{ fontSize:11.5,color:'var(--text-mute)',fontFamily:'var(--font-mono)',marginTop:1 }}>{h.goal}</div>}
            </div>
            <div onClick={()=>inc(h.id)} style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',cursor:'pointer' }} title="Отметить день">
              <div style={{ fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'var(--accent-soft)' }}>{h.streak}</div>
              <div style={{ fontSize:10,color:'var(--text-mute)',fontFamily:'var(--font-mono)' }}>дней</div>
            </div>
            <button onClick={()=>remove(h.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-mute)',display:'grid',placeItems:'center' }}><Icon name="trash" size={13}/></button>
          </div>
        ))}
      </div>
      {form?(
        <div style={{ display:'flex',flexDirection:'column',gap:8,marginTop:10,padding:12,background:'var(--surface-2)',borderRadius:12,border:'1px solid var(--line-accent)' }}>
          <input autoFocus value={draft.text} onChange={e=>setDraft(d=>({...d,text:e.target.value}))} placeholder="Привычка…" style={inp}/>
          <input value={draft.goal} onChange={e=>setDraft(d=>({...d,goal:e.target.value}))} placeholder="Цель (4×/нед, 20 стр/день…)" style={inp}/>
          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
            {HABIT_ICONS.map(ic=><button key={ic} onClick={()=>setDraft(d=>({...d,icon:ic}))} style={{ width:30,height:30,borderRadius:7,border:'1px solid',cursor:'pointer',display:'grid',placeItems:'center',borderColor:draft.icon===ic?'var(--line-accent)':'var(--line)',background:draft.icon===ic?'color-mix(in oklch,var(--accent) 18%,transparent)':'var(--surface-3)',color:draft.icon===ic?'var(--accent-soft)':'var(--text-mute)' }}><Icon name={ic} size={13}/></button>)}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button className="btn btn-primary" style={{flex:1}} onClick={add}>Добавить</button>
            <button className="btn btn-ghost" onClick={()=>setForm(false)}>Отмена</button>
          </div>
        </div>
      ):(
        <button className="btn btn-ghost" style={{ alignSelf:'flex-start',marginTop:habits.length?8:0,fontSize:13 }} onClick={()=>setForm(true)}><Icon name="plus" size={14}/> Добавить привычку</button>
      )}
    </div>
  )
}

function PrefsCard({ profile }) {
  const rows = [
    { k:'Рабочие часы',   v: profile?.workStart&&profile?.workEnd ? `${profile.workStart} – ${profile.workEnd}` : '—' },
    { k:'Не беспокоить',  v: profile?.dnd ? `После ${profile.dnd}` : '—' },
    { k:'Часовой пояс',   v: profile?.timezone || '—' },
    { k:'Язык',           v: 'Русский' },
    { k:'Тон общения',    v: (profile?.toneStyle??60)<33?'Формальный':(profile?.toneStyle??60)<66?'Дружелюбный':'Тёплый' },
  ]
  return (
    <div className="card card-pad">
      <div className="card-h"><Icon name="settings" size={16} style={{color:'var(--accent-soft)'}}/><span className="ct">Предпочтения</span></div>
      {rows.map((r,i)=>(
        <div key={i} style={{ display:'flex',alignItems:'center',padding:'10px 0',borderBottom:i<rows.length-1?'1px solid var(--line)':'none' }}>
          <span style={{ fontSize:13.5,color:'var(--text-mute)',flex:'0 0 140px' }}>{r.k}</span>
          <span style={{ fontWeight:500,fontSize:13.5 }}>{r.v}</span>
        </div>
      ))}
    </div>
  )
}

function InterestsCard({ interests }) {
  return (
    <div className="card card-pad">
      <div className="card-h"><Icon name="heart" size={16} style={{color:'var(--accent-soft)'}}/><span className="ct">Интересы</span>{interests.length>0&&<span className="cm">{interests.length}</span>}</div>
      {interests.length===0
        ? <div style={{ color:'var(--text-mute)',fontSize:13.5,textAlign:'center',padding:'16px 0' }}>Не указаны. <button onClick={()=>{Store.set('onboarding_done',false);window.location.reload()}} style={{ background:'none',border:'none',color:'var(--accent-soft)',cursor:'pointer',fontSize:13.5 }}>Заполнить →</button></div>
        : <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>{interests.map((it,i)=><span key={i} className="pill" style={{ fontFamily:'var(--font-body)',fontSize:13,padding:'7px 12px' }}>{it}</span>)}</div>
      }
    </div>
  )
}

function FactsCard({ facts, setFacts, assistant }) {
  const [form, setForm] = useState(false)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('all') // all | auto | manual

  const add    = () => {
    if (!text.trim()) return
    const d = new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'})
    setFacts(fs => [...fs, { id:uid(), text:text.trim(), source:`добавлено вручную · ${d}`, created:Date.now() }])
    setText(''); setForm(false)
  }
  const remove = id => setFacts(fs => fs.filter(f => f.id !== id))

  const autoFacts   = facts.filter(f => f.source === 'auto')
  const manualFacts = facts.filter(f => f.source !== 'auto')
  const displayed   = filter === 'auto' ? autoFacts : filter === 'manual' ? manualFacts : facts

  return (
    <div className="card card-pad" style={{ gridColumn:'1/-1' }}>
      <div className="card-h">
        <Icon name="brain" size={17} style={{color:'var(--accent-soft)'}}/>
        <span className="ct">Что знает {assistant}</span>
        {facts.length > 0 && <span className="cm">{facts.length}</span>}
        {autoFacts.length > 0 && (
          <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ok)', background:'color-mix(in oklch,var(--ok) 12%,transparent)', padding:'2px 7px', borderRadius:99, marginLeft:4 }}>
            🧠 {autoFacts.length} авто
          </span>
        )}
      </div>

      {/* Фильтр */}
      {facts.length > 0 && (
        <div style={{ display:'flex', gap:6 }}>
          {[['all','Все'], ['auto','Выучил сам 🧠'], ['manual','Добавлены вручную']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              fontSize:11.5, fontFamily:'var(--font-mono)', padding:'4px 10px', borderRadius:99,
              border:'1px solid', cursor:'pointer',
              borderColor: filter===v ? 'var(--line-accent)' : 'var(--line)',
              background:  filter===v ? 'color-mix(in oklch,var(--accent) 12%,transparent)' : 'var(--surface-3)',
              color:       filter===v ? 'var(--accent-soft)' : 'var(--text-mute)',
            }}>{l}</button>
          ))}
        </div>
      )}

      {displayed.length === 0 && !form && (
        <div style={{ color:'var(--text-mute)', fontSize:13, textAlign:'center', padding:'14px 0' }}>
          {filter === 'auto'
            ? 'Jarvis ещё ничего не выучил — начни разговор'
            : 'Пока пусто — факты появятся из разговоров'}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {displayed.map(f => (
          <div key={f.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 11px', borderRadius:10,
            background: f.source === 'auto'
              ? 'color-mix(in oklch,var(--ok) 5%,var(--surface-2))'
              : 'var(--surface-2)',
            border: '1px solid',
            borderColor: f.source === 'auto' ? 'color-mix(in oklch,var(--ok) 20%,transparent)' : 'var(--line)' }}>
            <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{f.source === 'auto' ? '🧠' : '✏️'}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:500, lineHeight:1.4 }}>{f.text}</div>
              <div style={{ fontSize:10.5, color:'var(--text-mute)', fontFamily:'var(--font-mono)', marginTop:3 }}>
                {f.source === 'auto' ? 'выучено из разговора' : f.source}
              </div>
            </div>
            <button onClick={() => remove(f.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-mute)', flexShrink:0 }}>
              <Icon name="trash" size={13}/>
            </button>
          </div>
        ))}
      </div>

      {form ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter') add(); if(e.key==='Escape') setForm(false) }}
            placeholder="Напиши факт обо мне…" style={inp}/>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" style={{flex:1}} onClick={add}>Добавить</button>
            <button className="btn btn-ghost" onClick={() => setForm(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ alignSelf:'flex-start', marginTop:facts.length?4:0, fontSize:13 }}
          onClick={() => setForm(true)}>
          <Icon name="plus" size={14}/> Добавить факт
        </button>
      )}
    </div>
  )
}

function Empty({ icon, text, sub }) {
  return <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:7,padding:'16px 0',color:'var(--text-mute)' }}><Icon name={icon} size={22} style={{opacity:.25}}/><div style={{ fontWeight:600,fontSize:13 }}>{text}</div>{sub&&<div style={{ fontSize:12,opacity:.7 }}>{sub}</div>}</div>
}

const inp = { width:'100%',padding:'8px 11px',background:'var(--surface-1)',border:'1px solid var(--line)',borderRadius:9,color:'var(--text)',fontFamily:'var(--font-body)',fontSize:13.5,outline:'none' }
