// yandex.js — Яндекс OAuth + CalDAV + IMAP
// Документация OAuth: https://yandex.ru/dev/id/doc/ru/
// Регистрация приложения: https://oauth.yandex.ru/

const AUTH_URL    = 'https://oauth.yandex.ru/authorize'
const TOKEN_URL   = 'https://oauth.yandex.ru/token'
const PROFILE_URL = 'https://login.yandex.ru/info?format=json'
const REDIRECT    = 'http://localhost:8765/callback'

// Базовые скоупы — всегда доступны
const SCOPES      = 'login:email login:info login:avatar'
// Расширенные — нужно включить в настройках app на oauth.yandex.ru
const SCOPES_MAIL = 'login:email login:info login:avatar mail:imap_full'

// ── Auth URL ───────────────────────────────────────────────────────────────
export function yandexAuthUrl(clientId) {
  return `${AUTH_URL}?` + new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  REDIRECT,
    scope:         SCOPES,
    force_confirm: 'false',
  })
}

// URL с запросом доступа к почте (для кнопки "Включить почту")
export function yandexMailAuthUrl(clientId) {
  return `${AUTH_URL}?` + new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  REDIRECT,
    scope:         SCOPES_MAIL,
    force_confirm: 'yes', // всегда показываем экран согласия
  })
}

// ── Обмен кода на токены ──────────────────────────────────────────────────
export async function yandexExchangeCode(clientId, clientSecret, code) {
  const resp = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  REDIRECT,
    }),
  })
  return resp.json()
}

// ── Обновление токена ─────────────────────────────────────────────────────
export async function yandexRefresh(clientId, clientSecret, refreshToken) {
  const resp = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  })
  return resp.json()
}

// ── Профиль пользователя ──────────────────────────────────────────────────
export async function getYandexProfile(token) {
  const resp = await fetch(PROFILE_URL, {
    headers: { 'Authorization': `OAuth ${token}` },
  })
  const d = await resp.json()
  return {
    name:    d.real_name || d.display_name || d.login,
    email:   d.default_email,
    login:   d.login,
    id:      d.id,
    picture: d.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${d.default_avatar_id}/islands-200`
      : null,
  }
}

// ── Яндекс Календарь (CalDAV через IPC → main.js) ─────────────────────────
export async function getYandexCalendar(token, login) {
  if (!window.jarvis?.yandex?.calendar) throw new Error('IPC недоступен')
  return window.jarvis.yandex.calendar({ token, login })
}

// ── Яндекс Почта (IMAP через IPC → main.js) ──────────────────────────────
// appPassword — пароль приложения из Яндекс ID (предпочтительный метод)
// token — fallback через XOAUTH2 (требует mail:imap_full scope)
export async function getYandexMail(token, email, appPassword) {
  if (!window.jarvis?.yandex?.mail) throw new Error('IPC недоступен')
  return window.jarvis.yandex.mail({ token, email, appPassword: appPassword || null })
}
