/* Orb.jsx — анимированный шар Jarvis */

function Orb({ size = 120, state = 'idle', wave = true }) {
  const { useRef, useEffect } = React;

  // Цвета и интенсивность свечения в зависимости от состояния
  const config = {
    idle:      { glow: 0.5, pulse: false, speed: 'none' },
    listening: { glow: 0.9, pulse: true,  speed: '1.2s' },
    thinking:  { glow: 0.7, pulse: true,  speed: '0.8s' },
    speaking:  { glow: 1.0, pulse: true,  speed: '0.6s' },
  };

  const c = config[state] || config.idle;

  const wrapStyle = {
    width: size,
    height: size,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  // Внешнее кольцо — появляется при активных состояниях
  const ringStyle = {
    position: 'absolute',
    inset: -size * 0.08,
    borderRadius: '50%',
    border: `1px solid rgba(59, 130, 246, ${c.glow * 0.3})`,
    animation: c.pulse ? `orbPulse ${c.speed} ease-in-out infinite` : 'none',
  };

  // Второе кольцо для глубины
  const ring2Style = {
    position: 'absolute',
    inset: -size * 0.04,
    borderRadius: '50%',
    border: `1px solid rgba(59, 130, 246, ${c.glow * 0.15})`,
    animation: c.pulse ? `orbPulse ${c.speed} ease-in-out infinite reverse` : 'none',
  };

  // Сам шар
  const orbStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `
      radial-gradient(circle at 35% 35%,
        rgba(180, 210, 255, ${0.55 + c.glow * 0.3}),
        rgba(59, 130, 246, ${0.7 + c.glow * 0.2}) 40%,
        rgba(30, 58, 138, ${0.85}) 70%,
        rgba(10, 20, 60, 0.95) 100%
      )
    `,
    boxShadow: `
      0 0 ${size * 0.3}px rgba(59, 130, 246, ${c.glow * 0.5}),
      0 0 ${size * 0.6}px rgba(59, 130, 246, ${c.glow * 0.2}),
      inset 0 ${size * 0.04}px ${size * 0.15}px rgba(255, 255, 255, 0.15),
      inset 0 -${size * 0.04}px ${size * 0.1}px rgba(0, 0, 0, 0.4)
    `,
    animation: c.pulse ? `orbPulse ${c.speed} ease-in-out infinite` : 'none',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  };

  // Блик
  const glareStyle = {
    position: 'absolute',
    top: '12%',
    left: '18%',
    width: '38%',
    height: '28%',
    borderRadius: '50%',
    background: `radial-gradient(ellipse, rgba(255,255,255,${0.35 + c.glow * 0.15}), transparent 70%)`,
    filter: 'blur(2px)',
    transform: 'rotate(-25deg)',
  };

  return (
    <div style={wrapStyle}>
      {wave && <div style={ring2Style} />}
      {wave && <div style={ringStyle} />}
      <div style={orbStyle}>
        <div style={glareStyle} />
      </div>
    </div>
  );
}

window.Orb = Orb;
