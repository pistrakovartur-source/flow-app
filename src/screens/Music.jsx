import { useEffect, useRef, useState, useCallback } from 'react'

export function Music() {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)

  const getBounds = useCallback(() => {
    const el = containerRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  }, [])

  useEffect(() => {
    const b = getBounds()
    if (!b || !window.jarvis?.music) return

    window.jarvis.music.open(b).then(() => setLoading(false)).catch(() => setLoading(false))

    const onResize = () => {
      const b2 = getBounds()
      if (b2) window.jarvis?.music?.resize(b2)
    }

    const ro = new ResizeObserver(onResize)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', onResize)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      window.jarvis?.music?.hide()
    }
  }, [getBounds])

  return (
    <div ref={containerRef} style={{ position:'absolute', inset:0 }}>
      {loading && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, color:'var(--text-mute)', background:'var(--surface-1)' }}>
          <div style={{ width:90, height:90, borderRadius:24, background:'linear-gradient(135deg,#ffcc00,#ff6600)', display:'grid', placeItems:'center', boxShadow:'0 8px 40px rgba(255,204,0,0.35)', animation:'blink 2s ease infinite' }}>
            <span style={{ fontSize:44 }}>🎵</span>
          </div>
          <div style={{ fontWeight:700, fontSize:18, color:'var(--text)' }}>Яндекс Музыка</div>
          <div style={{ fontSize:13.5, color:'var(--text-mute)' }}>Загрузка…</div>
        </div>
      )}
    </div>
  )
}
