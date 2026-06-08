import { useState, useMemo } from 'react'
import { useStore, uid } from '../store'
import { Icon } from '../components/Icons'
import { PageHeader, Card, CardHead, Segmented, StatPill } from '../components/UIKit'

const CATS_EXP = ['Еда','Транспорт','Здоровье','Развлечения','Одежда','Коммунальные','Связь','Прочее']
const CATS_INC = ['Зарплата','Фриланс','Подарок','Возврат','Прочее']
const CAT_ICONS = {
  'Еда':'🍕','Транспорт':'🚇','Здоровье':'💊','Развлечения':'🎮','Одежда':'👕',
  'Коммунальные':'🏠','Связь':'📱','Прочее':'💸','Зарплата':'💼','Фриланс':'💻',
  'Подарок':'🎁','Возврат':'↩️',
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(n)
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export function Budget() {
  const [transactions, setTxns] = useStore('budget_txns', [])
  const [budget,       setBudget] = useStore('budget_limit', 0)
  const [catLimits, setCatLimits] = useStore('budget_cat_limits', {})
  const [showAdd,  setShowAdd] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [showCatLimits, setShowCatLimits] = useState(false)
  const [catLimitsDraft, setCatLimitsDraft] = useState({})
  const [budgetDraft, setBudgetDraft] = useState('')
  const [tab,      setTab]      = useState('overview') // overview | history
  const [draft, setDraft] = useState({ type:'expense', amount:'', category:'Еда', note:'', date: new Date().toISOString().slice(0,10) })
  const [editTxnId, setEditTxnId] = useState(null)
  const [histSearch, setHistSearch] = useState('')
  const [histCatFilter, setHistCatFilter] = useState('')

  // Текущий месяц
  const [viewMonth, setViewMonth] = useState(new Date())
  const mk = monthKey(viewMonth)

  const txns = (transactions||[]).filter(t => t.month === mk)

  const income   = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
  const expense  = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
  const balance  = income - expense
  const budgetPct = budget > 0 ? Math.min((expense / budget) * 100, 100) : 0

  // Расходы по категориям
  const byCategory = useMemo(() => {
    const map = {}
    txns.filter(t=>t.type==='expense').forEach(t => {
      map[t.category] = (map[t.category]||0) + t.amount
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1])
  }, [txns])

  // Фильтрованная история
  const filteredTxns = useMemo(() => {
    let list = [...txns].sort((a,b) => b.date.localeCompare(a.date))
    if (histCatFilter) list = list.filter(t => t.category === histCatFilter)
    if (histSearch.trim()) {
      const q = histSearch.toLowerCase()
      list = list.filter(t => (t.note||'').toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    }
    return list
  }, [txns, histSearch, histCatFilter])

  const addTxn = () => {
    const amount = parseFloat(draft.amount.replace(',','.'))
    if (!amount || amount <= 0) return
    if (editTxnId) {
      setTxns(ts => ts.map(t => t.id === editTxnId ? { ...t, type:draft.type, amount, category:draft.category, note:draft.note.trim(), date:draft.date, month:draft.date.slice(0,7) } : t))
      setEditTxnId(null)
    } else {
      setTxns(ts => [...(ts||[]), {
        id:       uid(),
        type:     draft.type,
        amount,
        category: draft.category,
        note:     draft.note.trim(),
        date:     draft.date,
        month:    draft.date.slice(0,7),
        created:  Date.now(),
      }])
    }
    setDraft(d => ({ ...d, amount:'', note:'' }))
    setShowAdd(false)
  }

  const openEditTxn = (txn) => {
    setDraft({ type:txn.type, amount:String(txn.amount), category:txn.category, note:txn.note||'', date:txn.date })
    setEditTxnId(txn.id)
    setShowAdd(true)
  }

  const removeTxn = id => setTxns(ts => ts.filter(t => t.id !== id))

  const isCurrentMonth = monthKey() === mk

  const prevMonth = () => setViewMonth(d => { const n=new Date(d); n.setMonth(n.getMonth()-1); return n })
  const nextMonth = () => {
    if (isCurrentMonth) return
    setViewMonth(d => { const n=new Date(d); n.setMonth(n.getMonth()+1); return n })
  }

  const exportCSV = () => {
    const lines = ['Дата,Тип,Категория,Сумма,Заметка']
    ;[...txns].sort((a,b) => a.date.localeCompare(b.date)).forEach(t =>
      lines.push(`${t.date},${t.type==='expense'?'Расход':'Доход'},"${t.category}",${t.amount},"${t.note||''}"`)
    )
    const blob = new Blob(['﻿' + lines.join('\n')], { type:'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `budget-${mk}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view">
      {/* Заголовок */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:18, marginBottom:22 }}>
        <div style={{ flex:1 }}>
          <div className="pg-eyebrow mono">Финансы</div>
          <div className="pg-title">Бюджет</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {txns.length > 0 && (
            <button className="tb-btn" onClick={exportCSV}>
              <Icon name="note" size={14}/> CSV
            </button>
          )}
          <button className="tb-btn" onClick={() => { setCatLimitsDraft({...catLimits}); setShowCatLimits(true) }}>
            <Icon name="tag" size={14}/> Лимиты ⚙
          </button>
          <button className="tb-btn" onClick={() => { setBudgetDraft(budget||''); setShowBudget(true) }}>
            <Icon name="edit" size={14}/> Лимит
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={15}/> Добавить
          </button>
        </div>
      </div>

      {/* Навигация по месяцам */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <button onClick={prevMonth} style={navBtn}>◀</button>
        <div style={{ flex:1, textAlign:'center', fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>
          {MONTHS_RU[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </div>
        <button onClick={nextMonth} disabled={isCurrentMonth} style={{ ...navBtn, opacity: isCurrentMonth ? 0.3 : 1 }}>▶</button>
      </div>

      {/* Карточки сводки */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <SumCard label="Доходы"  value={income}  color="var(--c-calm)"      icon="spark" />
        <SumCard label="Расходы" value={expense} color="#f87171"        icon="trash" />
        <SumCard label="Баланс"  value={balance} color={balance>=0?"var(--c-calm)":"#f87171"} icon="check" />
      </div>

      {/* Прогресс бюджета */}
      {budget > 0 && (
        <div className="card" style={{ marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>Лимит расходов</div>
            <div style={{ fontFamily:'"JetBrains Mono"', fontSize:12.5, color: budgetPct > 90 ? '#f87171' : 'var(--t-mute)' }}>
              {fmtMoney(expense)} / {fmtMoney(budget)}
            </div>
          </div>
          <div style={{ height:8, borderRadius:99, background:'var(--surf-hi)' }}>
            <div style={{ height:'100%', borderRadius:99, background: budgetPct > 90 ? '#f87171' : budgetPct > 70 ? '#fbbf24' : 'var(--c-calm)', width:`${budgetPct}%`, transition:'width .5s ease', boxShadow: budgetPct > 90 ? '0 0 10px #f8717188' : 'none' }}/>
          </div>
          <div style={{ fontSize:12, color:'var(--t-mute)', marginTop:6 }}>
            {budgetPct < 100 ? `Осталось ${fmtMoney(budget - expense)}` : `Превышение на ${fmtMoney(expense - budget)}`}
          </div>
        </div>
      )}

      {/* Вкладки */}
      <div style={{ display:'flex', gap:4, background:'var(--surf-2)', borderRadius:10, padding:4, border:'1px solid var(--line)', marginBottom:16, alignSelf:'flex-start', width:'fit-content' }}>
        {[['overview','Обзор'],['history','История']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:'6px 16px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:500, transition:'all .15s', background: tab===id?'var(--acc)':'transparent', color: tab===id?'#fff':'var(--t-mute)', boxShadow: tab===id?'0 2px 8px color-mix(in oklch, var(--acc) 40%, transparent)':'none' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          {byCategory.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--t-mute)' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>💰</div>
              <div>Добавь первую транзакцию</div>
            </div>
          ) : (
            <div className="card">
              <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:14, marginBottom:14 }}>По категориям</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {byCategory.map(([cat, amt]) => {
                  const pct = expense > 0 ? (amt / expense) * 100 : 0
                  const catLimit = catLimits[cat] ? parseFloat(catLimits[cat]) : null
                  const catLimitPct = catLimit ? Math.min((amt / catLimit) * 100, 100) : null
                  const catLimitColor = catLimitPct > 90 ? '#f87171' : catLimitPct > 70 ? '#fbbf24' : 'var(--c-calm)'
                  return (
                    <div key={cat}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:13.5, fontWeight:500 }}>{CAT_ICONS[cat]||'💸'} {cat}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {catLimitPct !== null && (
                            <span style={{ fontSize:11, fontFamily:'"JetBrains Mono"', color:catLimitColor, fontWeight:600 }}>
                              {Math.round(catLimitPct)}% лимита
                            </span>
                          )}
                          <span style={{ fontFamily:'"JetBrains Mono"', fontSize:13, color:'var(--t-mute)' }}>{fmtMoney(amt)}</span>
                        </div>
                      </div>
                      {/* Бар % от общих расходов */}
                      <div style={{ height:5, borderRadius:99, background:'var(--surf-hi)' }}>
                        <div style={{ height:'100%', borderRadius:99, background:'var(--acc)', width:`${pct}%`, transition:'width .4s ease', opacity:0.8 }}/>
                      </div>
                      {/* Бар лимита категории */}
                      {catLimitPct !== null && (
                        <div style={{ height:3, borderRadius:99, background:'var(--surf-hi)', marginTop:3 }}>
                          <div style={{ height:'100%', borderRadius:99, background:catLimitColor, width:`${catLimitPct}%`, transition:'width .4s ease' }}/>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {txns.length > 0 && (
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <div style={{ position:'relative', flex:1 }}>
                <Icon name="search" size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t-mute)', pointerEvents:'none' }}/>
                <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder="Поиск по заметке или категории…"
                  style={{ width:'100%', padding:'7px 32px 7px 32px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}
                />
                {histSearch && (
                  <button onClick={() => setHistSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', fontSize:15, lineHeight:1, padding:2 }}>×</button>
                )}
              </div>
              <select value={histCatFilter} onChange={e=>setHistCatFilter(e.target.value)}
                style={{ padding:'7px 11px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', cursor:'pointer' }}>
                <option value="">Все категории</option>
                {CATS_EXP.map(c => <option key={c}>{c}</option>)}
                {CATS_INC.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {filteredTxns.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--t-mute)' }}>
                {txns.length === 0 ? 'Транзакций нет' : 'Ничего не найдено'}
              </div>
            )}
            {filteredTxns.map(t => (
              <TxnRow key={t.id} txn={t} onEdit={() => openEditTxn(t)} onDelete={() => removeTxn(t.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Форма добавления / редактирования */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={e => { if (e.target===e.currentTarget) { setShowAdd(false); setEditTxnId(null); setDraft(d => ({ ...d, amount:'', note:'' })) } }}>
          <div style={{ width:420, background:'var(--surf)', border:'1px solid var(--line)', borderRadius:20, padding:26, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>{editTxnId ? 'Редактировать транзакцию' : 'Добавить транзакцию'}</div>

            {/* Тип */}
            <div style={{ display:'flex', gap:4, background:'var(--surf-2)', borderRadius:10, padding:4, border:'1px solid var(--line)' }}>
              {[['expense','💸 Расход'],['income','💰 Доход']].map(([v,l]) => (
                <button key={v} onClick={() => setDraft(d=>({...d,type:v, category: v==='expense'?'Еда':'Зарплата'}))}
                  style={{ flex:1, padding:'7px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:500, transition:'all .15s', background: draft.type===v?(v==='expense'?'#f87171':'var(--c-calm)'):'transparent', color: draft.type===v?'#fff':'var(--t-mute)' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Сумма */}
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--t-mute)' }}>₽</span>
              <input autoFocus type="number" value={draft.amount} onChange={e=>setDraft(d=>({...d,amount:e.target.value}))}
                onKeyDown={e=>e.key==='Enter'&&addTxn()}
                placeholder="0"
                style={{ width:'100%', padding:'10px 12px 10px 30px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:18, fontWeight:700, outline:'none', boxSizing:'border-box', fontFamily:'"Space Grotesk"' }}/>
            </div>

            {/* Категория */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Категория</div>
                <select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', cursor:'pointer' }}>
                  {(draft.type==='expense' ? CATS_EXP : CATS_INC).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--t-mute)', marginBottom:6, fontFamily:'"JetBrains Mono"' }}>Дата</div>
                <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
              </div>
            </div>

            <input value={draft.note} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} placeholder="Заметка (необязательно)…"
              style={{ padding:'8px 12px', borderRadius:9, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none' }}/>

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={addTxn}>{editTxnId ? 'Сохранить' : 'Добавить'}</button>
              <button className="tb-btn" onClick={() => { setShowAdd(false); setEditTxnId(null); setDraft(d => ({ ...d, amount:'', note:'' })) }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Лимиты по категориям */}
      {showCatLimits && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={e => e.target===e.currentTarget && setShowCatLimits(false)}>
          <div style={{ width:420, background:'var(--surf)', border:'1px solid var(--line)', borderRadius:20, padding:26, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>Лимиты по категориям</div>
            <div style={{ fontSize:12.5, color:'var(--t-mute)', marginBottom:2 }}>Оставь пустым — без лимита</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:380, overflowY:'auto' }}>
              {CATS_EXP.map(cat => (
                <div key={cat} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:13, flex:1 }}>{CAT_ICONS[cat]||'💸'} {cat}</span>
                  <div style={{ position:'relative', width:130 }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'var(--t-mute)' }}>₽</span>
                    <input type="number" min={0} value={catLimitsDraft[cat]||''} onChange={e => setCatLimitsDraft(d=>({...d,[cat]:e.target.value}))}
                      placeholder="∞"
                      style={{ width:'100%', padding:'7px 8px 7px 26px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:13, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={() => {
                const cleaned = {}
                Object.entries(catLimitsDraft).forEach(([k,v]) => { if (v && parseFloat(v) > 0) cleaned[k] = parseFloat(v) })
                setCatLimits(cleaned); setShowCatLimits(false)
              }}>Сохранить</button>
              <button className="tb-btn" onClick={() => setShowCatLimits(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Форма лимита */}
      {showBudget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={e => e.target===e.currentTarget && setShowBudget(false)}>
          <div style={{ width:340, background:'var(--surf)', border:'1px solid var(--line)', borderRadius:20, padding:24, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:18 }}>Лимит расходов на месяц</div>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:18, color:'var(--t-mute)' }}>₽</span>
              <input autoFocus type="number" value={budgetDraft} onChange={e=>setBudgetDraft(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'){ setBudget(parseFloat(budgetDraft)||0); setShowBudget(false) }}}
                placeholder="50 000"
                style={{ width:'100%', padding:'10px 12px 10px 30px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surf-2)', color:'var(--t)', fontSize:20, fontWeight:700, outline:'none', boxSizing:'border-box', fontFamily:'"Space Grotesk"' }}/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={() => { setBudget(parseFloat(budgetDraft)||0); setShowBudget(false) }}>Сохранить</button>
              <button className="tb-btn" onClick={() => setShowBudget(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SumCard({ label, value, color, icon }) {
  return (
    <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:`color-mix(in oklch,${color} 15%,transparent)`, display:'grid', placeItems:'center', color, flexShrink:0 }}>
        <Icon name={icon} size={17}/>
      </div>
      <div>
        <div style={{ fontFamily:'"Space Grotesk"', fontSize:18, fontWeight:700, lineHeight:1, color }}>{fmtMoney(value)}</div>
        <div style={{ fontSize:11.5, color:'var(--t-mute)', marginTop:2 }}>{label}</div>
      </div>
    </div>
  )
}

function TxnRow({ txn, onEdit, onDelete }) {
  const [hover, setHover] = useState(false)
  const isExp = txn.type === 'expense'
  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:12, border:'1px solid var(--line)', background:'var(--surf-2)', transition:'all .12s' }}>
      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, display:'grid', placeItems:'center', fontSize:18, background:`color-mix(in oklch,${isExp?'#f87171':'var(--c-calm)'} 12%,transparent)` }}>
        {CAT_ICONS[txn.category]||'💸'}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>{txn.category}</div>
        <div style={{ fontSize:12, color:'var(--t-mute)', marginTop:1 }}>
          {txn.note || txn.date}
          {txn.note && <span style={{ color:'var(--t-mute)', marginLeft:6 }}>{txn.date}</span>}
        </div>
      </div>
      <div style={{ fontFamily:'"Space Grotesk"', fontWeight:700, fontSize:16, color: isExp?'#f87171':'var(--c-calm)' }}>
        {isExp?'−':'+'}₽{txn.amount.toLocaleString('ru-RU')}
      </div>
      <div style={{ display:'flex', gap:2, opacity:hover?1:0, transition:'opacity .15s' }}>
        <button onClick={onEdit} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }}>
          <Icon name="edit" size={13}/>
        </button>
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t-mute)', display:'grid', placeItems:'center', padding:4 }}>
          <Icon name="trash" size={13}/>
        </button>
      </div>
    </div>
  )
}

const navBtn = { background:'var(--surf-2)', border:'1px solid var(--line)', borderRadius:9, cursor:'pointer', color:'var(--t)', width:32, height:32, display:'grid', placeItems:'center', fontSize:12 }
