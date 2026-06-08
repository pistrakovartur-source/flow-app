# Flow — Планировщик дня · Контекст проекта

---

## Последние изменения (сессия 3)

### Telegram Bot — двусторонняя интеграция + облачный деплой

---

#### Архитектура

```
Electron app (main.js)
  ├── Telegram bot (polling, PowerShell+ProxyAgent)   ← работает пока приложение запущено
  └── Sync → https://flow-bot-z9ej.onrender.com       ← каждые 5 мин + при старте

Render.com (bot-server/)                              ← работает 24/7 даже когда ноут выключен
  ├── POST /sync  ← принимает данные из Electron
  ├── GET  /health
  └── Telegram polling (прямое подключение, без прокси)
```

---

#### Новые файлы

**`bot-server/`** — автономный Node.js сервер (задеплоен на Render.com)
```
bot-server/
├── index.js            — бот + Express HTTP сервер
├── package.json        — зависимости: express, https-proxy-agent
├── ecosystem.config.js — конфиг pm2 для локального запуска
├── render.yaml         — конфиг деплоя на Render.com
└── .gitignore
```

GitHub репо: **https://github.com/pistrakovartur-source/flow-bot**
Render URL: **https://flow-bot-z9ej.onrender.com**

---

#### Изменения в существующих файлах

**`main.js`** — добавлены секции:
- `tgApi(token, method, params)` — HTTP через `https` + `HttpsProxyAgent` (127.0.0.1:10809)
- `tgLoad() / tgSave()` — чтение/запись `userData/telegram_settings.json`
- `readStore(key) / writeStore(key, value)` — доступ к localStorage renderer из main процесса
- `fmtTasks / fmtHabits / fmtFocus / fmtBudget / fmtSummary` — форматтеры данных для TG
- `tgHandleCmd(token, chatId, text)` — обработчик команд
- `tgStart() / tgStop()` — запуск/остановка polling + schedulers
- `syncToCloud()` — POST данных на Render каждые 5 мин
- IPC: `telegram:get-settings`, `telegram:save-settings`, `telegram:test`, `telegram:send`, `telegram:sync`

**`preload.js`** — добавлены namespace:
```js
window.jarvis.telegram.{ getSettings, saveSettings, test, send, sync }
window.jarvis.store.{ onRefresh }   // уведомление о записи из main (бот добавил задачу)
```

**`src/store.js`** — добавлен listener:
```js
window.jarvis.store.onRefresh(key => {
  // перечитывает localStorage → уведомляет React подписчиков
})
```

**`src/screens/Settings.jsx`** — добавлены компоненты:
- `TelegramCard` — карточка настройки бота (токен, chat_id, расписание, sync key, url сервера)
- `TgRow` — вспомогательный layout компонент

---

#### Настройки бота

Файл: `%APPDATA%\jarvis-app\telegram_settings.json`
```json
{
  "token":          "...",
  "chatId":         "717571234",
  "morningTime":    "09:00",
  "eveningTime":    "20:00",
  "overdueReminder": true,
  "enabled":        true,
  "cloudUrl":       "https://flow-bot-z9ej.onrender.com",
  "syncKey":        "flow2024",
  "proxyUrl":       "http://127.0.0.1:10809"
}
```

---

#### Команды бота

| Команда | Что возвращает |
|---------|---------------|
| `/start`, `/help` | Список команд |
| `/tasks` | Просрочка + на сегодня + без даты |
| `/all` | Все незавершённые с датами |
| `/habits` | Привычки сегодня ✅/⬜ |
| `/focus` | Статистика фокус-сессий |
| `/budget` | Доходы/расходы/баланс за месяц |
| `/summary` | Общая сводка дня |
| `/add Текст` | Добавить задачу (сразу попадает в приложение) |

#### Автоматические уведомления

| Когда | Что |
|-------|-----|
| 09:00 | Утренняя сводка + список задач |
| 20:00 | Вечерняя сводка |
| Каждые 2 ч (9–22) | Просроченные задачи (если есть) |

---

#### Почему ProxyAgent а не fetch/https напрямую

На этой машине Node.js не может подключиться к `api.telegram.org` напрямую.
Причина: в Windows настроен системный прокси `127.0.0.1:10809` (VPN-клиент).
PowerShell использует WinHTTP → видит прокси. Node.js — нет.
Решение: `https-proxy-agent` пробрасывает запросы через локальный прокси.
На Render.com (Linux, без прокси) `PROXY_URL` не задан → прямое подключение.

---

#### pm2 (локальный фоновый процесс)

```bash
pm2 list                          # статус
pm2 logs flow-bot                 # логи
pm2 restart flow-bot              # перезапуск
pm2 stop flow-bot                 # остановить
```

Автозапуск при входе в Windows: реестр `HKCU\...\Run` → `FlowBot`
pm2 конфиг: `bot-server/ecosystem.config.js`

---

#### Деплой обновлений на Render

```bash
cd C:\Users\Suhor\Desktop\jarvis-app\bot-server
git add .
git commit -m "update"
git push
# Render автоматически передеплоит через ~1 мин
```

---

#### Зависимости (новые)

| Пакет | Где | Зачем |
|-------|-----|-------|
| `https-proxy-agent` | jarvis-app + bot-server | Telegram через прокси |
| `express` | bot-server | HTTP сервер для /sync |
| `pm2` (global) | Windows | Фоновый процесс |

---

## Последние изменения (сессия 2)

### Полная смена дизайна — новая дизайн-система

**Изменены CSS-файлы:**
- `renderer/styles/base.css` — новые CSS-переменные (`--acc`, `--surf`, `--surf-2`, `--surf-hi`, `--t`, `--t-dim`, `--t-mute`, `--line`, `--line-2`, `--r`, `--gap`, `--pad`, `--rail-w`); шрифты Hanken Grotesk + Space Grotesk + JetBrains Mono; фазовые палитры ауры (`data-phase`: night/morning/day/evening); все keyframes
- `renderer/styles/layout.css` — новый shell: `.app` (CSS grid 2 колонки), `.rail` (сайдбар с анимированным индикатором активного пункта, `-webkit-app-region:drag`), `.main` (flex колонка), `.topbar` (3-колонный grid: lights | clock | buttons), `.scroll`, аура-блобы, зернистость
- `renderer/styles/components.css` — все компоненты: `.card` (glassmorphism, hover lift), `.btn-primary`, `.seg`/`.seg-btn`, `.stat-pill`, `.cmd-*` (command palette), `.toast`, `.tweaks-panel`, hero/bento/tasks/focus/habits/budget/calendar/diary/activity/notes/news/settings классы; обратная совместимость `.btn`/`.pill`

**Новые файлы:**
- `src/components/Viz.jsx` — экспортирует: `Ring` (SVG кольцо с анимацией), `Bars` (столбчатая диаграмма), `Sparkline` (сглаженный spline), `Heatmap` (тепловая карта 18 недель), `AnimatedNumber` (count-up), `MoodDots`, `Donut` (пончик-диаграмма)
- `src/components/UIKit.jsx` — экспортирует: `Card`, `CardHead`, `PageHeader`, `Segmented`, `StatPill`, `Sidebar` (с animated indicator через `useRef`/`useEffect`)

**Обновлён `src/components/Icons.jsx`** — добавлены иконки: `bolt`, `flame`, `moon`, `sunrise`, `bulb`, `arrow`, `feather`, `pulse`, `drop`, `wind`, `wallet`, `pin`, `target`, `play`, `pause`, `gear`

**Переписан `src/App.jsx`:**
- Shell: `.app` + `.rail` (через `Sidebar` из UIKit) + `.main` + `.topbar`
- Topbar: traffic lights (left) | clock pill с секундами `hh:mm:ss` + иконка фазы (center) | кнопки Задача/Поиск/Tweaks (right)
- Dynamic Island — абсолютно позиционирован (`position:absolute; top:8px; left:50%; z-index:9999`) поверх topbar, при наведении раскрывается вниз
- Встроены: CommandPalette (компонент внутри файла), TweaksPanel (компонент внутри файла)
- Tweaks: `accent`, `timeOfDay` (auto/morning/day/evening/night), `density` (compact/regular/comfy), `motion`, `glow`, `grain` — применяются через `data-*` атрибуты на `<html>`
- Сохранена вся Electron-логика: VAD/whisper wake-word, TTS, IPC window controls

**Обновлены экраны** (CSS-переменные заменены везде, враппер `.page` → `.view`):
- `Dashboard.jsx` — полностью переписан: Hero с Ring-прогрессом, bento-grid (tasks/focus/budget/habits/weather/events/diary/music/reminders), реальные данные из localStorage
- `Tasks.jsx` — PageHeader + Segmented фильтры + `.tlist` карточки; вся логика DnD/subtasks/bulk/repeat сохранена
- `Calendar.jsx` — PageHeader + Segmented (месяц/неделя) + month-nav кнопки; месячная сетка и week-view без изменений
- `Focus.jsx`, `Habits.jsx`, `Budget.jsx`, `Notes.jsx`, `Activity.jsx`, `Diary.jsx`, `News.jsx`, `Settings.jsx` — враппер `.view`, все CSS-переменные обновлены на новые имена
- `Music.jsx`, `Assistant.jsx` — **не тронуты**

**Ключевые маппинги CSS-переменных (старое → новое):**
| Старое | Новое |
|--------|-------|
| `--accent` | `--acc` |
| `--surface-1` | `--surf` |
| `--surface-2` | `--surf-2` |
| `--surface-3` | `--surf-hi` |
| `--text` | `--t` |
| `--text-dim` | `--t-dim` |
| `--text-mute` | `--t-mute` |
| `--line-accent` | `--acc-line` |
| `--accent-soft` | `--acc-text` |
| `--ok` | `--c-calm` |
| `--warn` | `--c-warm` |

**Tweaks хранятся в localStorage:** ключ `flow_tweaks_v2`

---

## Быстрый запуск

```bash
cd C:\Users\Suhor\Desktop\jarvis-app
npm start          # сборка + запуск Electron
node build.mjs     # только сборка
npx electron . --dev  # с DevTools
```

---

## Что за проект

Electron-приложение на React — персональный планировщик **Flow**.  
Никакого AI, никаких платных API. Всё локально, всё быстро.

**Окно:** 1320×860, без системного фрейма, кастомный titlebar  
**Пользователь:** Дмитрий (suhorukov27@hotmail.com)

---

## Стек

| Слой | Технология |
|------|-----------|
| UI | React 18, JSX (inline styles) |
| Bundler | esbuild (ESM + splitting) |
| Desktop | Electron 29 |
| Хранилище | localStorage через `Store` (prefix `flow__`) + JSON-файлы в userData |
| Стили | CSS variables, без CSS-in-JS фреймворков |
| Погода | Open-Meteo API (бесплатно, без ключа, город из профиля) |
| Геокодирование | Open-Meteo Geocoding API (resolves city → lat/lon, кеш 24ч) |
| Музыка | Яндекс Музыка через Electron BrowserView (полный embed) |
| OAuth | Яндекс ID (опционально, для профиля / IMAP почты) |
| Активность | PowerShell + Win32 API + sql.js (SQLite браузерная история) |
| TTS | Web Speech API (нейронные голоса) + Windows SAPI через PowerShell |
| STT | whisper.cpp офлайн (binary + модель tiny ~75MB, скачивается один раз) |
| Новости | RSS-ленты через raw fetch в main.js (без API ключей) |
| Анализ дневника | Локальный JS: TF-IDF, тональность, паттерны (без AI API) |

---

## Структура файлов

```
jarvis-app/
├── main.js              — Electron main (IPC: OAuth, BrowserView музыки, CalDAV, IMAP,
│                          веб-поиск, activity tracker, news:fetch, tts:speak/getVoices)
├── preload.js           — contextBridge: window.jarvis.{window, oauth, openUrl, web,
│                          yandex, music, activity, speech, news, tts}
├── build.mjs            — esbuild config (outdir=renderer/dist, format=esm, splitting=true)
├── package.json         — зависимости: react, react-dom, sql.js; dev: electron, esbuild
├── renderer/
│   ├── index.html
│   └── styles/          — base.css, layout.css, components.css
└── src/
    ├── index.jsx        — точка входа React
    ├── App.jsx          — shell: навигация 13 экранов, Dynamic Island, Tweaks,
    │                      Quick Add (Ctrl+N), сайдбар-бейджи,
    │                      VAD always-listen (wake-word «джарвис» в фоне)
    ├── store.js         — AppStore (localStorage, prefix flow__) + useStore + uid() + musicPoller
    ├── constants.js     — общие константы: TASK_TAGS, NOTE_TAGS, PRIORITY, REPEAT_LABELS
    ├── Onboarding.jsx   — онбординг: имя, режим дня, интересы (3 шага)
    ├── components/
    │   ├── Icons.jsx         — SVG иконки
    │   ├── DynamicIsland.jsx — «остров» в шапке: таймер / трек / напоминания / время
    │   ├── TweaksPanel.jsx   — панель кастомизации (цвет, шрифт, радиус, название, тема)
    │   ├── GlobalSearch.jsx  — оверлей Ctrl+K: поиск по задачам, заметкам, событиям, привычкам
    │   └── LearnPanel.jsx    — панель поиска обучающих материалов (YouTube, курсы, книги, статьи)
    ├── screens/
    │   ├── Dashboard.jsx  — главная: погода, задачи, расписание, виджеты drag&drop
    │   ├── Tasks.jsx      — task manager: теги, приоритеты, подзадачи, повторы, drag&drop
    │   ├── Calendar.jsx   — месячный + недельный вид, события, повторы
    │   ├── Music.jsx      — Яндекс Музыка embed (BrowserView)
    │   ├── Focus.jsx      — секундомер + Pomodoro режим, статистика, цель в неделю
    │   ├── Habits.jsx     — ежедневный трекер, дни недели, тепловая карта, экспорт CSV
    │   ├── Budget.jsx     — доходы/расходы, лимиты по категориям, CSV экспорт
    │   ├── Notes.jsx      — Markdown заметки, masonry-сетка, теги, экспорт .md
    │   ├── Activity.jsx   — таймлайн, статистика приложений, браузер, файлы
    │   ├── Diary.jsx      — личный дневник: мини-календарь, 8 настроений, Markdown,
    │   │                    автосохранение, Ctrl+S, серия дней, инсайты, год назад
    │   ├── News.jsx       — новостной фид: 6 RSS-источников, фильтры, реакции, reading list
    │   ├── Assistant.jsx  — push-to-talk (whisper.cpp), VAD, wake-word, TTS
    │   └── Settings.jsx   — профиль inline, виджеты, тема, экспорт/импорт JSON
    ├── services/
    │   ├── tts.js           — централизованный TTS: выбор голоса, разбивка на предложения
    │   ├── diaryAnalysis.js — анализ дневника: TF-IDF, тональность, инсайты, паттерны
    │   └── markdown.jsx     — общий Markdown-парсер: parseInline, renderMarkdown(text, mode)
    └── utils/
        └── date.js          — утилиты дат: todayStr, localDateStr, fmtDateLong,
                               fmtDateShort, timeAgo, monthKey
```

---

## Навигация — 13 вкладок

| Вкладка | Иконка | Описание |
|---------|--------|----------|
| Главная | grid | Сводка дня, прогресс задач, балл продуктивности, виджеты (drag&drop) |
| Задачи | check | Task manager: теги, приоритеты, дата, поиск, массовые действия, LearnPanel |
| Календарь | calendar | Месячный + недельный вид, события с временем начала/конца, повторы |
| Музыка | music | Яндекс Музыка в BrowserView (полноэкранный плеер) |
| Фокус | timer | Секундомер ▶⏸✓↺ + Pomodoro режим (25/5, 50/10, 90/15), статистика |
| Привычки | repeat | Ежедневный трекер, дни недели, 7/30-дневная тепловая карта, серии |
| Бюджет | tag | Доходы/расходы, лимиты по категориям, поиск в истории, CSV экспорт |
| Заметки | note | Markdown, карточки с цветами, тегами, закрепление, экспорт .md |
| Активность | history | Таймлайн дня (дедупликация), статистика приложений, CSV экспорт |
| **Дневник** | diary | Личный журнал: настроение, Markdown, серия дней, инсайты, год назад |
| **Новости** | newspaper | RSS-фид: 6 источников, темы, реакции, рекомендации, reading list |
| Ассистент | mic | Push-to-talk + VAD always-listen + wake-word + TTS настройки |
| Настройки | settings | Профиль inline, город погоды, внешний вид, экспорт/импорт JSON |

---

## Dynamic Island

Тёмная пилюля в центре шапки — растёт вниз при наведении мыши.

**В свёрнутом виде показывает (по приоритету):**
1. 🎯 Фокус-таймер (цветная точка + `23:45`) + кнопки ⏮⏸⏭
2. 🎵 Название трека + кнопки ⏮⏸⏭ (видны всегда, в том числе при раскрытии)
3. 🔔 Количество напоминаний
4. 🕐 Текущее время

**При наведении — раскрывается:**
- Фокус: режим, таймер, прогресс-бар, кнопка «Открыть»
- Музыка: обложка + название + артист + кнопки управления
- Напоминания: список с заголовками
- Время: крупные цифры + дата

---

## window.jarvis API (preload.js)

```js
window.jarvis.window.{ close, minimize, maximize }
window.jarvis.oauth.{ open(url), listen() }
window.jarvis.openUrl(url)
window.jarvis.web.{ search({ query, maxResults }), fetch(url) }   // fetch: только https/http, без localhost
window.jarvis.yandex.{ calendar({ token, login }), mail({ token, email, appPassword }) }
window.jarvis.music.{ open, hide, resize, back, forward, reload, home, goto, getTrack, control }
window.jarvis.activity.{ start(), stop(), getLog(date), getBrowserHistory(limit), getRecentFiles() }
window.jarvis.speech.{ getStatus(), setup(), recognize(pcmBuf), onProgress(cb) }
window.jarvis.news.{ fetch(url) }          // raw fetch БЕЗ стрипа тегов — для RSS/XML
window.jarvis.tts.{ getVoices(), speak({ text, voiceName, rate }) }  // Windows SAPI через PowerShell
```

---

## Store — ключи в localStorage (prefix: `flow__`)

| Ключ | Содержимое |
|------|-----------|
| `profile` | `{ name, email, city, timezone, workStart, workEnd, dnd, interests[] }` |
| `integrations` | `{ yandexCalendar, yandexMail, yandexMusic }` |
| `yandex_auth` | OAuth токены + profile |
| `yandex_creds` | `{ clientId, clientSecret }` |
| `yandex_mail_pwd` | Пароль приложения для IMAP |
| `tasks` | `[{ id, text, tag, priority, date, time, note, done, created, repeat, subtasks[] }]` |
| `tasks_filter` | `'all'\|'today'\|'pending'\|'done'` — сохранённый фильтр (не сбрасывается) |
| `tasks_tag_filter` | string — сохранённый тег-фильтр |
| `reminders` | `[{ id, title, sub, icon }]` |
| `schedule` | `[{ id, time, title, dur, accent }]` |
| `calendar_events` | `[{ id, title, date, time, endTime, color, allDay, desc, location, repeat, repeatEnd }]` |
| `notes` | `[{ id, title, body, color, tag, pinned, created, updated }]` — body: Markdown |
| `habits_v2` | `[{ id, name, icon, color, weeklyTarget, targetDays[], log[], created }]` |
| `budget_txns` | `[{ id, type, amount, category, note, date, month, created }]` |
| `budget_limit` | number — глобальный лимит расходов на месяц |
| `budget_cat_limits` | `{ [category]: number }` — лимиты по категориям расходов |
| `focus_stats` | `{ sessions, totalMinutes, today, todaySessions, todayMinutes }` |
| `focus_live` | `{ running, modeId, startedAt, totalSeconds, elapsed }` — читает Dynamic Island |
| `focus_history` | `{ [YYYY-MM-DD]: { sessions, minutes } }` |
| `focus_weekly_goal` | number — цель сессий в неделю (default 10) |
| `music_track` | `{ title, artist, cover, playing } \| null` |
| `tweaks` | `{ accent, accentGlow, accentSoft, lineAccent, fontDisplay, radius, appName, theme }` |
| `onboarding_done` | boolean |
| `dashboard_widget_order` | `['weather','music','habits','spending','events']` |
| `diary_entries` | `[{ id, date (YYYY-MM-DD), body, mood, created, updated }]` |
| `always_listen` | boolean — VAD режим постоянного прослушивания |
| `wake_word` | string — пробуждающее слово (default: `'джарвис'`) |
| `wake_last` | `{ raw, cmd, ts }` — последняя распознанная wake-команда |
| `tts_settings` | `{ voiceName, rate (0.6–1.4), pitch (0.7–1.3), engine ('web'\|'sapi') }` |
| `news_cache` | `{ ts, articles[] }` — кеш 30 мин |
| `news_reactions` | `{ [articleId]: 'like'\|'dislike' }` |
| `news_topic_weights` | `{ [topic]: number }` — веса тем (растут от лайков) |
| `news_user_topics` | `string[]` — пользовательские темы |
| `news_saved` | `[{ ...article, savedAt }]` — reading list (🔖 сохранённые статьи) |

**Данные вне localStorage:**
- `userData/flow_activity_YYYY-MM-DD.json` — лог активности окон (пишет main.js)
- `userData/whisper/` — бинарник whisper.cpp + модель ggml-tiny.bin

---

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl+K` | Открыть глобальный поиск |
| `Ctrl+N` | Быстрое добавление задачи из любого экрана |
| `Ctrl+S` | Сохранить запись в Дневнике |
| `Space` | Пауза / старт (Фокус) |
| `S` | Стоп + сохранить сессию (Фокус, только если запущен) |
| `R` | Сброс таймера (Фокус) |
| `Esc` | Закрыть поиск / модальное окно |
| `↑↓` | Навигация в поиске |
| `↵ Enter` | Перейти к результату поиска |

---

## Always-Listen VAD (App.jsx)

```
Константы:
  RMS_THRESHOLD = 0.018   — порог громкости
  VAD_SPEECH_MIN = 500ms  — минимальная длительность речи
  VAD_SILENCE_END = 700ms — тишина после которой отправляем в whisper
  VAD_MAX_RECORD = 8000ms — максимум одной записи

Логика:
  ScriptProcessor(4096) → RMS → vadOn=true → накапливаем Int16 chunks
  После 700мс тишины → PCM → whisper.recognize()
  wake_word (экранируется для RegExp) → execWakeCmd()

execWakeCmd: навигация «открой [экран]», «добавь задачу [текст]», время, счётчик задач
Индикатор в titlebar: зелёная пульсирующая точка «Слушаю»
```

---

## TTS — src/services/tts.js

```
initTTS()  — при старте, выбирает лучший русский голос (Natural > Online > Irina > любой ru)
speak(text, overrides?)
  — читает tts_settings из Store, разбивает на предложения, rate default 0.92

SAPI (Windows): PowerShell генерирует WAV → base64 → Audio в renderer
  Файлы имеют уникальный суффикс Date.now()_random (нет гонки при параллельных вызовах)
```

---

## Фокус — режимы

```
⏱ Секундомер (счёт вверх):
  start() / pause() / stop() → saveSession() / reset()
  Восстановление: читает focus_live из Store при монтировании

🍅 Pomodoro (счёт вниз):
  Пресеты: 25/5, 50/10, 90/15 мин
  pomPhase 'work'|'break', pomLeft — секунд осталось, pomCount — помодоро сегодня
  При 0 в 'work'  → saveSession() + переход в 'break' + уведомление
  При 0 в 'break' → переход в 'work' + уведомление
  ⏭ пропустить фазу, switchMode() — сброс при переключении режимов
```

---

## Дневник — diaryAnalysis.js

```
getSentiment(text)      → { score, label, pos, neg }
extractKeywords(entries, topN)  → [{ word, freq, score }]  (TF-IDF)
getMoodByDow(entries)   → [{ day, topMood, score, total }] × 7
getMoodTrend(entries, 14) → [{ date, mood }]
getMoodHabitCorr(entries, habits) → { diff, better }
detectThemes(text)      → темы из 8 категорий
generateInsights / getSuggestions / scoreEntry

Панель ✨ Инсайты (3 вкладки): Советы · Паттерны · Облако слов
Дополнительно: 🎲 случайная запись, «В этот день год назад», 📚 Материалы → LearnPanel
```

---

## LearnPanel (src/components/LearnPanel.jsx)

```
Props: query (string), onClose (function)
Автозапуск при монтировании (useRef didLoad — без повторных вызовов)

Два параллельных поиска через window.jarvis.web.search:
  "${query} youtube лекция урок туториал"
  "${query} онлайн курс учебник обучение"

Категоризация:
  📺 Видео   — youtube.com / youtu.be
  🎓 Курсы   — coursera, stepik, udemy, skillbox, hexlet, netology, edx
  📚 Книги   — текст содержит: книга, учебник, book, pdf
  🔗 Статьи  — всё остальное

Используется из:
  Tasks → кнопка «📚 Найти материалы» в TaskAssistantPanel
  Diary → кнопка «📚 Материалы» в заголовке (после ручного сохранения)
```

---

## Markdown (src/services/markdown.jsx)

```
parseInline(text)              — **bold**, *italic*, `code`
renderMarkdown(text, mode)     — блочный рендер
  mode='diary' — крупные заголовки, абзацы с lineHeight 1.85
  mode='note'  — компактный, font-size 13, используется в карточках Notes
```

---

## Безопасность (main.js)

```
web:fetch    — разрешены только http/https; блокирует localhost, 127.0.0.1, ::1, 192.168.x, 10.x, 172.16-31.x
tts:speak    — уникальный суффикс файла: Date.now()_random5chars (нет гонки)
wake-word    — экранируется через .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') перед new RegExp()
```

---

## News — RSS источники

```
Хабр        https://habr.com/ru/rss/all/all/         Технологии, Программирование
Hacker News https://hnrss.org/frontpage              Технологии
Лента.ру    https://lenta.ru/rss/news                Новости, Россия
РБК         https://rss.rbc.ru/v10/main.rss          Финансы, Бизнес
BBC Русская https://feeds.bbci.co.uk/russian/rss.xml Мир, Политика
TechCrunch  https://techcrunch.com/feed/             Технологии, Стартапы

Парсинг: DOMParser('text/xml'), RSS 2.0 + Atom, кеш 30 мин
Рекомендации: weights[topic] += 1 (лайк), -= 0.5 (дизлайк)
  score = sum(weights) * (0.65 + 0.35 * freshness),  freshness = max(0, 1 - ageH/72)
Reading list: 🔖 кнопка на карточке → news_saved; вкладка «Сохранённое» в фильтрах
```

---

## Calendar — недельный вид

```
view: 'month' | 'week'
Time grid: 24 строки × 48px = 1152px, overflowY auto, max 560px
Events: position:absolute, top = (h + m/60)*48, height = duration*48/60
Клик на ячейку → openAdd(date, time)
```

---

## Budget — лимиты по категориям

```
Store: budget_cat_limits → { [category]: number }
Бар категории: верхний = % от общих расходов, нижний = % от лимита
  зелёный <70%, жёлтый 70-90%, красный >90%
```

---

## Activity — дедупликация

```js
mergeConsecutive(log): appName + windowTitle совпадают → объединяет сессии
```

---

## Tasks — авто-повтор

```js
toggle(id): выполнена + repeat !== 'none' + date →
  computeNextRepeatDate() → новая задача с следующей датой
  Поддерживает: daily, weekly, monthly, workdays
```

---

## Известные проблемы

1. **Яндекс Почта IMAP** — требует ручного создания пароля приложения
2. **CalDAV** — работает только если в Яндекс-приложении включены нужные права
3. **Трек в острове** — появляется через ~2с (polling каждые 2с)
4. **Activity / история браузера** — не работает если Chrome/Edge открыт (файл заблокирован)
5. **Activity / PowerShell** — первые 10 секунд после старта данные ещё не накоплены
6. **Always-listen / VAD** — порог 0.018 может потребовать подстройки под микрофон
7. **TTS SAPI** — добавляет ~1-2с задержки (генерация WAV через PowerShell)
8. **Новости** — некоторые RSS могут быть недоступны в зависимости от региона

---

## Команды разработки

```bash
cd C:\Users\Suhor\Desktop\jarvis-app
node build.mjs       # только сборка
npm start            # сборка + запуск Electron
npx electron . --dev # с DevTools
```
