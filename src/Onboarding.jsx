import { useState } from 'react'
import { Store } from './store'
import { Icon } from './components/Icons'

const INTERESTS = [
  'Дизайн','Программирование','Музыка','Кино','Книги','Спорт','Путешествия',
  'Кулинария','Фотография','Игры','Наука','Бизнес','Психология','Языки',
  'Искусство','Технологии','Финансы','Здоровье','Медитация','Электроника','Космос',
]

export function Onboarding({ appName }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    name: '', email: '', city: '',
    workStart: '09:00', workEnd: '18:00', dnd: '22:30', timezone: 'UTC+3',
    interests: [],
  })
  const upd  = (k, v) => setData(d => ({ ...d, [k]: v }))
  const next  = () => setStep(s => s + 1)

  const finish = (empty = false) => {
    Store.set('profile', empty
      ? { name:'', email:'', city:'', interests:[], workStart:'09:00', workEnd:'18:00', dnd:'22:30', timezone:'UTC+3' }
      : data)
    Store.set('onboarding_done', true)
    ;['tasks','reminders','schedule','notes','calendar_events','focus_stats'].forEach(k => {
      if (!Store.get(k)) Store.set(k, k === 'focus_stats' ? { sessions:0, totalMinutes:0, today:'' } : [])
    })
    if (!Store.get('integrations')) Store.set('integrations', { yandexCalendar:false, yandexMail:false, yandexMusic:false })
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'radial-gradient(140% 120% at 20% -10%,#141b2e,#0a0e18 50%,#070a12)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-body)' }}>
      {step > 0 && (
        <div style={{ position:'absolute', top:44, display:'flex', gap:8 }}>
          {[1,2,3].map(i => <div key={i} style={{ height:6, borderRadius:99, width: i===step?32:10, background: i<=step?'var(--accent)':'var(--surface-3)', transition:'all .3s ease' }} />)}
        </div>
      )}
      {step===0 && <StepWelcome  appName={appName} onStart={next} onSkip={() => finish(true)} />}
      {step===1 && <StepProfile  data={data} upd={upd} onNext={next} onSkip={next} />}
      {step===2 && <StepSchedule data={data} upd={upd} onNext={next} onSkip={next} />}
      {step===3 && <StepInterests data={data} upd={upd} onFinish={() => finish(false)} onSkip={() => finish(false)} />}
    </div>
  )
}

function StepWelcome({ appName, onStart, onSkip }) {
  return (
    <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:32, animation:'pageIn .5s ease' }}>
      <div style={{ width:100, height:100, borderRadius:28, background:'linear-gradient(135deg, var(--accent), #7c3aed)', display:'grid', placeItems:'center', boxShadow:'0 0 60px var(--accent-glow)' }}>
        <Icon name="zap" size={48} style={{ color:'#fff' }} />
      </div>
      <div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--accent-soft)', marginBottom:14 }}>Добро пожаловать</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:42, fontWeight:700, letterSpacing:'-0.02em', marginBottom:12 }}>{appName}</div>
        <div style={{ color:'var(--text-mute)', fontSize:16, lineHeight:1.65, maxWidth:420 }}>Твой личный планировщик дня. Задачи, календарь, фокус-сессии и заметки — всё в одном месте.</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
        <button className="btn btn-primary" style={{ fontSize:15, padding:'13px 40px', borderRadius:16 }} onClick={onStart}>
          <Icon name="spark" size={16}/> Начать настройку
        </button>
        <button onClick={onSkip} style={{ background:'none', border:'none', color:'var(--text-mute)', cursor:'pointer', fontSize:13.5 }}>Пропустить</button>
      </div>
    </div>
  )
}

function StepProfile({ data, upd, onNext, onSkip }) {
  return (
    <Step title="Расскажи о себе" sub="Буду обращаться к тебе по имени." onNext={onNext} onSkip={onSkip} nextDisabled={!data.name.trim()}>
      <Field label="Имя *" placeholder="Алексей" value={data.name} onChange={v => upd('name',v)} autoFocus />
      <Field label="Email" placeholder="you@mail.ru" value={data.email} onChange={v => upd('email',v)} />
      <Field label="Город" placeholder="Москва" value={data.city} onChange={v => upd('city',v)} />
    </Step>
  )
}

function StepSchedule({ data, upd, onNext, onSkip }) {
  return (
    <Step title="Твой режим" sub="Помогает планировать задачи по времени суток." onNext={onNext} onSkip={onSkip}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Начало рабочего дня" type="time" value={data.workStart} onChange={v => upd('workStart',v)} />
        <Field label="Конец рабочего дня"  type="time" value={data.workEnd}   onChange={v => upd('workEnd',  v)} />
      </div>
      <Field label="Режим «Не беспокоить» после" type="time" value={data.dnd} onChange={v => upd('dnd',v)} />
      <div>
        <div style={{ fontSize:12, color:'var(--text-mute)', marginBottom:8 }}>Часовой пояс</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {['UTC+2','UTC+3','UTC+4','UTC+5','UTC+7','UTC+8'].map(tz => (
            <button key={tz} onClick={() => upd('timezone',tz)} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid', cursor:'pointer', borderColor: data.timezone===tz?'var(--line-accent)':'var(--line)', background: data.timezone===tz?'color-mix(in oklch,var(--accent) 16%,transparent)':'var(--surface-2)', color: data.timezone===tz?'var(--accent-soft)':'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:12 }}>{tz}</button>
          ))}
        </div>
      </div>
    </Step>
  )
}

function StepInterests({ data, upd, onFinish, onSkip }) {
  const toggle = it => upd('interests', data.interests.includes(it) ? data.interests.filter(x=>x!==it) : [...data.interests,it])
  return (
    <Step title="Твои интересы" sub="Помогут делать точные подсказки при планировании." onNext={onFinish} onSkip={onSkip} nextLabel="Готово →" isLast>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, maxHeight:200, overflowY:'auto' }}>
        {INTERESTS.map(it => {
          const active = data.interests.includes(it)
          return <button key={it} onClick={() => toggle(it)} style={{ padding:'8px 15px', borderRadius:99, border:'1px solid', cursor:'pointer', transition:'all .15s', borderColor: active?'var(--line-accent)':'var(--line)', background: active?'color-mix(in oklch,var(--accent) 18%,transparent)':'var(--surface-2)', color: active?'var(--accent-soft)':'var(--text-dim)', fontSize:13.5, fontWeight:500 }}>{it}</button>
        })}
      </div>
      {data.interests.length > 0 && <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-soft)' }}>✓ Выбрано: {data.interests.length}</div>}
    </Step>
  )
}

function Step({ title, sub, children, onNext, onSkip, nextDisabled, nextLabel='Далее →', isLast }) {
  return (
    <div style={{ width:500, display:'flex', flexDirection:'column', gap:22, animation:'pageIn .3s ease' }}>
      <div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:700, marginBottom:8 }}>{title}</div>
        <div style={{ color:'var(--text-mute)', fontSize:15, lineHeight:1.55 }}>{sub}</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>{children}</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
        <button onClick={onSkip} style={{ background:'none', border:'none', color:'var(--text-mute)', cursor:'pointer', fontSize:13.5 }}>Пропустить шаг</button>
        <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled} style={{ padding:'11px 28px', opacity: nextDisabled?0.4:1 }}>{nextLabel}</button>
      </div>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, type='text', autoFocus }) {
  return (
    <div>
      <div style={{ fontSize:12, color:'var(--text-mute)', marginBottom:6 }}>{label}</div>
      <input autoFocus={autoFocus} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'11px 13px', background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:11, color:'var(--text)', fontFamily:'var(--font-body)', fontSize:14.5, outline:'none', transition:'border-color .15s' }}
        onFocus={e => e.target.style.borderColor='var(--line-accent)'}
        onBlur={e  => e.target.style.borderColor='var(--line)'}
      />
    </div>
  )
}
