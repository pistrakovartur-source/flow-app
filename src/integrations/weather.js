// weather.js — Open-Meteo API (бесплатно, без ключа)
// Город берётся из профиля пользователя; fallback на Саранск

const FALLBACK_LAT = 54.19
const FALLBACK_LON = 45.18
const FALLBACK_CITY = 'Саранск'

const WMO_ICON = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'🌨️', 77:'❄️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  85:'🌨️', 86:'🌨️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
}

const WMO_DESC = {
  0:'Ясно', 1:'Почти ясно', 2:'Переменная облачность', 3:'Пасмурно',
  45:'Туман', 48:'Туман с изморозью',
  51:'Лёгкая морось', 53:'Морось', 55:'Сильная морось',
  61:'Лёгкий дождь', 63:'Дождь', 65:'Сильный дождь',
  71:'Лёгкий снег', 73:'Снег', 75:'Сильный снег', 77:'Снежная крупа',
  80:'Лёгкий ливень', 81:'Ливень', 82:'Сильный ливень',
  85:'Снежный ливень', 86:'Сильный снежный ливень',
  95:'Гроза', 96:'Гроза с градом', 99:'Гроза с крупным градом',
}

const WEATHER_CACHE_TTL = 30 * 60 * 1000  // 30 минут
const GEO_CACHE_TTL     = 24 * 60 * 60 * 1000 // 24 часа
const WEATHER_CACHE_KEY = 'weather_cache_v2'
const GEO_CACHE_KEY     = 'weather_geo_cache'

async function resolveCoords(city) {
  if (!city) return { lat: FALLBACK_LAT, lon: FALLBACK_LON, name: FALLBACK_CITY }

  // Проверяем кеш геокодирования
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY)
    if (raw) {
      const { ts, city: cachedCity, lat, lon, name } = JSON.parse(raw)
      if (cachedCity === city && Date.now() - ts < GEO_CACHE_TTL) return { lat, lon, name }
    }
  } catch {}

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) throw new Error('geo error')
    const data = await resp.json()
    const r = data?.results?.[0]
    if (!r) throw new Error('not found')
    const result = { lat: r.latitude, lon: r.longitude, name: r.name }
    try { sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), city, ...result })) } catch {}
    return result
  } catch {
    return { lat: FALLBACK_LAT, lon: FALLBACK_LON, name: FALLBACK_CITY }
  }
}

export async function getWeather(city) {
  // Проверяем кеш погоды
  try {
    const raw = sessionStorage.getItem(WEATHER_CACHE_KEY)
    if (raw) {
      const { ts, data, cachedCity } = JSON.parse(raw)
      const isSameCity = (!city && cachedCity === FALLBACK_CITY) || cachedCity === city
      if (isSameCity && Date.now() - ts < WEATHER_CACHE_TTL) return data
    }
  } catch {}

  const { lat, lon, name } = await resolveCoords(city)

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',  lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('current',   'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code')
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('timezone',  'auto')

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const raw = await resp.json()
  const c = raw.current

  const code = c.weather_code
  const data = {
    city:     name,
    temp:     Math.round(c.temperature_2m),
    feels:    Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    wind:     Math.round(c.wind_speed_10m * 10) / 10,
    icon:     WMO_ICON[code]  || '🌡️',
    desc:     WMO_DESC[code]  || 'Неизвестно',
  }

  try { sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), cachedCity: name, data })) } catch {}
  return data
}

// Обратная совместимость
export const getSaranskWeather = () => getWeather('')
