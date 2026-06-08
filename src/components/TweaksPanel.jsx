// TweaksPanel.jsx — панель настройки внешнего вида
import { useState } from 'react'

const STORE_KEY = 'jarvis_tweaks'

/* ─── Хук для хранения tweaks в localStorage ─── */
export function useTweaks(defaults) {
  const load = () => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } }
    catch { return { ...defaults } }
  }
  const [t, setT] = useState(load)
  const set = (key, val) => setT(prev => {
    const next = { ...prev, [key]: val }
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    return next
  })
  return [t, set]
}

/* ─── Панель (controlled через open/onClose) ─── */
export function TweaksPanel({ open, onClose, children }) {
  return (
    <>
      {/* Подложка */}
      {open && (
        <div
          onClick={onClose}
          style={{ position:'fixed', inset:0, zIndex:14 }}
        />
      )}
      {/* Сама панель */}
      <div style={{
        position: 'absolute', top:0, right:0, bottom:0, width:268,
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--line)',
        padding: '24px 18px',
        zIndex: 15,
        overflowY: 'auto',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s ease',
        display: 'flex', flexDirection:'column', gap:20,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--text-mute)' }}>
            Внешний вид
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-mute)', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 2px' }}>×</button>
        </div>
        {children}
      </div>
    </>
  )
}

/* ─── Секция ─── */
export function TweakSection({ title, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:12.5, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{title}</div>
      {children}
    </div>
  )
}

/* ─── Выбор цвета (color input) ─── */
export function TweakColor({ label, value, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ flex:1, fontSize:12.5, color:'var(--text-mute)' }}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width:32, height:26, border:'1px solid var(--line)', borderRadius:6, cursor:'pointer', background:'none', padding:2 }}
      />
      <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--text-faint)', width:56 }}>{value}</span>
    </div>
  )
}

/* ─── Одна кнопка-радио ─── */
export function TweakRadio({ label, value, current, onChange }) {
  const on = current === value
  return (
    <button
      onClick={() => onChange(value)}
      style={{
        padding: '7px 12px',
        borderRadius: 8,
        border: '1px solid',
        borderColor: on ? 'var(--line-accent)' : 'var(--line)',
        background: on ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'var(--surface-2)',
        color: on ? 'var(--accent-soft)' : 'var(--text-mute)',
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  )
}

/* ─── Текстовое поле ─── */
export function TweakText({ label, value, onChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <span style={{ fontSize:12.5, color:'var(--text-mute)' }}>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:8, padding:'8px 11px', color:'var(--text)', fontFamily:'var(--font-body)', fontSize:13.5, outline:'none', transition:'border-color .15s' }}
        onFocus={e => { e.target.style.borderColor = 'var(--line-accent)' }}
        onBlur={e  => { e.target.style.borderColor = 'var(--line)' }}
      />
    </div>
  )
}
