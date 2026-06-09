// UTF-8 в консоли Windows (убирает кракозябли)
if (process.platform === 'win32') {
  process.stdout.reconfigure?.({ encoding: 'utf8' })
  process.stderr.reconfigure?.({ encoding: 'utf8' })
}

const { app, BrowserWindow, BrowserView, ipcMain, session, shell, net } = require('electron')
const path = require('path')
const http = require('http')
const { exec } = require('child_process')
const fs = require('fs')
const os = require('os')

// Только одна копия приложения — предотвращает конфликт LevelDB LOCK
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }

// ── Auto-updater (только в production build) ──────────────────────────────
let _autoUpdater = null
if (app.isPackaged) {
  try {
    _autoUpdater = require('electron-updater').autoUpdater
    _autoUpdater.autoDownload    = true
    _autoUpdater.autoInstallOnAppQuit = true
    _autoUpdater.logger          = null

    _autoUpdater.on('update-downloaded', info => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return
      const { dialog } = require('electron')
      dialog.showMessageBox(win, {
        type:      'info',
        title:     'Flow — обновление готово',
        message:   `Версия ${info.version} загружена`,
        detail:    'Перезапустить приложение чтобы применить обновление?',
        buttons:   ['Перезапустить сейчас', 'Позже'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) _autoUpdater.quitAndInstall()
      })
    })

    _autoUpdater.on('error', e => console.log('[updater]', e.message))
  } catch (e) {
    console.log('[updater] init error:', e.message)
  }
}

ipcMain.handle('update:install', () => _autoUpdater?.quitAndInstall())

app.commandLine.appendSwitch('enable-features', 'SpeechRecognition,SpeechSynthesis')
app.commandLine.appendSwitch('enable-speech-dispatcher')
// Отключаем WebRTC — не нужен, убирает ошибки STUN в консоли
app.commandLine.appendSwitch('disable-features', 'WebRTC-Hw-Decoding,WebRTC-Hw-Encoding')
app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'disable_non_proxied_udp')

// ── OAuth callback server (порт 8765) ──────────────────────────────────
// Открываем браузер → пользователь авторизуется → редирект на localhost:8765
// Мы ловим code и отдаём обратно в renderer через IPC

function waitForOAuthCode() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://localhost:8765')
        if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return }

        const code  = u.searchParams.get('code')
        const error = u.searchParams.get('error')

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html><html><head>
          <style>*{margin:0;padding:0;box-sizing:border-box}
          body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
               height:100vh;background:#0a0e18;color:#e9eef7;flex-direction:column;gap:16px}
          h2{font-size:22px}p{color:#707d96;font-size:14px}
          button{padding:10px 24px;background:#5b8dee;border:none;border-radius:8px;color:#fff;
                 font-size:14px;cursor:pointer;margin-top:8px}</style></head>
          <body>
            <h2>${error ? '✗ Ошибка' : '✓ Авторизация завершена'}</h2>
            <p>${error ? error : 'Возвращайся в Jarvis'}</p>
            <button onclick="window.close()">Закрыть окно</button>
          </body></html>`)

        server.close()
        resolve({ code, error })
      } catch (e) {
        res.writeHead(500); res.end()
        resolve({ error: 'parse-error' })
      }
    })

    server.on('error', () => resolve({ error: 'port-busy' }))
    server.listen(8765, '127.0.0.1')

    // Таймаут 5 минут
    setTimeout(() => { try { server.close() } catch {} ; resolve({ error: 'timeout' }) }, 5 * 60 * 1000)
  })
}

// ── Создание окна ──────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 900, minHeight: 600,
    frame: false, transparent: false, backgroundColor: '#0a0e18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' })
}

// ── IPC: управление окном ──────────────────────────────────────────────
ipcMain.on('window:close',    () => BrowserWindow.getFocusedWindow()?.close())
ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('window:maximize', () => {
  const w = BrowserWindow.getFocusedWindow()
  if (!w) return
  w.isMaximized() ? w.unmaximize() : w.maximize()
})

// ── IPC: OAuth ─────────────────────────────────────────────────────────
ipcMain.handle('oauth:open', (_, url) => shell.openExternal(url))
ipcMain.handle('oauth:listen', () => waitForOAuthCode())

// ── IPC: открыть URL в браузере ────────────────────────────────────────
ipcMain.handle('shell:openUrl', (_, url) => shell.openExternal(url))

// ── Заголовки для браузерного запроса ──────────────────────────────────
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

// ── Поиск через DuckDuckGo (instant API + HTML) ─────────────────────────
ipcMain.handle('web:search', async (_, { query, maxResults = 5 }) => {
  const results = []
  try {
    // 1) DuckDuckGo Instant Answer API — быстрые факты, определения
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
    const apiResp = await fetch(apiUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(6000) })
    const api = await apiResp.json()

    if (api.Answer)
      results.push({ title: 'Быстрый ответ', snippet: api.Answer, url: '' })
    if (api.AbstractText)
      results.push({ title: api.Heading || query, snippet: api.AbstractText, url: api.AbstractURL || '' })
    for (const t of (api.RelatedTopics || []).slice(0, 3)) {
      if (t.Text && results.length < maxResults)
        results.push({ title: t.Text.split(' - ')[0].slice(0, 80), snippet: t.Text, url: t.FirstURL || '' })
    }
  } catch {}

  // 2) DuckDuckGo HTML lite — полноценные результаты поиска
  if (results.length < 3) {
    try {
      const liteUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const liteResp = await fetch(liteUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) })
      const html = await liteResp.text()

      // Парсим результаты из HTML
      const titleRe   = /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g
      const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g

      const titles   = [], urls = [], snippets = []
      let m
      while ((m = titleRe.exec(html))   !== null) { urls.push(m[1]); titles.push(m[2].replace(/<[^>]+>/g,'').trim()) }
      while ((m = snippetRe.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())

      for (let i = 0; i < Math.min(titles.length, snippets.length) && results.length < maxResults; i++) {
        if (titles[i] && snippets[i])
          results.push({ title: titles[i], snippet: snippets[i], url: urls[i] || '' })
      }
    } catch {}
  }

  return { results: results.slice(0, maxResults), query }
})

// ── Загрузить и очистить веб-страницу ──────────────────────────────────
ipcMain.handle('web:fetch', async (_, url) => {
  // Защита от SSRF — только http/https, никаких локальных адресов
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol))
      return { text: '', url, error: 'Недопустимый протокол' }
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
        /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host))
      return { text: '', url, error: 'Локальные адреса не разрешены' }
  } catch {
    return { text: '', url, error: 'Некорректный URL' }
  }
  try {
    const resp = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) })
    const html = await resp.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 4000)
      .trim()
    return { text, url, error: null }
  } catch (e) {
    return { text: '', url, error: e.message }
  }
})

// ── TTS через Windows SAPI (PowerShell) — лучшие голоса ───────────────
ipcMain.handle('tts:getVoices', async () => {
  if (process.platform !== 'win32') return []
  return new Promise(resolve => {
    const ps = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      '$s.GetInstalledVoices() | ForEach-Object {',
      '  $vi = $_.VoiceInfo',
      '  Write-Output "$($vi.Name)|$($vi.Gender)|$($vi.Culture)"',
      '}',
      '$s.Dispose()',
    ].join('\n')
    exec(`powershell -NoProfile -Command -`, { timeout: 8000, input: ps }, (err, stdout) => {
      if (err) { resolve([]); return }
      const voices = stdout.trim().split('\n')
        .map(l => l.trim().split('|'))
        .filter(p => p.length === 3)
        .map(([name, gender, culture]) => ({ name: name.trim(), gender: gender.trim(), culture: culture.trim() }))
      resolve(voices)
    })
  })
})

ipcMain.handle('tts:speak', async (_, { text, voiceName, rate = 0 }) => {
  if (process.platform !== 'win32' || !text?.trim()) return { ok: false }
  // Уникальный суффикс: timestamp + случайные символы — исключает гонку при параллельных вызовах
  const suffix   = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const textFile = path.join(os.tmpdir(), `flow_tts_${suffix}.txt`)
  const wavFile  = path.join(os.tmpdir(), `flow_tts_${suffix}.wav`)
  try {
    fs.writeFileSync(textFile, text.trim(), 'utf8')
    const voiceLine = voiceName
      ? `$s.SelectVoice('${voiceName.replace(/'/g, "''")}')`
      : `$s.SelectVoiceByHints('Female')`
    const ps = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      `$s.SetOutputToWaveFile('${wavFile.replace(/\\/g, '\\\\')}')`,
      voiceLine,
      `$s.Rate = ${Math.round(rate)}`,
      `$t = [System.IO.File]::ReadAllText('${textFile.replace(/\\/g, '\\\\')}', [System.Text.Encoding]::UTF8)`,
      '$s.Speak($t)',
      '$s.Dispose()',
    ].join('\n')
    await new Promise((res, rej) => {
      exec(`powershell -NoProfile -Command -`, { timeout: 15000, input: ps }, (err) => err ? rej(err) : res())
    })
    const audio = fs.readFileSync(wavFile).toString('base64')
    try { fs.unlinkSync(textFile) } catch {}
    try { fs.unlinkSync(wavFile)  } catch {}
    return { ok: true, audio, mimeType: 'audio/wav' }
  } catch (e) {
    try { fs.unlinkSync(textFile) } catch {}
    try { fs.unlinkSync(wavFile)  } catch {}
    return { ok: false, error: e.message }
  }
})

// ── Загрузить RSS/Atom ленту (сырой XML без обработки) ─────────────────
ipcMain.handle('news:fetch', async (_, url) => {
  try {
    const resp = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/rss+xml,application/atom+xml,text/xml,*/*' },
      signal: AbortSignal.timeout(12000),
    })
    const text = await resp.text()
    return { text, url, error: null }
  } catch (e) {
    return { text: '', url, error: e.message }
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ЯНДЕКС: CalDAV (Календарь)
// ═══════════════════════════════════════════════════════════════════════════

ipcMain.handle('yandex:calendar', async (_, { token, login }) => {
  try {
    const now  = new Date()
    const past = new Date(now.getTime() - 86400000)
    const fut  = new Date(now.getTime() + 60 * 86400000)
    const fmt  = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const reportBody = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
      '  <D:prop><D:getetag/><C:calendar-data/></D:prop>',
      '  <C:filter>',
      '    <C:comp-filter name="VCALENDAR">',
      '      <C:comp-filter name="VEVENT">',
      `        <C:time-range start="${fmt(past)}" end="${fmt(fut)}"/>`,
      '      </C:comp-filter>',
      '    </C:comp-filter>',
      '  </C:filter>',
      '</C:calendar-query>',
    ].join('\n')

    // Пробуем несколько возможных URL Яндекс CalDAV
    const urls = login
      ? [`https://caldav.yandex.ru/calendar-home-set/${login}/home/`,
         `https://caldav.yandex.ru/calendar-home-set/${login}/`]
      : ['https://caldav.yandex.ru/']

    let events = [], lastErr = ''

    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method:  'REPORT',
          headers: {
            'Authorization': `OAuth ${token}`,
            'Depth':         '1',
            'Content-Type':  'application/xml; charset=utf-8',
            'Accept':        'application/xml, text/xml, */*',
          },
          body:   reportBody,
          signal: AbortSignal.timeout(14000),
        })

        if (resp.status === 401) return { events: [], error: 'Нет доступа. Проверь права приложения в Яндекс.' }
        if (!resp.ok) { lastErr = `HTTP ${resp.status}`; continue }

        const xml = await resp.text()
        events = calDavParse(xml)
        if (xml.includes('calendar-data') || events.length > 0) break
      } catch (e) { lastErr = e.message }
    }

    return { events, error: events.length === 0 ? lastErr || null : null }
  } catch (e) {
    return { events: [], error: e.message }
  }
})

function calDavParse(xml) {
  const events = []
  const re = /<[A-Za-z0-9-]+:calendar-data[^>]*>([\s\S]*?)<\/[A-Za-z0-9-]+:calendar-data>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const ical = m[1]
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
      .replace(/&#13;/g,'\r').replace(/&#10;/g,'\n').replace(/&#xA;/g,'\n')
    const ev = icalParseEvent(ical)
    if (ev) events.push(ev)
  }
  return events.sort((a, b) => (a.start || '').localeCompare(b.start || ''))
}

function icalParseEvent(ical) {
  const src = ical.replace(/\r?\n[ \t]/g, '') // unfold
  const get = k => { const m = new RegExp(`^${k}[^:]*:(.+)$`, 'im').exec(src); return m ? m[1].trim() : null }
  const summary = get('SUMMARY')
  if (!summary) return null
  const dtstart = get('DTSTART')
  return {
    id:       get('UID') || Math.random().toString(36),
    title:    summary,
    start:    icalDt(dtstart),
    end:      icalDt(get('DTEND') || get('DUE')),
    allDay:   dtstart ? !dtstart.includes('T') : false,
    location: get('LOCATION'),
    desc:     get('DESCRIPTION'),
  }
}

function icalDt(dt) {
  if (!dt) return null
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(dt)
  if (!m) return null
  if (!m[4]) return `${m[1]}-${m[2]}-${m[3]}`
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`
}

// ═══════════════════════════════════════════════════════════════════════════
// ЯНДЕКС: IMAP (Почта)
// ═══════════════════════════════════════════════════════════════════════════

const tlsLib = require('tls')

ipcMain.handle('yandex:mail', (_, { token, email, appPassword }) => {
  return new Promise(resolve => {
    let sock, buf = '', tagN = 0, step = 0
    const fetchLines = []
    let authTag, selTag, srchTag, fetchTag
    const useLogin = !!appPassword // true = LOGIN с паролем приложения, false = XOAUTH2

    const done = r => { clearTimeout(TO); try { sock?.destroy() } catch {}; resolve(r) }
    const TO   = setTimeout(() => done({ messages: [], error: 'Timeout' }), 25000)

    const mkTag = () => `M${++tagN}`
    const send  = s  => { const t = mkTag(); sock.write(`${t} ${s}\r\n`); return t }

    const xo = Buffer.from(`user=${email}\x01auth=Bearer ${token}\x01\x01`).toString('base64')

    const onLine = line => {
      try {
        // step 0: ждём greeting
        if (step === 0 && /^\* OK/i.test(line)) {
          if (useLogin) {
            // Пароль приложения — простой LOGIN
            authTag = send(`LOGIN "${email}" "${appPassword}"`); step = 1
          } else {
            // OAuth XOAUTH2
            authTag = send(`AUTHENTICATE XOAUTH2 ${xo}`); step = 1
          }
          return
        }
        // step 1: авторизация
        if (step === 1) {
          if (line.startsWith(authTag + ' OK')) {
            selTag = send('SELECT INBOX'); step = 2
          } else if (!useLogin && /^\+/.test(line)) {
            sock.write('*\r\n')
            done({ messages: [], error: 'xoauth2_failed' })
          } else if (/ (NO|BAD) /i.test(line)) {
            done({ messages: [], error: useLogin
              ? 'Неверный пароль. Проверь пароль приложения в настройках Яндекс ID'
              : 'xoauth2_failed'
            })
          }
          return
        }
        // step 2: SELECT INBOX
        if (step === 2 && line.startsWith(selTag + ' OK')) {
          srchTag = send('SEARCH NOT DELETED'); step = 3; return
        }
        // step 3: SEARCH
        if (step === 3 && /^\* SEARCH/i.test(line)) {
          const ids = line.replace(/\* SEARCH/i, '').trim().split(/\s+/).filter(Boolean)
          const last = ids.slice(-20).reverse() // последние 20, новые первыми
          if (!last.length) { done({ messages: [] }); return }
          fetchTag = send(`FETCH ${last.join(',')} (UID FLAGS INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])`); step = 4
          return
        }
        // step 4: FETCH
        if (step === 4) {
          if (line.startsWith(fetchTag + ' OK')) { done({ messages: imapParseHeaders(fetchLines) }); return }
          fetchLines.push(line)
        }
      } catch {}
    }

    sock = tlsLib.connect({ host: 'imap.yandex.ru', port: 993 }, () => {})
    sock.on('data', d => {
      buf += d.toString('utf8')
      let i
      while ((i = buf.indexOf('\r\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 2) }
    })
    sock.on('error', e => done({ messages: [], error: e.message }))
  })
})

function imapParseHeaders(lines) {
  const msgs = []
  let cur = null, inH = false
  for (const l of lines) {
    if (/^\* \d+ FETCH/i.test(l)) {
      if (cur && (cur.from || cur.subject)) msgs.push(cur)
      const seqM = l.match(/^\* (\d+) FETCH/i)
      cur = {
        seq:     seqM ? parseInt(seqM[1]) : 0,
        uid:     (l.match(/UID (\d+)/i) || [])[1] || '',
        from:    '',
        subject: '',
        date:    '',
        isoDate: '',
        read:    /\\Seen/i.test(l),
      }
      // INTERNALDATE "DD-Mon-YYYY HH:MM:SS +ZZZZ"
      const idm = l.match(/INTERNALDATE "([^"]+)"/i)
      if (idm) {
        try { cur.isoDate = new Date(idm[1]).toISOString() } catch {}
      }
      inH = true; continue
    }
    if (!cur || !inH) continue
    if (/^[\s)]*$/.test(l)) { inH = false; continue }
    if (/^From:\s*/i.test(l))       cur.from    = mimeDecodeHeader(l.slice(l.indexOf(':') + 1).trim())
    if (/^Subject:\s*/i.test(l))    cur.subject = mimeDecodeHeader(l.slice(l.indexOf(':') + 1).trim())
    if (/^Date:\s*/i.test(l))       cur.date    = l.slice(l.indexOf(':') + 1).trim()
    if (/^Message-ID:\s*/i.test(l)) cur.msgId   = l.slice(l.indexOf(':') + 1).trim()
  }
  if (cur && (cur.from || cur.subject)) msgs.push(cur)
  return msgs
}

function mimeDecodeHeader(s) {
  return s.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, cs, enc, data) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(data, 'base64').toString('utf8')
      return data.replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    } catch { return data }
  })
}


// ═══════════════════════════════════════════════════════════════════════════
// SPEECH-TO-TEXT — whisper.cpp (офлайн, русский язык, скачивается один раз)
// ═══════════════════════════════════════════════════════════════════════════

const https = require('https')

const WHISPER_DIR  = path.join(app.getPath('userData'), 'whisper')
const MODEL_PATH   = path.join(WHISPER_DIR, 'ggml-tiny.bin')
const BINARY_PATH  = path.join(WHISPER_DIR, 'Release', 'whisper-cli.exe')
const MODEL_URL    = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'
const GH_API_URL   = 'https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest'

let whisperDownloading = false

// Скачивает URL, следует за всеми редиректами (http + https), возвращает IncomingMessage
function fetchFollow(url, extraHeaders = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 15) return reject(new Error('Too many redirects'))
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Flow-App/1.0', ...extraHeaders },
      timeout: 30000,
    }, res => {
      const loc = res.headers.location
      if (loc && [301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume() // обязательно — иначе сокет зависает
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href
        return fetchFollow(next, extraHeaders, redirects + 1).then(resolve, reject)
      }
      resolve(res)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

async function fetchJSON(url) {
  const res = await fetchFollow(url, { Accept: 'application/json' })
  return new Promise((resolve, reject) => {
    const chunks = []
    res.on('data', c => chunks.push(c))
    res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())) } catch(e) { reject(e) } })
    res.on('error', reject)
  })
}

async function downloadFile(url, destPath, onProgress) {
  const res = await fetchFollow(url)
  if (res.statusCode !== 200) {
    res.resume()
    throw new Error(`HTTP ${res.statusCode} при загрузке ${url}`)
  }
  return new Promise((resolve, reject) => {
    const total = parseInt(res.headers['content-length'] || '0')
    let received = 0
    const file = fs.createWriteStream(destPath)
    res.on('data', chunk => {
      received += chunk.length
      if (onProgress && total > 0) onProgress(Math.round(received / total * 100))
    })
    res.pipe(file)
    file.on('finish', () => { file.close(); resolve() })
    file.on('error', err => { fs.unlink(destPath, () => {}); reject(err) })
    res.on('error', reject)
  })
}

function findFileRecursive(dir, testFn) {
  try {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name)
      if (f.isDirectory()) { const found = findFileRecursive(full, testFn); if (found) return found }
      else if (testFn(f.name)) return full
    }
  } catch {}
  return null
}

ipcMain.handle('speech:getStatus', () => ({
  ready:       fs.existsSync(BINARY_PATH) && fs.existsSync(MODEL_PATH),
  downloading: whisperDownloading,
}))

ipcMain.handle('speech:setup', async (event) => {
  if (whisperDownloading) return { ok: false, error: 'Уже идёт загрузка' }
  whisperDownloading = true
  const send = (msg) => { try { BrowserWindow.fromWebContents(event.sender)?.webContents.send('speech:progress', msg) } catch {} }

  try {
    fs.mkdirSync(WHISPER_DIR, { recursive: true })

    // 1. Скачать whisper-cli.exe
    if (!fs.existsSync(BINARY_PATH)) {
      send('Получаю информацию о релизе whisper.cpp…')
      const release = await fetchJSON(GH_API_URL)
      const asset = (release.assets || []).find(a => /win/i.test(a.name) && /x64|64/i.test(a.name) && /\.zip$/i.test(a.name))
                 || (release.assets || []).find(a => /win/i.test(a.name) && /\.zip$/i.test(a.name))
      if (!asset) throw new Error('Windows бинарник не найден в релизе GitHub')

      send(`Скачиваю ${asset.name}…`)
      const zipPath = path.join(WHISPER_DIR, 'whisper-win.zip')
      await downloadFile(asset.browser_download_url, zipPath, pct => send(`Бинарник: ${pct}%`))

      send('Распаковываю архив…')
      await new Promise((res, rej) => exec(
        `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${WHISPER_DIR}' -Force"`,
        err => err ? rej(err) : res()
      ))
      fs.unlink(zipPath, () => {})

      // Ищем сначала новый бинарник, потом старый
      const exe = findFileRecursive(WHISPER_DIR, n => /whisper-whisper[-_]cli\.exe$/i.test(n))
               || findFileRecursive(WHISPER_DIR, n => /^whisper[-_]cli\.exe$/i.test(n))
               || findFileRecursive(WHISPER_DIR, n => /^main\.exe$/i.test(n))
      if (!exe) throw new Error('Бинарник whisper не найден в архиве')
      fs.renameSync(exe, BINARY_PATH)
    }

    // 2. Скачать модель
    if (!fs.existsSync(MODEL_PATH)) {
      send('Скачиваю модель ggml-tiny (~75MB)…')
      await downloadFile(MODEL_URL, MODEL_PATH, pct => send(`Модель: ${pct}%`))
    }

    whisperDownloading = false
    send('done')
    return { ok: true }
  } catch (e) {
    whisperDownloading = false
    send(`error:${e.message}`)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('speech:recognize', async (_, pcmBuffer) => {
  if (!fs.existsSync(BINARY_PATH) || !fs.existsSync(MODEL_PATH)) {
    return { ok: false, needSetup: true }
  }
  try {
    const pcm = Buffer.from(pcmBuffer)
    const tmpWav = path.join(os.tmpdir(), `flow_${Date.now()}.wav`)

    // WAV header для 16kHz mono 16-bit PCM
    const hdr = Buffer.alloc(44)
    hdr.write('RIFF', 0);      hdr.writeUInt32LE(36 + pcm.length, 4)
    hdr.write('WAVE', 8);      hdr.write('fmt ', 12)
    hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22)
    hdr.writeUInt32LE(16000, 24); hdr.writeUInt32LE(32000, 28)
    hdr.writeUInt16LE(2, 32);  hdr.writeUInt16LE(16, 34)
    hdr.write('data', 36);     hdr.writeUInt32LE(pcm.length, 40)
    fs.writeFileSync(tmpWav, Buffer.concat([hdr, pcm]))

    const raw = await new Promise((resolve, reject) => {
      exec(`"${BINARY_PATH}" -m "${MODEL_PATH}" -l ru -nt -f "${tmpWav}"`,
        { timeout: 30000, cwd: path.dirname(BINARY_PATH) },
        (err, stdout, stderr) => {
          try { fs.unlinkSync(tmpWav) } catch {}
          if (err && !stdout) return reject(err)
          // stdout содержит текст, stderr — системные сообщения whisper (игнорируем)
          resolve(stdout || '')
        }
      )
    })

    // Убираем timestamps, WARNING строки и прочий мусор
    const text = raw
      .split('\n')
      .filter(l => l.trim() && !/^«?WARNING/i.test(l) && !/^Port of/i.test(l) && !/^whisper_/i.test(l))
      .join(' ')
      .replace(/\[[\d:. \->]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return { ok: true, text }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ЯНДЕКС МУЗЫКА — BrowserView (embed полного сайта)
// ═══════════════════════════════════════════════════════════════════════════

let musicView = null

function getMusicWin(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

ipcMain.handle('music:open', async (event, bounds) => {
  const win = getMusicWin(event)
  if (!win) return { ok: false }

  if (!musicView) {
    musicView = new BrowserView({
      webPreferences: {
        partition:        'persist:yandex-music', // Сохраняет сессию/логин между запусками
        contextIsolation: true,
        nodeIntegration:  false,
      }
    })
    // Заблокируем ненужные редиректы за пределы музыки
    musicView.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
    await musicView.webContents.loadURL('https://music.yandex.ru')
  }

  if (!win.getBrowserViews().includes(musicView)) {
    win.addBrowserView(musicView)
  }

  musicView.setBounds({
    x:      Math.round(bounds.x),
    y:      Math.round(bounds.y),
    width:  Math.max(100, Math.round(bounds.w)),
    height: Math.max(100, Math.round(bounds.h)),
  })

  return { ok: true }
})

ipcMain.handle('music:resize', (_, bounds) => {
  if (!musicView) return
  musicView.setBounds({
    x:      Math.round(bounds.x),
    y:      Math.round(bounds.y),
    width:  Math.max(100, Math.round(bounds.w)),
    height: Math.max(100, Math.round(bounds.h)),
  })
})

ipcMain.handle('music:hide', (event) => {
  if (!musicView) return
  const win = getMusicWin(event)
  if (!win) return
  // НЕ удаляем BrowserView — перемещаем за экран.
  // Если удалить, sendInputEvent (медиа-клавиши) перестаёт работать.
  if (!win.getBrowserViews().includes(musicView)) {
    win.addBrowserView(musicView)
  }
  musicView.setBounds({ x: -9999, y: -9999, width: 1, height: 1 })
})

ipcMain.handle('music:back',    ()       => { if (musicView?.webContents.canGoBack())    musicView.webContents.goBack()    })
ipcMain.handle('music:forward', ()       => { if (musicView?.webContents.canGoForward()) musicView.webContents.goForward() })
ipcMain.handle('music:reload',  ()       => musicView?.webContents.reload())
ipcMain.handle('music:home',    ()       => musicView?.webContents.loadURL('https://music.yandex.ru'))
ipcMain.handle('music:goto',    (_, url) => musicView?.webContents.loadURL(url))

// Получить текущий трек — несколько методов по приоритету
ipcMain.handle('music:getTrack', async () => {
  if (!musicView) return null
  try {
    return await musicView.webContents.executeJavaScript(`
      (() => {
        try {
          // ── 1. Media Session API — самый надёжный (стандарт W3C) ──────────
          // Яндекс Музыка заполняет mediaSession когда играет трек
          const ms = navigator.mediaSession
          if (ms?.metadata?.title) {
            const m = ms.metadata
            // Определяем playing: по playbackState ИЛИ по наличию играющего audio
            const statePlay = ms.playbackState === 'playing'
            const audioPlay = [...document.querySelectorAll('audio')]
              .some(a => !a.paused && a.duration > 0)
            return {
              title:   m.title  || '',
              artist:  m.artist || '',
              cover:   m.artwork?.[0]?.src || null,
              playing: statePlay || audioPlay,
            }
          }

          // ── 2. externalAPI (если доступен) ──────────────────────────────
          if (window.externalAPI) {
            const api = window.externalAPI
            const t   = api.getCurrentTrack?.()
            if (t?.title) {
              return {
                title:   t.title,
                artist:  (t.artists || []).map(a => a.name).join(', '),
                cover:   t.coverUri ? 'https://' + t.coverUri.replace('%%','200x200') : null,
                playing: !!api.getPlaying?.(),
              }
            }
          }

          // ── 3. Заголовок страницы (фолбек) ───────────────────────────────
          // Когда играет трек: "Название — Яндекс Музыка" или "Трек - Артист — Яндекс Музыка"
          const base = /яндекс.?музык/i
          const raw  = document.title.trim()
          if (raw && !base.test(raw.replace(/[^а-яёa-z]/gi,''))) {
            // В заголовке есть что-то кроме "Яндекс Музыка"
            const clean = raw.replace(/\\s*[—–]\\s*Яндекс.?Музыка\\s*$/i, '').trim()
            if (clean && clean !== raw) {
              const parts = clean.split(/\\s*[-–—]\\s*/)
              const audioPlay = [...document.querySelectorAll('audio')]
                .some(a => !a.paused && a.duration > 0)
              return {
                title:   parts.slice(-1)[0]?.trim() || clean,
                artist:  parts.slice(0,-1).join(' — ').trim(),
                cover:   null,
                playing: audioPlay,
              }
            }
          }

          return null
        } catch { return null }
      })()
    `)
  } catch { return null }
})

// Управление воспроизведением — методы строго последовательны, не конфликтуют
ipcMain.handle('music:control', async (_, action) => {
  if (!musicView) return

  const KEY_MAP = {
    toggle: 'MediaPlayPause',
    next:   'MediaNextTrack',
    prev:   'MediaPreviousTrack',
  }
  const keyCode = KEY_MAP[action]
  if (!keyCode) return

  try {
    const { handled, buttons } = await musicView.webContents.executeJavaScript(`
      (() => {
        const action = '${action}'

        // ── 1. externalAPI ───────────────────────────────────────────────
        try {
          if (window.externalAPI) {
            const api = window.externalAPI
            if (action === 'toggle') { api.getPlaying?.() ? api.pause?.() : api.play?.(); return { handled: 'extAPI' } }
            if (action === 'next')   { api.next?.(); return { handled: 'extAPI' } }
            if (action === 'prev')   { api.prev?.(); return { handled: 'extAPI' } }
          }
        } catch {}

        // ── 2. Прямое управление audio-элементом (для toggle) ───────────
        if (action === 'toggle') {
          try {
            const audio = [...document.querySelectorAll('audio')].find(a => a.duration > 0)
            if (audio) {
              if (audio.paused) audio.play().catch(() => {})
              else audio.pause()
              return { handled: 'audio-el' }
            }
          } catch {}
        }

        // ── 3. DOM-клик по кнопкам плеера ───────────────────────────────
        // Реальные aria-label Яндекс Музыки (получены из дампа):
        // prev = "Предыдущая песня", next = "Следующая песня"
        // play = "Воспроизведение" — НО таких кнопок много в списке треков,
        // поэтому берём тот что находится рядом с prev/next в плеер-баре.

        if (action === 'toggle') {
          // Пауза: кнопка уникальная, просто кликаем
          const pauseBtn = document.querySelector('[aria-label="Пауза"],[title="Пауза"],[aria-label="Pause"],[title="Pause"]')
          if (pauseBtn) { pauseBtn.click(); return { handled: 'dom-pause' } }

          // Воспроизведение: ищем рядом с prev/next чтобы не попасть на кнопку трека в списке
          const anchor = document.querySelector(
            '[aria-label="Предыдущая песня"],[aria-label="Следующая песня"],' +
            '[aria-label="Previous track"],[aria-label="Next track"]'
          )
          if (anchor) {
            const p1 = anchor.parentElement
            const p2 = p1?.parentElement
            const playBtn = p1?.querySelector('[aria-label="Воспроизведение"],[aria-label="Play"]')
                         || p2?.querySelector('[aria-label="Воспроизведение"],[aria-label="Play"]')
            if (playBtn) { playBtn.click(); return { handled: 'dom-play' } }
          }
        }

        if (action === 'next') {
          const btn = document.querySelector(
            '[aria-label="Следующая песня"],[aria-label="Следующий трек"],' +
            '[aria-label="Следующий"],[aria-label="Next track"],[aria-label="Next"],' +
            '[title="Следующая песня"],[title="Следующий трек"],[title="Next track"],[title="Next"]'
          )
          if (btn) { btn.click(); return { handled: 'dom-next' } }
        }

        if (action === 'prev') {
          const btn = document.querySelector(
            '[aria-label="Предыдущая песня"],[aria-label="Предыдущий трек"],' +
            '[aria-label="Предыдущий"],[aria-label="Previous track"],[aria-label="Previous"],' +
            '[title="Предыдущая песня"],[title="Предыдущий трек"],[title="Previous track"],[title="Previous"]'
          )
          if (btn) { btn.click(); return { handled: 'dom-prev' } }
        }

        return { handled: false }
      })()
    `).catch(() => ({ handled: false }))

    console.log('[music:control]', action, '->', handled)

    // ── 4. sendInputEvent — если JS не помог ────────────────────────────
    // focus() нужен: клавиша должна идти в webContents BrowserView, не в рендерер
    if (!handled) {
      musicView.webContents.focus()
      musicView.webContents.sendInputEvent({ type: 'keyDown', keyCode })
      setTimeout(() => {
        try { musicView.webContents.sendInputEvent({ type: 'keyUp', keyCode }) } catch {}
      }, 80)
    }

  } catch (e) {
    console.log('[music:control] error:', e.message)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ТРЕКЕР АКТИВНОСТИ
// ═══════════════════════════════════════════════════════════════════════════

// ── PowerShell-скрипт для получения активного окна ─────────────────────────
// Пишем один раз при запуске приложения в temp-папку
const _winScriptPath = path.join(os.tmpdir(), 'flow_win.ps1')
// Вывод в Base64 — обходим проблемы кодировки консоли Windows полностью.
// Base64 — чистый ASCII, Node.js декодирует Buffer.from(b64,'base64').toString('utf8').
fs.writeFileSync(_winScriptPath, [
  'if (-not ([System.Management.Automation.PSTypeName]\'FlowWin32\').Type) {',
  'Add-Type @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'using System.Text;',
  'public class FlowWin32 {',
  '    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
  '    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);',
  '}',
  '"@',
  '}',
  '$h=[FlowWin32]::GetForegroundWindow()',
  '$t=New-Object System.Text.StringBuilder 256',
  '[FlowWin32]::GetWindowText($h,$t,256)|Out-Null',
  '$p=0',
  '[FlowWin32]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null',
  '$proc=Get-Process -Id $p -ErrorAction SilentlyContinue',
  '$raw=if($proc){"$($proc.ProcessName)|||$($t.ToString())"}else{"unknown|||"}',
  '[Console]::WriteLine([System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($raw)))',
].join('\r\n'), 'utf8')

// ── Хранилище и состояние трекера ──────────────────────────────────────────
let _actTimer   = null
let _actSession = null  // { appName, windowTitle, startTs }
let _SQL        = null  // кешированный экземпляр sql.js

function activityFile(date) {
  return path.join(app.getPath('userData'), `flow_activity_${date}.json`)
}

function loadDayLog(date) {
  try { return JSON.parse(fs.readFileSync(activityFile(date), 'utf8')) } catch { return [] }
}

function flushSession() {
  if (!_actSession) return
  const dur = Date.now() - new Date(_actSession.startTs).getTime()
  if (dur < 4000) { _actSession = null; return }
  const date = _actSession.startTs.slice(0, 10)
  const log  = loadDayLog(date)
  log.push({ ..._actSession, endTs: new Date().toISOString(), durationMs: dur })
  try { fs.writeFileSync(activityFile(date), JSON.stringify(log)) } catch {}
  _actSession = null
}

function pollActiveWindow() {
  exec(
    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${_winScriptPath}"`,
    { encoding: 'buffer', timeout: 8000 },
    (err, stdout) => {
      if (err || !stdout?.length) return
      let line = stdout.toString('ascii').trim()
      // Декодируем Base64 → UTF-8
      try { line = Buffer.from(line, 'base64').toString('utf8') } catch { return }
      const sep = line.indexOf('|||')
      if (sep < 0) return
      const appName     = line.slice(0, sep).trim()
      const windowTitle = line.slice(sep + 3).trim()
      const now = new Date().toISOString()

      if (!_actSession || _actSession.appName !== appName || _actSession.windowTitle !== windowTitle) {
        flushSession()
        _actSession = { appName, windowTitle, startTs: now }
      }
    }
  )
}

async function getSql() {
  if (!_SQL) {
    const initSqlJs = require('sql.js')
    _SQL = await initSqlJs()
  }
  return _SQL
}

// ── IPC обработчики активности ──────────────────────────────────────────────

ipcMain.handle('activity:start', () => {
  if (_actTimer) return { ok: true }
  _actTimer = setInterval(pollActiveWindow, 10_000)
  pollActiveWindow()
  return { ok: true }
})

ipcMain.handle('activity:stop', () => {
  if (_actTimer) { clearInterval(_actTimer); _actTimer = null }
  flushSession()
  return { ok: true }
})

ipcMain.handle('activity:getLog', (_, date) => {
  return loadDayLog(date || new Date().toISOString().slice(0, 10))
})

ipcMain.handle('activity:getBrowserHistory', async (_, limit = 150) => {
  const profiles = []
  const lappdata = process.env.LOCALAPPDATA || ''
  const appdata  = process.env.APPDATA || ''

  const chromePath  = path.join(lappdata, 'Google', 'Chrome', 'User Data', 'Default', 'History')
  const edgePath    = path.join(lappdata, 'Microsoft', 'Edge', 'User Data', 'Default', 'History')
  const firefoxBase = path.join(appdata, 'Mozilla', 'Firefox', 'Profiles')

  if (fs.existsSync(chromePath)) profiles.push({ browser: 'Chrome', file: chromePath })
  if (fs.existsSync(edgePath))   profiles.push({ browser: 'Edge',   file: edgePath })

  // Firefox: найти default-* профиль
  try {
    const dirs = fs.readdirSync(firefoxBase)
    const def  = dirs.find(d => d.includes('.default'))
    if (def) {
      const fp = path.join(firefoxBase, def, 'places.sqlite')
      if (fs.existsSync(fp)) profiles.push({ browser: 'Firefox', file: fp, isFirefox: true })
    }
  } catch {}

  if (!profiles.length) return []

  const results = []
  const SQL = await getSql()

  for (const p of profiles) {
    const tmp = path.join(os.tmpdir(), `flow_hist_${Date.now()}.db`)
    try {
      fs.copyFileSync(p.file, tmp)
      const buf = fs.readFileSync(tmp)
      const db  = new SQL.Database(buf)

      if (p.isFirefox) {
        // Firefox places.sqlite
        const rows = db.exec(`SELECT url, title, last_visit_date FROM moz_places WHERE last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT ${limit}`)
        if (rows[0]) {
          rows[0].values.forEach(([url, title, ts]) => {
            const ms = Math.round(ts / 1000)
            results.push({ browser: 'Firefox', url: url||'', title: title||'', visitedAt: new Date(ms).toISOString() })
          })
        }
      } else {
        // Chrome / Edge
        const rows = db.exec(`SELECT url, title, last_visit_time FROM urls WHERE url NOT LIKE 'chrome://%' AND url NOT LIKE 'data:%' ORDER BY last_visit_time DESC LIMIT ${limit}`)
        if (rows[0]) {
          rows[0].values.forEach(([url, title, ts]) => {
            const ms = Math.round(ts / 1000) - 11644473600000
            if (ms > 0) results.push({ browser: p.browser, url: url||'', title: title||'', visitedAt: new Date(ms).toISOString() })
          })
        }
      }
      db.close()
    } catch (e) {
      console.log('[activity:getBrowserHistory] error:', p.browser, e.message)
    } finally {
      try { fs.unlinkSync(tmp) } catch {}
    }
  }

  return results.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, limit)
})

// Путь к скрипту недавних файлов (пишется один раз при запуске)
const _recentScriptPath = path.join(os.tmpdir(), 'flow_recent.ps1')
fs.writeFileSync(_recentScriptPath, [
  '$shell = New-Object -ComObject WScript.Shell',
  '$recent = [System.Environment]::GetFolderPath("Recent")',
  'Get-ChildItem $recent -Filter *.lnk -ErrorAction SilentlyContinue |',
  '  Sort-Object LastWriteTime -Descending |',
  '  Select-Object -First 40 |',
  '  ForEach-Object {',
  '    try {',
  '      $lnk = $shell.CreateShortcut($_.FullName)',
  '      if ($lnk.TargetPath) {',
  "        $raw = \"$($_.LastWriteTime.ToString('o'))|||$($lnk.TargetPath)\"",
  '        [Console]::WriteLine([System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($raw)))',
  '      }',
  '    } catch {}',
  '  }',
].join('\r\n'), 'utf8')

ipcMain.handle('activity:getRecentFiles', () => new Promise(resolve => {
  exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${_recentScriptPath}"`,
    { encoding: 'buffer', timeout: 10000 },
    (err, stdout) => {
      if (err) { console.log('[activity:getRecentFiles] error:', err.message); return resolve([]) }
      const files = stdout.toString('ascii').trim().split('\n')
        .filter(Boolean)
        .map(b64 => {
          try {
            const line = Buffer.from(b64.trim(), 'base64').toString('utf8')
            const idx  = line.indexOf('|||')
            if (idx < 0) return null
            return { modifiedAt: line.slice(0, idx).trim(), path: line.slice(idx + 3).trim() }
          } catch { return null }
        })
        .filter(f => f && f.path && f.path.length > 1)
      resolve(files)
    })
}))

// ── Сброс при закрытии ──────────────────────────────────────────────────────
app.on('before-quit', () => {
  tgStop()
  if (_actTimer) { clearInterval(_actTimer); _actTimer = null }
  flushSession()
})

// ═══════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT
// ═══════════════════════════════════════════════════════════════════════════

const TG_SETTINGS_FILE = path.join(app.getPath('userData'), 'telegram_settings.json')

function tgLoad() {
  try { return JSON.parse(fs.readFileSync(TG_SETTINGS_FILE, 'utf8')) } catch { return {} }
}

function tgSave(data) {
  try { fs.writeFileSync(TG_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8') } catch {}
}

// Читает ключ из localStorage renderer-процесса
async function readStore(key) {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed() || win.webContents.isLoading()) return null
  try {
    const raw = await win.webContents.executeJavaScript(
      `localStorage.getItem(${JSON.stringify('flow__' + key)})`
    )
    return raw !== null ? JSON.parse(raw) : null
  } catch { return null }
}

// Пишет в localStorage и уведомляет renderer обновить состояние
async function writeStore(key, value) {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return false
  try {
    await win.webContents.executeJavaScript(
      `localStorage.setItem(${JSON.stringify('flow__' + key)}, ${JSON.stringify(JSON.stringify(value))})`
    )
    win.webContents.send('store:refresh', key)
    return true
  } catch { return false }
}

// Telegram Bot API через https + ProxyAgent (проксирует через VPN на 10809)
const { HttpsProxyAgent } = require('https-proxy-agent')

function _tgAgent() {
  const { proxyUrl } = tgLoad()
  return new HttpsProxyAgent(proxyUrl || 'http://127.0.0.1:10809')
}

function tgApi(token, method, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params)
    const req  = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${token}/${method}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      agent:    _tgAgent(),
      timeout:  12000,
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
    })
    req.on('error',   reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

async function tgSend(token, chatId, text) {
  if (!token || !chatId || !text) return
  try {
    await tgApi(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' })
  } catch (e) {
    console.log('[tg:send]', e.message)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// УМНЫЙ ПАРСЕР — определяет категорию по любому тексту
// Без \b для кириллицы (в JS кириллица = \W, word boundary не работает)
// ══════════════════════════════════════════════════════════════════════════════

function _tagEmoji(tag) {
  const map = { 'Учёба':'📚','Работа':'💼','Здоровье':'💪','Финансы':'💰','Личное':'🏠','Проект':'🎯' }
  return map[tag] || '📌'
}

function _budgetCategory(lower) {
  if (/еда|кафе|ресторан|кофе|обед|ужин|завтрак|продукт|пицца|доставк|суши|фастфуд|хлеб|молок|пельмен|шаурм|бургер|роллы/.test(lower)) return 'Еда'
  if (/такси|метро|автобус|транспорт|бензин|парковк|uber|каршер|электричк|самокат|проезд|маршрутк/.test(lower)) return 'Транспорт'
  if (/кино|игры|развлечен|подписк|netflix|spotify|стриминг|концерт|театр|кальян|боулинг/.test(lower)) return 'Развлечения'
  if (/врач|аптек|здоровь|лекарств|анализ|клиник|стоматол|больниц|таблетк|процедур/.test(lower)) return 'Здоровье'
  if (/одежд|обувь|шопинг|штаны|куртка|пальто|футболк|носк|джинс/.test(lower)) return 'Одежда'
  if (/зарплат|фриланс|доход|заработ|гонорар|выплат|аванс|премия|перевод/.test(lower)) return 'Доходы'
  if (/связь|интернет|мобильн|телефон|оператор/.test(lower)) return 'Связь'
  if (/аренд|квартир|комуналк|жкх|электричеств/.test(lower)) return 'Жильё'
  if (/кредит|ипотек|долг|займ/.test(lower)) return 'Кредиты'
  if (/курс|книг|образован|обучени/.test(lower)) return 'Образование'
  return 'Прочее'
}

function _taskTag(lower) {
  if (/изучи|выучи|прочитать|разобраться|туториал|лекц|учёба|учиться|пройти курс|книга по/.test(lower)) return 'Учёба'
  if (/работ|проект|написать|отправить|подготовить|отчёт|презентаци|митинг|созвон|деплой|код/.test(lower)) return 'Работа'
  if (/зал|тренировк|врач|таблетк|здоровь|диета|бегать|спорт|упражнен|пробежк|питани|калори/.test(lower)) return 'Здоровье'
  if (/купить(?! курс| книг| урок)|оплатить|счёт|финанс|банк/.test(lower)) return 'Финансы'
  return 'Личное'
}

function _pad2(n) { return String(n).padStart(2,'0') }

// ── Парсинг даты (все форматы) ───────────────────────────────────────────────

function _parseDate(text) {
  const lower = text.toLowerCase()
  const now   = new Date()
  const fmt   = d => `${d.getFullYear()}-${_pad2(d.getMonth()+1)}-${_pad2(d.getDate())}`
  const shift = days => { const d=new Date(now); d.setDate(d.getDate()+days); return d }

  if (/сегодня/.test(lower))     return fmt(now)
  if (/послезавтра/.test(lower)) return fmt(shift(2))
  if (/завтра/.test(lower))      return fmt(shift(1))

  let m
  m = lower.match(/через\s+(\d+)\s+дн[еёяий]/)
  if (m) return fmt(shift(+m[1]))
  m = lower.match(/через\s+(\d+)\s+недел[иью]/)
  if (m) return fmt(shift(+m[1]*7))
  m = lower.match(/через\s+(\d+)\s+месяц[ае]?/)
  if (m) { const d=new Date(now); d.setMonth(d.getMonth()+parseInt(m[1])); return fmt(d) }
  if (/через\s+неделю/.test(lower))  return fmt(shift(7))
  if (/через\s+месяц/.test(lower))   { const d=new Date(now); d.setMonth(d.getMonth()+1); return fmt(d) }
  if (/следующ[уюий]+\s+недел|на\s+следующей\s+неделе/.test(lower)) return fmt(shift(7))

  const isNext = /следующ[уюий]/.test(lower)
  const dowMap = [['воскресень',0],['понедельник',1],['вторник',2],['среду',3],['среда',3],['четверг',4],['пятниц',5],['суббот',6]]
  for (const [name,dow] of dowMap) {
    if (lower.includes(name)) {
      let diff = (dow - now.getDay() + 7) % 7 || 7
      if (isNext) diff += 7
      return fmt(shift(diff))
    }
  }

  // числовой формат: 04.07 | 4.07.25 | 04/07
  const numDate = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/)
  if (numDate) {
    const dy=parseInt(numDate[1]), mo=parseInt(numDate[2])-1
    let yr = numDate[3] ? parseInt(numDate[3]) : now.getFullYear()
    if (yr<100) yr+=2000
    if (mo>=0&&mo<=11&&dy>=1&&dy<=31) {
      const d=new Date(yr,mo,dy)
      if (d<now&&!numDate[3]) d.setFullYear(d.getFullYear()+1)
      return fmt(d)
    }
  }

  // ДД месяц [YYYY]: "4 июля", "4-го июля"
  const months = [['январ',0],['феврал',1],['март',2],['апрел',3],['мая',4],['май',4],['июн',5],['июл',6],['август',7],['сентябр',8],['октябр',9],['ноябр',10],['декабр',11]]
  const ruDate = lower.match(/(\d{1,2})(?:-?го)?\s+([а-яё]+)(?:\s+(\d{4}))?/)
  if (ruDate) {
    const me = months.find(([k]) => ruDate[2].startsWith(k))
    if (me) {
      const yr = ruDate[3] ? parseInt(ruDate[3]) : now.getFullYear()
      const d  = new Date(yr, me[1], parseInt(ruDate[1]))
      if (d<now&&!ruDate[3]) d.setFullYear(d.getFullYear()+1)
      return fmt(d)
    }
  }
  return null
}

// ── Парсинг времени ──────────────────────────────────────────────────────────

function _parseTime(text) {
  const lower = text.toLowerCase()
  if (/полдень/.test(lower))  return '12:00'
  if (/полночь/.test(lower))  return '00:00'

  const m1 = text.match(/\b(\d{1,2}):(\d{2})\b/)
  if (m1) { const h=+m1[1],mn=+m1[2]; if(h<=23&&mn<=59) return `${_pad2(h)}:${_pad2(mn)}` }

  // "в 9 утра", "в 15 часов", "в 3 дня", "в 7 вечера"
  const m2 = lower.match(/в\s+(\d{1,2})(?:\s+(?:час[ао]в?|ч))?\s*(утра|дня|вечера|ночи)?(?=\s|$)/)
  if (m2) {
    let h=parseInt(m2[1]); const p=m2[2]||''
    if (p==='вечера'&&h<12)          h+=12
    else if (p==='ночи'&&h>=6&&h<12) h+=12
    else if (p==='дня'&&h<12&&h>=1)  h+=12
    if (h<=23) return `${_pad2(h)}:00`
  }

  // слова-подсказки
  if (/утром/.test(lower)   && !/(?:вчера|сегодня)\s+утром/.test(lower))   return '09:00'
  if (/днём|днем/.test(lower))                                               return '13:00'
  if (/вечером/.test(lower) && !/(?:вчера|сегодня)\s+вечером/.test(lower)) return '19:00'
  if (/ночью/.test(lower))                                                   return '22:00'
  return null
}

// ── Определители категории ────────────────────────────────────────────────────

function _isBudget(t, lower) {
  // число + ₽/руб
  if (/\d+\s*₽/.test(t)) return true
  if (/\d+\s*руб/.test(lower)) return true
  if (/руб\w*\s*\d+/.test(lower)) return true  // "руб 150"
  // "потратил 500", "стоит 300", "заплатил 200"
  if (/(?:потратил[а]?|стоит|стоил[а]?|обошлось|заплатил[а]?|оплатил[а]?)\s+\d/.test(lower)) return true
  return false
}

function _isCalendar(t, lower) {
  const hasTime = _parseTime(t) !== null
  const hasDate = _parseDate(t) !== null
  // ключевые слова событий (без \b — кириллица \W)
  const eventWords = /запись|записался|записалась|встреча|встречу|встретиться|созвон|созвониться|звонок|митинг|собрание|мероприятие|событие|визит|приём|прием|конференция|вечеринк|концерт|спектакль|экзамен|зачёт|зачет|защита|дедлайн|поездка|рейс|вылет|прилёт|прилет|день рожден|праздник|юбилей|свидание|интервью|собеседование|напомни/i
  const hasEvt = eventWords.test(lower)
  if (hasEvt && (hasDate || hasTime)) return true
  if (hasTime && hasDate)             return true
  return false
}

function _isDiary(t, lower) {
  // "сегодня я..." или "вчера я..."
  if (/^(?:сегодня|вчера)\s+я\s/i.test(t)) return true
  if (/^(?:сегодня|вчера)\s+я$/i.test(t))  return true
  // "сегодня был/ходил/гулял..."
  if (/^сегодня\s+(?:был[аи]?|ходил[а]?|гулял[а]?|посетил[а]?|поел[а]?|провел[а]?|занимался|занималась)/i.test(t)) return true
  // личные глаголы прошедшего времени: " я погулял", "я сходил" и тд
  if (/(?:^|\s)я\s+(?:погулял|погуляла|сходил|сходила|посетил|посетила|побывал|побывала|провел|провела|встретил|встретила|поговорил|поговорила|поел|поела|выспался|выспалась|отдохнул|отдохнула|поработал|поработала|почитал|почитала|посмотрел|посмотрела|написал|написала|сделал|сделала|поиграл|поиграла|потренировался|потренировалась|пробежал|пробежала|поплавал|поплавала|съездил|съездила|побегал|побегала)/i.test(lower)) return true
  // эмоциональные / рефлексивные фразы
  if (/настроение сегодня|чувствую себя|чувствовал|был[а]?\s+продуктивн|хороший день|плохой день|сложный день|тяжёлый день|тяжелый день|неплохой день|день прошёл|день прошел|было здорово|было классно|было грустно|было скучно|скучал|грустил|радовался|радовалась|нервничал/.test(lower)) return true
  return false
}

function _isNote(t) {
  return /^(?:идея|заметка|мысль|запиши|записать|нужно запомнить|важно|заметь)[:\s]/i.test(t)
}

// ── Очистка заголовка события ────────────────────────────────────────────────

function _calTitle(t) {
  return t
    .replace(/\b\d{1,2}:\d{2}\b/g,'')
    .replace(/в\s+\d{1,2}\s*(?:час[ао]в?|ч)?\s*(?:утра|дня|вечера|ночи)?/gi,'')
    .replace(/полдень|полночь/gi,'')
    .replace(/\d{1,2}(?:-?го)?\s+(?:январ[яе]?|феврал[яе]?|март[ае]?|апрел[яе]?|мая?|июн[яе]?|июл[яе]?|август[ае]?|сентябр[яе]?|октябр[яе]?|ноябр[яе]?|декабр[яе]?)(?:\s+\d{4})?/gi,'')
    .replace(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g,'')
    .replace(/сегодня|завтра|послезавтра|через\s+\S+(?:\s+\S+)?/gi,'')
    .replace(/(?:в\s+)?(?:следующ[уюий]+\s+)?(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/gi,'')
    .replace(/утром|вечером|днём|днем|ночью/gi,'')
    .replace(/\s+/g,' ').trim() || t.trim()
}

// ── LLM-классификатор (Groq, бесплатный) ─────────────────────────────────────
// Понимает свободный текст без ключевых слов. При отсутствии ключа/ошибке
// падаем обратно на классификацию по правилам (_smartParseRules).

const _GROQ_MODEL     = 'llama-3.1-8b-instant'
const _CLASSIFY_TYPES = ['task', 'budget', 'calendar', 'diary', 'note']

// Groq стоит за Cloudflare, который блокирует TLS-отпечаток Node.js (и https,
// и встроенный fetch получают 403 Forbidden), а curl проходит без проблем —
// поэтому запрос делаем через дочерний процесс curl.exe (без участия shell,
// тело передаётся через stdin — инъекция исключена). При наличии VPN-прокси
// (как и для Telegram) пробрасываем через него же.
const { spawn: _spawn } = require('child_process')

function _groqRequest(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body)
    const proxy   = tgLoad().proxyUrl
    const args    = ['-s', '-X', 'POST', 'https://api.groq.com/openai/v1/chat/completions',
      '-H', 'Content-Type: application/json',
      '-H', `Authorization: Bearer ${apiKey}`,
      '--max-time', '20',
      '--data-binary', '@-']
    if (proxy) args.push('--proxy', proxy)
    const p = _spawn('curl', args)
    let out = '', err = ''
    p.stdout.on('data', c => out += c)
    p.stderr.on('data', c => err += c)
    p.on('error', reject)
    p.on('close', code => {
      if (code !== 0) return reject(new Error(err.trim() || `curl exit ${code}`))
      try { resolve(JSON.parse(out)) } catch (e) { reject(e) }
    })
    p.stdin.write(data)
    p.stdin.end()
  })
}

function _classifyPrompt(text) {
  return `Ты — классификатор сообщений для личного планировщика «Flow». Определи категорию сообщения пользователя (на русском языке) и извлеки данные. Отвечай СТРОГО одним JSON-объектом, без markdown и пояснений.

Категории и формат ответа:
• task — дело/действие, которое нужно сделать:
  {"type":"task","text":"переформулированный текст задачи кратко","tag":"Учёба|Работа|Здоровье|Финансы|Личное|Проект","priority":"low|medium|high"}
• budget — трата или поступление денег (в сообщении есть конкретная сумма):
  {"type":"budget","amount":число,"isIncome":true|false,"category":"Еда|Транспорт|Развлечения|Здоровье|Одежда|Доходы|Связь|Жильё|Кредиты|Образование|Прочее","note":"краткое описание операции"}
• calendar — запланированное событие/встреча/визит/звонок на конкретную дату или время:
  {"type":"calendar","title":"короткое название события без даты и времени"}
• diary — личная запись о прожитом дне, впечатления, эмоции, рефлексия о себе:
  {"type":"diary"}
• note — идея, мысль, что-то на заметку для памяти (не дело и не дневник):
  {"type":"note","title":"короткий заголовок","tag":"Идея|Работа|Учёба|Личное"}

Правила выбора при неоднозначности:
- Названа конкретная сумма денег ("150 рублей", "потратил 500", "получил зарплату") → budget.
- Упомянута встреча/визит/созвон/мероприятие с датой или временем → calendar.
- Рассказ о прошедшем/проживаемом дне, своих действиях или чувствах в прошедшем времени → diary.
- Короткая мысль/идея «на подумать» → note.
- Во всех остальных случаях, если это что-то, что нужно сделать → task.

Сообщение пользователя:
"${text}"

Ответ — только JSON одной строкой, без пояснений и markdown.`
}

async function _classifyLLM(text) {
  const apiKey = tgLoad().groqApiKey
  if (!apiKey) return null
  try {
    const res = await _groqRequest(apiKey, {
      model: _GROQ_MODEL,
      messages: [{ role: 'user', content: _classifyPrompt(text) }],
      temperature: 0,
      max_tokens: 250,
      response_format: { type: 'json_object' },
    })
    const content = res?.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    if (!_CLASSIFY_TYPES.includes(parsed.type)) return null
    return parsed
  } catch (e) {
    console.log('[llm:classify]', e.message)
    return null
  }
}

// ── Основная функция: сначала LLM, при неудаче — классификация по правилам ───

async function _smartParse(text) {
  const t     = text.trim()
  const lower = t.toLowerCase()
  const today = _todayKey()
  const now   = new Date()
  const llm   = await _classifyLLM(t)

  if (llm?.type === 'calendar') {
    const date  = _parseDate(t) || today
    const time  = _parseTime(t) || ''
    const title = (llm.title || _calTitle(t)).trim() || t
    return {
      type: 'calendar',
      data: { id:`tg_${Date.now()}`, title, date, time, endTime:'', color:'#5b8dee', allDay:!time, desc:'', location:'', repeat:'none', repeatEnd:'' },
      reply: `📅 <b>Событие добавлено</b>\n«${title}»\n📆 ${date}${time?' в '+time:''}`,
    }
  }
  if (llm?.type === 'budget') {
    const numMatch = t.match(/\d[\d\s,.]*/)
    const amount   = typeof llm.amount === 'number' && llm.amount > 0
      ? llm.amount
      : (numMatch ? parseFloat(numMatch[0].replace(/\s/g,'').replace(',','.')) : 0)
    const isIncome = !!llm.isIncome
    const category = llm.category || _budgetCategory(lower)
    const note     = llm.note || t
    return {
      type: 'budget',
      data: { id:`tg_${Date.now()}`, type:isIncome?'income':'expense', amount, category, note, date:today, month:today.slice(0,7), created:now.toISOString() },
      reply: `💰 <b>${isIncome?'Доход':'Расход'} ${amount.toLocaleString('ru')} ₽</b>\nКатегория: ${category}${note&&note!==t?'\nЗаметка: '+note:''}`,
    }
  }
  if (llm?.type === 'diary') {
    return {
      type: 'diary',
      data: { id:`tg_${Date.now()}`, date:today, body:t, mood:null, created:now.toISOString(), updated:now.toISOString() },
      reply: `📖 <b>Запись в дневник</b>\n«${t.slice(0,100)}${t.length>100?'…':''}»`,
    }
  }
  if (llm?.type === 'note') {
    const title = (llm.title || t.split('\n')[0]).slice(0, 60) || 'Без заголовка'
    const tag   = llm.tag || 'Личное'
    return {
      type: 'note',
      data: { id:`tg_${Date.now()}`, title, body:t, color:'#1e2433', tag, pinned:false, created:now.toISOString(), updated:now.toISOString() },
      reply: `📝 <b>Заметка сохранена</b>\n«${title}»`,
    }
  }
  if (llm?.type === 'task') {
    const cleanText = llm.text || t
    const tag       = llm.tag || _taskTag(lower)
    const priority  = llm.priority || (/срочно|важно|критично|asap|горит|немедленно/.test(lower) ? 'high' : 'medium')
    const taskDate  = _parseDate(t) || today
    return {
      type: 'task',
      data: { id:`tg_${Date.now()}`, text:cleanText, tag, priority, date:taskDate, done:false, created:now.toISOString(), subtasks:[] },
      reply: `${_tagEmoji(tag)} <b>Задача [${tag}]</b> добавлена:\n«${cleanText}»`,
    }
  }

  // LLM недоступен или вернул некорректный результат — классификация по правилам
  return _smartParseRules(t, lower, today, now)
}

// ── Классификация по правилам (фолбэк, если LLM недоступен) ──────────────────

function _smartParseRules(t, lower, today, now) {
  // ── 1. Календарь ──────────────────────────────────────────────────────────
  if (_isCalendar(t, lower)) {
    const date  = _parseDate(t) || today
    const time  = _parseTime(t) || ''
    const title = _calTitle(t)
    return {
      type: 'calendar',
      data: { id:`tg_${Date.now()}`, title, date, time, endTime:'', color:'#5b8dee', allDay:!time, desc:'', location:'', repeat:'none', repeatEnd:'' },
      reply: `📅 <b>Событие добавлено</b>\n«${title}»\n📆 ${date}${time?' в '+time:''}`,
    }
  }

  // ── 2. Бюджет ─────────────────────────────────────────────────────────────
  if (_isBudget(t, lower)) {
    const mM = t.match(/(\d[\d\s,.]*)\s*₽/)
            || lower.match(/(\d[\d\s,.]*)\s*руб/)
            || lower.match(/(?:потратил[а]?|стоит|заплатил[а]?|оплатил[а]?)\s+(\d[\d\s,.]*)/)
    const amount   = mM ? parseFloat(mM[1].replace(/\s/g,'').replace(',','.')) : 0
    const isIncome = /получил[а]?|зарплат|доход|заработал[а]?|выплат|пришло|перевод|аванс|премия|гонорар/.test(lower)
    const note     = t.replace(/\d[\d\s,.]*\s*(?:₽|руб[а-яё]*)/gi,'').replace(/^\s*[-—:,]\s*/,'').trim() || t
    const category = _budgetCategory(lower)
    return {
      type: 'budget',
      data: { id:`tg_${Date.now()}`, type:isIncome?'income':'expense', amount, category, note, date:today, month:today.slice(0,7), created:now.toISOString() },
      reply: `💰 <b>${isIncome?'Доход':'Расход'} ${amount.toLocaleString('ru')} ₽</b>\nКатегория: ${category}${note&&note!==t?'\nЗаметка: '+note:''}`,
    }
  }

  // ── 3. Дневник ────────────────────────────────────────────────────────────
  if (_isDiary(t, lower)) {
    return {
      type: 'diary',
      data: { id:`tg_${Date.now()}`, date:today, body:t, mood:null, created:now.toISOString(), updated:now.toISOString() },
      reply: `📖 <b>Запись в дневник</b>\n«${t.slice(0,100)}${t.length>100?'…':''}»`,
    }
  }

  // ── 4. Заметка ────────────────────────────────────────────────────────────
  if (_isNote(t)) {
    const body  = t.replace(/^(?:идея|заметка|мысль|запиши|записать|нужно запомнить|важно|заметь)[:\s]*/i,'').trim()
    const title = body.split('\n')[0].slice(0,60) || 'Без заголовка'
    const tag   = /идея/i.test(t)?'Идея':/работ/.test(lower)?'Работа':/учёб|учи/.test(lower)?'Учёба':'Личное'
    return {
      type: 'note',
      data: { id:`tg_${Date.now()}`, title, body, color:'#1e2433', tag, pinned:false, created:now.toISOString(), updated:now.toISOString() },
      reply: `📝 <b>Заметка сохранена</b>\n«${title}»`,
    }
  }

  // ── 5. Задача ─────────────────────────────────────────────────────────────
  const tag      = _taskTag(lower)
  const priority = /срочно|важно|критично|asap|горит|немедленно/.test(lower) ? 'high' : 'medium'
  const taskDate = _parseDate(t) || today
  const cleanText = t
    .replace(/^(?:нужно|надо|необходимо|не забыть|хочу|планирую)\s+/i,'')
    .replace(/^(?:изучить?|прочитать?|посмотреть?|сделать?|добавить?|напомнить?|купить?|написать?|отправить?|позвонить?)\s+/i,'')
    .replace(/\s+(?:срочно|важно|сегодня)$/i,'').trim() || t
  return {
    type: 'task',
    data: { id:`tg_${Date.now()}`, text:cleanText, tag, priority, date:taskDate, done:false, created:now.toISOString(), subtasks:[] },
    reply: `${_tagEmoji(tag)} <b>Задача [${tag}]</b> добавлена:\n«${cleanText}»`,
  }
}

// ── Форматтеры данных ───────────────────────────────────────────────────────

function _todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function fmtTasks() {
  const tasks   = await readStore('tasks') || []
  const today   = _todayKey()
  const overdue = tasks.filter(t => !t.done && t.date && t.date < today)
  const todayT  = tasks.filter(t => !t.done && t.date === today)
  const noDate  = tasks.filter(t => !t.done && !t.date)

  if (!overdue.length && !todayT.length && !noDate.length)
    return '✅ Все задачи выполнены!'

  const lines = ['📋 <b>Задачи</b>']

  if (overdue.length) {
    lines.push(`\n🔴 <b>Просрочено (${overdue.length}):</b>`)
    overdue.slice(0, 5).forEach(t => lines.push(`  • ${t.text}  <i>${t.date}</i>`))
    if (overdue.length > 5) lines.push(`  …ещё ${overdue.length - 5}`)
  }
  if (todayT.length) {
    lines.push(`\n📅 <b>Сегодня (${todayT.length}):</b>`)
    todayT.slice(0, 8).forEach(t => lines.push(`  • ${t.text}`))
    if (todayT.length > 8) lines.push(`  …ещё ${todayT.length - 8}`)
  }
  if (noDate.length) {
    lines.push(`\n📌 <b>Без даты (${noDate.length}):</b>`)
    noDate.slice(0, 5).forEach(t => lines.push(`  • ${t.text}`))
    if (noDate.length > 5) lines.push(`  …ещё ${noDate.length - 5}`)
  }

  return lines.join('\n')
}

async function fmtHabits() {
  const habits = await readStore('habits_v2') || []
  const today  = _todayKey()
  if (!habits.length) return '🔁 <b>Привычки</b>\n\nНет активных привычек.'

  let done = 0
  const rows = habits.map(h => {
    const ok = (h.log || []).includes(today)
    if (ok) done++
    return `${ok ? '✅' : '⬜'} ${h.icon || ''} ${h.name}`.trim()
  })
  return ['🔁 <b>Привычки сегодня</b>', ...rows, `\n${done}/${habits.length} выполнено`].join('\n')
}

async function fmtFocus() {
  const stats   = await readStore('focus_stats')   || {}
  const history = await readStore('focus_history') || {}
  const d       = history[_todayKey()] || { sessions: 0, minutes: 0 }
  const totalH  = Math.round((stats.totalMinutes || 0) / 60 * 10) / 10
  return [
    '⏱ <b>Фокус</b>',
    `📅 Сегодня: ${d.sessions} сессий, ${d.minutes} мин`,
    `📊 Всего:   ${stats.sessions || 0} сессий, ${totalH} ч`,
  ].join('\n')
}

async function fmtBudget() {
  const txns  = await readStore('budget_txns') || []
  const month = new Date().toISOString().slice(0, 7)
  const mt    = txns.filter(t => t.month === month)
  const income  = mt.filter(t => t.type === 'income') .reduce((s, t) => s + (t.amount || 0), 0)
  const expense = mt.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
  const balance = income - expense
  return [
    `💰 <b>Бюджет ${month}</b>`,
    `📈 Доходы:  ${income.toLocaleString('ru')} ₽`,
    `📉 Расходы: ${expense.toLocaleString('ru')} ₽`,
    `${balance >= 0 ? '✅' : '⚠️'} Баланс:   ${balance.toLocaleString('ru')} ₽`,
  ].join('\n')
}

async function fmtSummary(prefix = '') {
  const profile  = await readStore('profile')    || {}
  const tasks    = await readStore('tasks')      || []
  const habits   = await readStore('habits_v2') || []
  const today    = _todayKey()
  const name     = profile.name || 'Дмитрий'
  const h        = new Date().getHours()
  const greeting = h < 12 ? 'Доброе утро' : h < 17 ? 'Добрый день' : 'Добрый вечер'

  const overdue   = tasks.filter(t => !t.done && t.date && t.date < today).length
  const todayLeft = tasks.filter(t => !t.done && t.date === today).length
  const doneToday = tasks.filter(t =>  t.done && (t.updated || t.created || '').slice(0, 10) === today).length
  const habDone   = habits.filter(h => (h.log || []).includes(today)).length

  const lines = [`${prefix}👋 ${greeting}, ${name}!`]
  if (overdue   > 0) lines.push(`🔴 Просрочено: ${overdue} задач`)
  if (todayLeft > 0) lines.push(`📅 На сегодня: ${todayLeft} задач`)
  if (doneToday > 0) lines.push(`✅ Выполнено:  ${doneToday} задач`)
  lines.push(`🔁 Привычки: ${habDone}/${habits.length}`)

  return lines.join('\n')
}

// ── Умный ввод: парсинг + запись в store ────────────────────────────────────

async function _handleSmartInput(token, chatId, text) {
  const parsed = await _smartParse(text)
  let ok = false
  try {
    if (parsed.type === 'task') {
      const tasks = await readStore('tasks') || []
      tasks.push(parsed.data)
      ok = await writeStore('tasks', tasks)
    } else if (parsed.type === 'note') {
      const notes = await readStore('notes') || []
      notes.push(parsed.data)
      ok = await writeStore('notes', notes)
    } else if (parsed.type === 'budget') {
      const txns = await readStore('budget_txns') || []
      txns.push(parsed.data)
      ok = await writeStore('budget_txns', txns)
    } else if (parsed.type === 'calendar') {
      const events = await readStore('calendar_events') || []
      events.push(parsed.data)
      ok = await writeStore('calendar_events', events)
    } else if (parsed.type === 'diary') {
      const entries = await readStore('diary_entries') || []
      const existing = entries.find(e => e.date === parsed.data.date)
      if (existing) {
        existing.body    = existing.body + '\n\n' + parsed.data.body
        existing.updated = parsed.data.updated
      } else {
        entries.push(parsed.data)
      }
      ok = await writeStore('diary_entries', entries)
    }
  } catch {}
  await tgSend(token, chatId, ok
    ? parsed.reply
    : `❌ Приложение закрыто — запишу когда откроешь\n\n${parsed.reply}`)
}

// ── Обработчик команд ───────────────────────────────────────────────────────

async function tgHandleCmd(token, chatId, text) {
  const parts = text.trim().split(/\s+/)
  const cmd   = parts[0].toLowerCase().split('@')[0] // убираем @BotName если есть
  const args  = parts.slice(1).join(' ').trim()

  try {
    if (cmd === '/start' || cmd === '/help') {
      await tgSend(token, chatId,
        '👋 <b>Flow — твой личный планировщик</b>\n\n' +
        '📋 /tasks   — задачи на сегодня\n' +
        '📌 /all     — все незавершённые задачи\n' +
        '🔁 /habits  — привычки сегодня\n' +
        '⏱ /focus   — статистика фокуса\n' +
        '💰 /budget  — бюджет месяца\n' +
        '📊 /summary — сводка дня\n\n' +
        '✨ <b>Умный ввод</b> — просто напиши текстом своими словами,\n' +
        'бот сам поймёт, куда это записать:\n' +
        '• <code>изучить React</code> → задача [Учёба]\n' +
        '• <code>кофе 150₽</code> → расход в бюджет\n' +
        '• <code>получил 5000₽</code> → доход в бюджет\n' +
        '• <code>встреча с врачом завтра в 15:00</code> → событие\n' +
        '• <code>сегодня погулял в парке, было классно</code> → дневник\n' +
        '• <code>идея для подарка маме</code> → заметка\n' +
        '• <code>купить молоко</code> → задача [Личное]'
      )
    } else if (cmd === '/tasks') {
      await tgSend(token, chatId, await fmtTasks())
    } else if (cmd === '/all') {
      const tasks   = await readStore('tasks') || []
      const pending = tasks.filter(t => !t.done)
      if (!pending.length) { await tgSend(token, chatId, '✅ Нет незавершённых задач!'); return }
      const today = _todayKey()
      const lines = [`📋 <b>Все задачи (${pending.length}):</b>`]
      pending.slice(0, 20).forEach(t => {
        const tag = t.date ? (t.date < today ? `  🔴<i>${t.date}</i>` : `  <i>${t.date}</i>`) : ''
        lines.push(`• ${t.text}${tag}`)
      })
      if (pending.length > 20) lines.push(`…ещё ${pending.length - 20}`)
      await tgSend(token, chatId, lines.join('\n'))
    } else if (cmd === '/habits') {
      await tgSend(token, chatId, await fmtHabits())
    } else if (cmd === '/focus') {
      await tgSend(token, chatId, await fmtFocus())
    } else if (cmd === '/budget') {
      await tgSend(token, chatId, await fmtBudget())
    } else if (cmd === '/summary') {
      await tgSend(token, chatId, await fmtSummary())
    } else if (cmd === '/add') {
      if (!args) { await tgSend(token, chatId, '❌ Укажи текст: /add Купить хлеб'); return }
      await _handleSmartInput(token, chatId, args)
    } else if (!text.startsWith('/')) {
      // Свободный текст → умный парсинг
      await _handleSmartInput(token, chatId, text)
    } else {
      await tgSend(token, chatId, '❓ Неизвестная команда. Напиши /help')
    }
  } catch (e) {
    console.log('[tg:cmd]', e.message)
  }
}

// ── Polling и запланированные уведомления ───────────────────────────────────

let _tgOffset      = 0
let _tgPollTimer   = null
let _tgMorningTmr  = null
let _tgEveningTmr  = null
let _tgOverdueTmr  = null

function _scheduleDaily(hhmm, callback) {
  const [h, m] = hhmm.split(':').map(Number)
  const now    = new Date()
  const next   = new Date(now)
  next.setHours(h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return setTimeout(() => {
    callback()
    setInterval(callback, 24 * 60 * 60 * 1000)
  }, next - now)
}

async function _tgPollOnce(token, chatId) {
  try {
    const res = await tgApi(token, 'getUpdates', {
      offset:          _tgOffset,
      timeout:         0,
      allowed_updates: ['message'],
    }, 8000)
    if (!res.ok || !res.result?.length) return
    for (const upd of res.result) {
      _tgOffset = upd.update_id + 1
      const msg = upd.message
      if (!msg?.text) continue
      if (String(msg.chat.id) !== String(chatId)) continue
      await tgHandleCmd(token, chatId, msg.text)
    }
  } catch {}
}

function tgStart() {
  const { token, chatId, morningTime, eveningTime, overdueReminder, enabled } = tgLoad()
  if (!token || !chatId || enabled === false) return

  console.log('[tg] bot started, chat_id:', chatId)
  _tgOffset = 0

  // Polling каждые 2 секунды
  _tgPollTimer = setInterval(() => _tgPollOnce(token, chatId), 2000)

  // Утренняя сводка + задачи
  _tgMorningTmr = _scheduleDaily(morningTime || '09:00', async () => {
    await tgSend(token, chatId, await fmtSummary('🌅 <b>Утренняя сводка</b>\n\n'))
    await tgSend(token, chatId, await fmtTasks())
  })

  // Вечерняя сводка
  _tgEveningTmr = _scheduleDaily(eveningTime || '20:00', async () => {
    await tgSend(token, chatId, await fmtSummary('🌙 <b>Вечерняя сводка</b>\n\n'))
  })

  // Напоминание о просроченных задачах каждые 2 часа (только 9–22)
  if (overdueReminder !== false) {
    _tgOverdueTmr = setInterval(async () => {
      if (new Date().getHours() < 9 || new Date().getHours() > 22) return
      const tasks  = await readStore('tasks') || []
      const today  = _todayKey()
      const overdue = tasks.filter(t => !t.done && t.date && t.date < today)
      if (!overdue.length) return
      const lines = [`⚠️ <b>Просроченные задачи (${overdue.length}):</b>`]
      overdue.slice(0, 5).forEach(t => lines.push(`• ${t.text}  <i>${t.date}</i>`))
      if (overdue.length > 5) lines.push(`…ещё ${overdue.length - 5}`)
      await tgSend(token, chatId, lines.join('\n'))
    }, 2 * 60 * 60 * 1000)
  }
}

function tgStop() {
  if (_tgPollTimer)  { clearInterval(_tgPollTimer);   _tgPollTimer  = null }
  if (_tgMorningTmr) { clearTimeout(_tgMorningTmr);   _tgMorningTmr = null }
  if (_tgEveningTmr) { clearTimeout(_tgEveningTmr);   _tgEveningTmr = null }
  if (_tgOverdueTmr) { clearInterval(_tgOverdueTmr);  _tgOverdueTmr = null }
}

// ── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle('telegram:get-settings', () => tgLoad())

ipcMain.handle('telegram:save-settings', (_, data) => {
  tgStop()
  tgSave(data)
  if (data.token && data.chatId && data.enabled !== false) tgStart()
  return { ok: true }
})

ipcMain.handle('telegram:test', async () => {
  const { token, chatId } = tgLoad()
  if (!token || !chatId) return { ok: false, error: 'Токен или Chat ID не указан' }
  try {
    await tgSend(token, chatId,
      '✅ <b>Flow подключён!</b>\n\nБот работает. Напиши /help для списка команд.'
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Синхронизация данных на облачный бот-сервер
const SYNC_KEYS = ['tasks','notes','calendar_events','habits_v2','focus_stats','focus_history','budget_txns','profile','diary_entries']

function _cloudGet(url, headers = {}) {
  return new Promise((resolve) => {
    try {
      const req = net.request({ method: 'GET', url })
      for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)
      let data = ''
      req.on('response', res => {
        res.on('data', c => { data += c })
        res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({}) } })
      })
      req.on('error', () => resolve({}))
      req.end()
    } catch { resolve({}) }
  })
}

async function syncToCloud() {
  const { cloudUrl, syncKey } = tgLoad()
  if (!cloudUrl) return
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed() || win.webContents.isLoading()) return
  try {
    // 1. Вытаскиваем элементы добавленные через бот пока приложение было закрыто
    const baseUrl = cloudUrl.replace(/\/$/, '')
    const { items } = await _cloudGet(baseUrl + '/pending', { 'x-sync-key': syncKey || '' })
    if (Array.isArray(items) && items.length) {
      console.log(`[cloud:sync] pulling ${items.length} pending items`)
      for (const item of items) {
        const keyMap = { task: 'tasks', note: 'notes', budget: 'budget_txns', calendar: 'calendar_events', diary: 'diary_entries' }
        const storeKey = keyMap[item.type]
        if (!storeKey) continue
        const existing = await readStore(storeKey) || []
        if (item.type === 'diary') {
          // дневник: мёрджим по дате
          const ex = existing.find(e => e.date === item.data.date)
          if (ex) { ex.body += '\n\n' + item.data.body; ex.updated = item.data.updated }
          else existing.push(item.data)
          await writeStore(storeKey, existing)
        } else {
          if (!existing.find(e => e.id === item.data.id)) {
            existing.push(item.data)
            await writeStore(storeKey, existing)
          }
        }
      }
    }

    // 2. Пушим актуальные данные на облако
    const data = {}
    for (const key of SYNC_KEYS) {
      const raw = await win.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify('flow__' + key)})`)
      if (raw) data[key] = JSON.parse(raw)
    }
    const body = Buffer.from(JSON.stringify(data))
    const req  = net.request({ method: 'POST', url: baseUrl + '/sync' })
    req.setHeader('Content-Type', 'application/json')
    req.setHeader('x-sync-key', syncKey || '')
    req.on('response', res => { res.resume() })
    req.on('error', e => console.log('[cloud:sync] error:', e.message))
    req.end(body)
  } catch (e) {
    console.log('[cloud:sync] error:', e.message)
  }
}

ipcMain.handle('telegram:sync', () => syncToCloud())

// Отправить произвольное сообщение из renderer (например, при завершении задачи)
ipcMain.handle('telegram:send', async (_, text) => {
  const { token, chatId, enabled } = tgLoad()
  if (!token || !chatId || !enabled) return { ok: false }
  try {
    await tgSend(token, chatId, text)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ═══════════════════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  // Удаляем stale LevelDB LOCK-файлы. Node fs.unlinkSync не может удалить
  // заблокированный файл на Windows — используем cmd /c del /f который
  // работает даже когда файл занят другим процессом.
  const userData = app.getPath('userData')
  ;['claude-ai', 'yandex-music'].forEach(name => {
    try {
      const lockDir = path.join(userData, 'Partitions', name, 'IndexedDB')
      if (!fs.existsSync(lockDir)) return
      fs.readdirSync(lockDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .forEach(dir => {
          const lock = path.join(lockDir, dir.name, 'LOCK')
          if (!fs.existsSync(lock)) return
          try { fs.unlinkSync(lock) } catch {
            // Если Node не может удалить — форсируем через cmd
            try { require('child_process').execSync(`cmd /c del /f /q "${lock}"`, { timeout: 2000 }) } catch {}
          }
        })
    } catch {}
  })

  // Чистим файл активности за сегодня, если он содержит кракозябли (символ U+FFFD).
  // Это происходит при первом запуске после фикса кодировки PowerShell.
  try {
    const todayFile = activityFile(new Date().toISOString().slice(0, 10))
    if (fs.existsSync(todayFile)) {
      const raw = fs.readFileSync(todayFile, 'utf8')
      if (raw.includes('�') || raw.includes('\\ufffd')) {
        fs.writeFileSync(todayFile, '[]')
      }
    }
  } catch {}

  // Разрешаем микрофон для Web Speech API
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (['media', 'microphone', 'audioCapture'].includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  createWindow()
  // Автозапуск трекинга сразу после старта
  _actTimer = setInterval(pollActiveWindow, 10_000)
  pollActiveWindow()
  // Запуск Telegram бота (если настроен)
  tgStart()
  // Синхронизация с облачным ботом каждые 5 минут
  setInterval(syncToCloud, 5 * 60 * 1000)
  // Первая синхронизация через 10 сек после старта (дать время загрузиться renderer)
  setTimeout(syncToCloud, 10000)

  // Проверяем обновления через 15 сек после старта, потом каждые 4 часа
  if (_autoUpdater) {
    setTimeout(() => _autoUpdater.checkForUpdatesAndNotify(), 15000)
    setInterval(() => _autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000)
  }
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
