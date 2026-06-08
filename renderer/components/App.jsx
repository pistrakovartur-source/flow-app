/* App.jsx — корень приложения: онбординг + навигация + масштабирование */

const { useState, useEffect } = React;

const NAV = [
  { id: 'dashboard', label: 'Дашборд',  icon: 'grid'     },
  { id: 'voice',     label: 'Голос',     icon: 'mic'      },
  { id: 'memory',    label: 'Память',    icon: 'brain',   badgeKey: 'memory_facts' },
  { id: 'history',   label: 'История',   icon: 'history', badgeKey: 'sessions'     },
  { id: 'settings',  label: 'Настройки', icon: 'settings' },
];

const SCREENS = {
  dashboard: Dashboard,
  voice:     Voice,
  memory:    Memory,
  history:   History,
  settings:  Settings,
};

const TWEAK_DEFAULTS = {
  accent:    '#3b82f6',
  assistant: 'Jarvis',
  density:   'regular',
};

// ── Масштабирование окна ──
function useScale() {
  useEffect(() => {
    const el = document.getElementById('scaler');
    const fit = () => {
      const s = Math.min(window.innerWidth / 1320, window.innerHeight / 860, 1);
      el.style.transform = `scale(${s})`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
}

// ── Кнопки управления окном ──
function TitlebarButtons() {
  return (
    <div className="traffic">
      <button className="btn-close"    onClick={() => window.jarvis?.window.close()}    title="Закрыть"      />
      <button className="btn-minimize" onClick={() => window.jarvis?.window.minimize()} title="Свернуть"     />
      <button className="btn-maximize" onClick={() => window.jarvis?.window.maximize()} title="На весь экран"/>
    </div>
  );
}

// ── Бейдж навигации ──
function NavBadge({ badgeKey }) {
  const [items] = useStore(badgeKey, []);
  const count   = (items || []).length;
  if (!count) return null;
  return <span className="badge">{count > 99 ? '99+' : count}</span>;
}

// ── Главный компонент ──
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage]    = useState('dashboard');

  // Проверяем онбординг
  const [onboardingDone, setOnboardingDone] = useStore('onboarding_done', false);

  useScale();

  // Применяем CSS-переменные
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    const d = tweaks.density === 'compact' ? '0.7' : tweaks.density === 'comfy' ? '1.25' : '1';
    document.documentElement.style.setProperty('--density', d);
  }, [tweaks.accent, tweaks.density]);

  const assistant = tweaks.assistant || 'Jarvis';
  const Screen    = SCREENS[page] || Dashboard;

  // ── Показываем онбординг если не пройден ──
  if (!onboardingDone) {
    return <Onboarding assistant={assistant} onComplete={() => setOnboardingDone(true)} />;
  }

  return (
    <div className="window">

      {/* Titlebar */}
      <div className="titlebar">
        <TitlebarButtons />
        <span className="tb-title">{assistant} · assistant</span>
        <div className="tb-status">
          <span className="dot" /> онлайн · локальная память
        </div>
      </div>

      {/* Основной макет */}
      <div className="shell">

        {/* Сайдбар */}
        <aside className="sidebar">
          <div className="brand">
            <Orb size={34} state="idle" wave={false} />
            <div className="col">
              <span className="brand-name">{assistant}</span>
              <span className="brand-sub">личный ассистент</span>
            </div>
          </div>

          <div className="nav-label">Главное</div>
          {NAV.map(n => (
            <div key={n.id} className={'nav-item' + (page === n.id ? ' active' : '')} onClick={() => setPage(n.id)}>
              <span className="ico"><Icon name={n.icon} size={19} /></span>
              <span>{n.label}</span>
              {n.badgeKey && <NavBadge badgeKey={n.badgeKey} />}
            </div>
          ))}

          {/* Профиль пользователя */}
          <ProfileChip />
        </aside>

        {/* Контент */}
        <main className="content" key={page}>
          <Screen assistant={assistant} />
        </main>
      </div>

      {/* Панель твиков */}
      <TweaksPanel>
        <TweakSection label="Внешний вид" />
        <TweakColor
          label="Акцент"
          value={tweaks.accent}
          options={['#3b82f6', '#22d3ee', '#a78bfa', '#34d399', '#d4a24e', '#fb7185']}
          onChange={v => setTweak('accent', v)}
        />
        <TweakRadio
          label="Плотность"
          value={tweaks.density}
          options={['compact', 'regular', 'comfy']}
          onChange={v => setTweak('density', v)}
        />
        <TweakSection label="Ассистент" />
        <TweakText
          label="Имя"
          value={tweaks.assistant}
          onChange={v => setTweak('assistant', v)}
        />
      </TweaksPanel>
    </div>
  );
}

// ── Чип профиля в подвале сайдбара ──
function ProfileChip() {
  const [profile] = useStore('profile', {});
  const name      = profile?.name  || 'Пользователь';
  const email     = profile?.email || '';
  const letter    = name[0]?.toUpperCase() || '?';

  return (
    <div className="sidebar-foot">
      <div className="user-chip">
        <div className="ava">{letter}</div>
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <span className="u-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <span className="u-mail" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
        </div>
        <Icon name="chevron" size={16} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('scaler')).render(<App />);
