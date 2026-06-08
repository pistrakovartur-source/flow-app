// Orb.jsx — анимированный шар
import { memo } from 'react'

export const Orb = memo(function Orb({ size = 120, state = 'idle', wave = true }) {
  const pulse   = state !== 'idle'
  const speed   = state === 'listening' ? '1.2s' : state === 'speaking' ? '0.6s' : '0.9s'
  const glowAlpha = state === 'idle' ? 0.4 : state === 'listening' ? 0.8 : 0.65

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {wave && <div style={{ position: 'absolute', inset: -size * 0.08, borderRadius: '50%', border: `1px solid rgba(59,130,246,${glowAlpha * 0.3})`, animation: pulse ? `orbPulse ${speed} ease-in-out infinite` : 'none', willChange: 'transform' }} />}
      {wave && <div style={{ position: 'absolute', inset: -size * 0.04, borderRadius: '50%', border: `1px solid rgba(59,130,246,${glowAlpha * 0.15})`, animation: pulse ? `orbPulse ${speed} ease-in-out infinite reverse` : 'none', willChange: 'transform' }} />}
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 35% 35%, rgba(180,210,255,${0.5 + glowAlpha * 0.3}), rgba(59,130,246,${0.65 + glowAlpha * 0.2}) 40%, rgba(30,58,138,0.85) 70%, rgba(10,20,60,0.95) 100%)`,
        boxShadow: `0 0 ${size * 0.3}px rgba(59,130,246,${glowAlpha * 0.5}), inset 0 ${size * 0.04}px ${size * 0.12}px rgba(255,255,255,0.12)`,
        animation: pulse ? `orbPulse ${speed} ease-in-out infinite` : 'none',
        willChange: 'transform',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '12%', left: '18%', width: '38%', height: '28%', borderRadius: '50%', background: `radial-gradient(ellipse, rgba(255,255,255,0.3), transparent 70%)`, filter: 'blur(2px)', transform: 'rotate(-25deg)' }} />
      </div>
    </div>
  )
})
