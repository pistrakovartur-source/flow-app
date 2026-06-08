import { useRef, useState, useEffect } from 'react'
import { Icon } from './Icons'

export function Card({ children, className = '', style, pad, span, onClick, hover = true, area }) {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
      style={{ padding: pad, gridColumn: span ? `span ${span}` : undefined, gridArea: area, cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  )
}

export function CardHead({ icon, title, action, tint }) {
  return (
    <div className="card-head">
      <div className="card-head-l">
        {icon && <span className="card-ico" style={{ color: tint || 'var(--acc)' }}><Icon name={icon} size={15} /></span>}
        <span className="card-title">{title}</span>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ icon, eyebrow, title, sub, right }) {
  return (
    <div className="pg-head">
      <div className="pg-head-l">
        {eyebrow && <div className="pg-eyebrow mono">{icon && <Icon name={icon} size={13} />}<span>{eyebrow}</span></div>}
        <h1 className="pg-title">{title}</h1>
        {sub && <p className="pg-sub">{sub}</p>}
      </div>
      {right && <div className="pg-head-r">{right}</div>}
    </div>
  )
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const val = Array.isArray(o) ? o[0] : o
        const lab = Array.isArray(o) ? o[1] : o
        return (
          <button key={val} className={`seg-btn ${value === val ? 'on' : ''}`} onClick={() => onChange(val)}>{lab}</button>
        )
      })}
    </div>
  )
}

export function StatPill({ icon, value, label, tone }) {
  return (
    <div className="stat-pill">
      {icon && <span className="stat-pill-ico" style={{ color: tone || 'var(--acc)' }}><Icon name={icon} size={15} /></span>}
      <div className="stat-pill-txt">
        <div className="stat-pill-v mono">{value}</div>
        <div className="stat-pill-l">{label}</div>
      </div>
    </div>
  )
}

export function Sidebar({ nav, active, onNav, user }) {
  const railRef = useRef(null)
  const [ind, setInd] = useState({ y: 0, h: 0, o: 0 })
  useEffect(() => {
    const el = railRef.current?.querySelector(`[data-id="${active}"]`)
    if (el) setInd({ y: el.offsetTop, h: el.offsetHeight, o: 1 })
  }, [active, nav])

  return (
    <aside className="rail">
      <div className="brand rail-no-drag">
        <div className="brand-mark"><Icon name="bolt" size={20} /></div>
        <div>
          <div className="brand-name">Flow</div>
          <div className="brand-sub mono">ПЛАНИРОВЩИК</div>
        </div>
      </div>

      <div className="rail-label">Меню</div>
      <nav className="rail-nav" ref={railRef}>
        <div className="nav-ind" style={{ transform: `translateY(${ind.y}px)`, height: ind.h, opacity: ind.o }} />
        {nav.map((n) => {
          const badge = n.badge > 0 ? n.badge : 0
          return (
            <button key={n.id} data-id={n.id} className={`nav-item ${active === n.id ? 'on' : ''}`} onClick={() => onNav(n.id)}>
              <span className="nav-ico"><Icon name={n.icon} size={18} /></span>
              <span className="nav-txt">{n.label}</span>
              {badge > 0 && <span className="nav-badge">{badge}</span>}
            </button>
          )
        })}
      </nav>

      {user && (
        <div className="rail-user rail-no-drag" onClick={() => onNav('settings')}>
          <div className="ava">{user.initials}</div>
          <div className="rail-user-txt">
            <div className="ru-name">{user.name}</div>
            {user.email && <div className="ru-mail mono">{user.email}</div>}
          </div>
          <span className="ru-go"><Icon name="gear" size={15} /></span>
        </div>
      )}
    </aside>
  )
}
