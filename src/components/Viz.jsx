import { useState, useEffect, useRef } from 'react'

export function AnimatedNumber({ value, dur = 1100, format = (n) => Math.round(n), className, style }) {
  const [v, setV] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    let raf, start
    const from = ref.current
    const step = (t) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      const cur = from + (value - from) * e
      ref.current = cur
      setV(cur)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, dur])
  return <span className={className} style={style}>{format(v)}</span>
}

export function Ring({ value, size = 120, stroke = 10, color = 'var(--acc)', track = 'var(--ring-track)', children, dur = 1300 }) {
  const [p, setP] = useState(0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  useEffect(() => {
    let raf, start
    const step = (t) => {
      if (!start) start = t
      const k = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      setP(value * e)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, dur])
  const off = c * (1 - Math.max(0, Math.min(1, p)))
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ filter: 'drop-shadow(0 0 7px color-mix(in oklch, var(--acc) 60%, transparent))' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export function Sparkline({ data, w = 220, h = 56, color = 'var(--acc)', fill = true, dot = true }) {
  if (!data?.length) return null
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const span = max - min || 1
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, h - 6 - ((d - min) / span) * (h - 14)])
  const path = smooth(pts)
  const last = pts[pts.length - 1]
  const gid = `sg${data.length}`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gid})`} className="spark-draw" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="spark-line" />
      {dot && last && <circle cx={last[0]} cy={last[1]} r="3.4" fill={color} style={{ filter: 'drop-shadow(0 0 5px var(--acc))' }} />}
    </svg>
  )
}

function smooth(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`
  }
  return d
}

export function Bars({ data, h = 64, gap = 5, color = 'var(--acc)', labels, highlight = -1, round = 4 }) {
  if (!data?.length) return null
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height: h }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div className="bar" style={{
            width: '100%', height: `${(d / max) * 100}%`, minHeight: d > 0 ? 4 : 2,
            background: i === highlight ? color : 'color-mix(in oklch, var(--acc) 28%, var(--surf-2))',
            borderRadius: round,
            boxShadow: i === highlight ? '0 0 12px color-mix(in oklch, var(--acc) 50%, transparent)' : 'none',
          }} />
          {labels && <span className="mono" style={{ fontSize: 9.5, color: i === highlight ? 'var(--t)' : 'var(--t-dim)', letterSpacing: '.02em' }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  )
}

export function Heatmap({ grid, cell = 11, gap = 3, radius = 3 }) {
  if (!grid?.length) return null
  return (
    <div style={{ display: 'flex', gap, overflow: 'hidden' }}>
      {grid.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
          {week.map((v, di) => (
            <div key={di} style={{
              width: cell, height: cell, borderRadius: radius,
              background: v === 0 ? 'var(--cell-0)' : `color-mix(in oklch, var(--acc) ${18 + v * 21}%, var(--cell-0))`,
              boxShadow: v >= 3 ? '0 0 6px color-mix(in oklch, var(--acc) 40%, transparent)' : 'none',
              animation: `cellpop .5s ${(wi * 7 + di) * 5}ms both`,
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function MoodDots({ data, max = 5 }) {
  if (!data?.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 34 }}>
      {data.map((m, i) => (
        <div key={i} style={{
          width: 9, height: `${(m / max) * 100}%`, borderRadius: 5,
          background: `color-mix(in oklch, var(--acc) ${30 + (m / max) * 60}%, var(--surf-2))`,
          alignSelf: 'flex-end',
        }} />
      ))}
    </div>
  )
}

export function Donut({ data, size = 170, thick = 22, center }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    let raf, s
    const step = (t) => {
      if (!s) s = t
      const p = Math.min(1, (t - s) / 1100)
      setK(1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  const total = data.reduce((a, d) => a + (d.val || 0), 0) || 1
  const r = (size - thick) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={thick} />
        {data.map((d, i) => {
          const frac = (d.val / total) * k
          const dash = frac * c
          const off = -acc * c
          acc += frac
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thick}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={off} strokeLinecap="butt" />
          )
        })}
      </svg>
      {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{center}</div>}
    </div>
  )
}
