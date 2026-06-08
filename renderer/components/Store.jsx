/* Store.jsx — централизованное хранилище (localStorage + события) */
/* Все данные приложения живут здесь. Компоненты подписываются через useStore. */

class AppStore {
  constructor() {
    this._listeners = {};
  }

  // Прочитать данные
  get(key, def = null) {
    try {
      const raw = localStorage.getItem('jarvis__' + key);
      return raw !== null ? JSON.parse(raw) : def;
    } catch { return def; }
  }

  // Сохранить и уведомить подписчиков
  set(key, value) {
    try {
      localStorage.setItem('jarvis__' + key, JSON.stringify(value));
      (this._listeners[key] || []).forEach(fn => fn(value));
    } catch (e) { console.error('[Store]', e); }
  }

  // Подписаться на изменения ключа, возвращает функцию отписки
  on(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
    return () => { this._listeners[key] = this._listeners[key].filter(f => f !== fn); };
  }

  // Сбросить все данные (кроме настроек tweaks)
  reset() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('jarvis__'));
    keys.forEach(k => localStorage.removeItem(k));
    // Уведомить всех подписчиков
    Object.keys(this._listeners).forEach(key => {
      (this._listeners[key] || []).forEach(fn => fn(null));
    });
  }
}

const Store = new AppStore();
window.Store = Store;

// ── React хук ──
function useStore(key, def = null) {
  const [val, setVal] = React.useState(() => Store.get(key, def));

  React.useEffect(() => {
    setVal(Store.get(key, def));
    return Store.on(key, v => setVal(v !== null ? v : def));
  }, [key]);

  const set = React.useCallback(v => {
    const next = typeof v === 'function' ? v(Store.get(key, def)) : v;
    Store.set(key, next);
  }, [key]);

  return [val, set];
}

window.useStore = useStore;

// ── Утилита: уникальный ID ──
window.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
