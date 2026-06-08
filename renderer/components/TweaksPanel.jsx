/* TweaksPanel.jsx — боковая панель тонкой настройки (акцент, плотность, имя) */

const { useState, useEffect } = React;

// Хук для сохранения настроек в localStorage
function useTweaks(defaults) {
  const STORE_KEY = 'jarvis_tweaks';

  const load = () => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
    } catch {
      return defaults;
    }
  };

  const [tweaks, setTweaks] = useState(load);

  const set = (key, value) => {
    setTweaks(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return [tweaks, set];
}

// ── Панель ──
function TweaksPanel({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Кнопка вызова */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute', bottom: 20, right: open ? 284 : 16,
          zIndex: 20,
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          color: 'var(--text-mute)', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          transition: 'right 0.3s cubic-bezier(.4,0,.2,1)',
          fontSize: 16,
        }}
        title="Настройки вида"
      >
        ⚙
      </button>

      {/* Сама панель */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 268,
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--line)',
        padding: '20px 16px',
        zIndex: 15,
        overflowY: 'auto',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-mute)', marginBottom: 4 }}>
          Настройки вида
        </div>
        {children}
      </div>
    </>
  );
}

// ── Блок секции ──
function TweakSection({ label }) {
  return (
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
      {label}
    </div>
  );
}

// ── Выбор цвета акцента ──
function TweakColor({ label, value, options, onChange }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>{label}</span>
      <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
        {options.map(c => (
          <div
            key={c}
            onClick={() => onChange(c)}
            style={{
              width: 26, height: 26, borderRadius: '50%', background: c,
              cursor: 'pointer',
              outline: value === c ? `2px solid ${c}` : '2px solid transparent',
              outlineOffset: 3,
              transition: 'outline 0.15s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Выбор варианта (radio) ──
function TweakRadio({ label, value, options, onChange }) {
  const labels = { compact: 'компакт', regular: 'обычная', comfy: 'просторно' };
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>{label}</span>
      <div className="row gap-s">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid',
              borderColor: value === o ? 'var(--line-accent)' : 'var(--line)',
              background: value === o ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'var(--surface-2)',
              color: value === o ? 'var(--accent-soft)' : 'var(--text-mute)',
              fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
            }}
          >
            {labels[o] || o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Текстовое поле ──
function TweakText({ label, value, onChange }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 8, padding: '8px 11px',
          color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13,
          outline: 'none',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--line-accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--line)'}
      />
    </div>
  );
}

window.useTweaks      = useTweaks;
window.TweaksPanel    = TweaksPanel;
window.TweakSection   = TweakSection;
window.TweakColor     = TweakColor;
window.TweakRadio     = TweakRadio;
window.TweakText      = TweakText;
