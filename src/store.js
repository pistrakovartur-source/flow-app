// store.js — хранилище данных на localStorage + React-хук
import { useState, useEffect, useCallback, useRef } from 'react'

const PREFIX = 'flow__'

class AppStore {
  _listeners = {}

  get(key, def = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw !== null ? JSON.parse(raw) : def
    } catch { return def }
  }

  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    this._listeners[key]?.forEach(fn => fn(value))
  }

  on(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = []
    this._listeners[key].push(fn)
    return () => { this._listeners[key] = this._listeners[key].filter(f => f !== fn) }
  }

  reset() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
    Object.keys(this._listeners).forEach(key =>
      this._listeners[key]?.forEach(fn => fn(null))
    )
  }
}

export const Store = new AppStore()

export function useStore(key, def = null) {
  // Стабилизируем ссылку на def через ref — предотвращает лишние подписки
  // если вызывающий код создаёт новый объект/массив на каждом рендере
  const defRef = useRef(def)
  defRef.current = def

  const [val, setVal] = useState(() => Store.get(key, defRef.current))

  useEffect(() => {
    setVal(Store.get(key, defRef.current))
    return Store.on(key, v => setVal(v ?? defRef.current))
  }, [key]) // key — единственная нестабильная зависимость; def держим через ref

  const set = useCallback(v => {
    Store.set(key, typeof v === 'function' ? v(Store.get(key, defRef.current)) : v)
  }, [key])

  return [val, set]
}

export const uid = () => Math.random().toString(36).slice(2, 10)

// ─── Единый polling музыки ─────────────────────────────────────────────────────
// Синглтон с подсчётом ссылок — предотвращает двойной IPC из DynamicIsland + Dashboard
let _musicPollRefs = 0
let _musicPollTimer = null

function _musicPoll() {
  if (!window.jarvis?.music?.getTrack) return
  window.jarvis.music.getTrack()
    .then(t => {
      const prev = Store.get('music_track', null)
      if (!t && !prev) return
      if (t?.title === prev?.title && t?.playing === prev?.playing) return
      Store.set('music_track', t)
    })
    .catch(() => {})
}

export function musicPollStart() {
  _musicPollRefs++
  if (_musicPollRefs === 1) {
    _musicPoll()
    _musicPollTimer = setInterval(() => {
      if (!document.hidden) _musicPoll()
    }, 2000)
  }
}

export function musicPollStop() {
  _musicPollRefs = Math.max(0, _musicPollRefs - 1)
  if (_musicPollRefs === 0 && _musicPollTimer) {
    clearInterval(_musicPollTimer)
    _musicPollTimer = null
  }
}

// Когда main-процесс (Telegram бот) пишет в localStorage, он шлёт 'store:refresh'.
// Здесь перечитываем значение и уведомляем подписчиков — React-компоненты перерендерятся.
if (typeof window !== 'undefined' && window.jarvis?.store?.onRefresh) {
  window.jarvis.store.onRefresh((key) => {
    const val = Store.get(key)
    Store._listeners[key]?.forEach(fn => fn(val))
  })
}
