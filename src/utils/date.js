// ── Общие утилиты дат для всего приложения ───────────────────────────────
// Используются в: News, Activity, Diary, Calendar, Settings

/** YYYY-MM-DD текущего дня (локальная временная зона, не UTC) */
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

/** YYYY-MM-DD для произвольной даты (локальная временная зона) */
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

/**
 * Полная дата с днём недели (для Дневника, Настроек)
 * Пример: «понедельник, 1 января 2024 г.»
 */
export function fmtDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * Короткая дата (для мини-календаря, списков)
 * Пример: «1 янв»
 */
export function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short',
  })
}

/**
 * Относительное время для новостей и активности
 * Пример: «5 мин назад», «2 ч назад», «3 дн назад»
 */
export function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1)  return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days} дн назад`
  return fmtDateShort(new Date(ts).toISOString().slice(0, 10))
}

/**
 * YYYY-MM для месяца
 */
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}
