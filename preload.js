const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jarvis', {

  window: {
    close:    () => ipcRenderer.send('window:close'),
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
  },

  // OAuth — открыть браузер + поймать code
  oauth: {
    open:   (url) => ipcRenderer.invoke('oauth:open', url),
    listen: ()    => ipcRenderer.invoke('oauth:listen'),
  },

  // Открыть URL в системном браузере
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),

  // Яндекс интеграции (CalDAV, IMAP)
  yandex: {
    calendar: (params) => ipcRenderer.invoke('yandex:calendar', params),
    mail:     (params) => ipcRenderer.invoke('yandex:mail',     params),
  },

  // Яндекс Музыка — BrowserView управление
  music: {
    open:    (b)  => ipcRenderer.invoke('music:open',    b),
    resize:  (b)  => ipcRenderer.invoke('music:resize',  b),
    hide:    ()   => ipcRenderer.invoke('music:hide'),
    back:    ()   => ipcRenderer.invoke('music:back'),
    forward: ()   => ipcRenderer.invoke('music:forward'),
    reload:  ()   => ipcRenderer.invoke('music:reload'),
    home:    ()   => ipcRenderer.invoke('music:home'),
    goto:    (u)  => ipcRenderer.invoke('music:goto',    u),
    getTrack: ()  => ipcRenderer.invoke('music:getTrack'),
    control:  (a) => ipcRenderer.invoke('music:control', a),
  },

  // Веб-поиск и загрузка страниц
  web: {
    search: (params) => ipcRenderer.invoke('web:search', params),
    fetch:  (url)    => ipcRenderer.invoke('web:fetch',  url),
  },

  // RSS/Atom новости — raw fetch без стрипа тегов
  news: {
    fetch: (url) => ipcRenderer.invoke('news:fetch', url),
  },

  // TTS через Windows SAPI (более естественные голоса)
  tts: {
    getVoices: ()       => ipcRenderer.invoke('tts:getVoices'),
    speak:     (params) => ipcRenderer.invoke('tts:speak', params),
  },

  // Speech-to-Text через whisper.cpp (офлайн после первой загрузки)
  speech: {
    getStatus:  ()    => ipcRenderer.invoke('speech:getStatus'),
    setup:      ()    => ipcRenderer.invoke('speech:setup'),
    recognize:  (pcm) => ipcRenderer.invoke('speech:recognize', pcm),
    onProgress: (cb)  => ipcRenderer.on('speech:progress', (_, msg) => cb(msg)),
  },

  // Трекер активности
  activity: {
    start:             ()      => ipcRenderer.invoke('activity:start'),
    stop:              ()      => ipcRenderer.invoke('activity:stop'),
    getLog:            (date)  => ipcRenderer.invoke('activity:getLog',            date),
    getBrowserHistory: (limit) => ipcRenderer.invoke('activity:getBrowserHistory', limit),
    getRecentFiles:    ()      => ipcRenderer.invoke('activity:getRecentFiles'),
  },

  // Telegram Bot
  telegram: {
    getSettings:  ()     => ipcRenderer.invoke('telegram:get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('telegram:save-settings', data),
    test:         ()     => ipcRenderer.invoke('telegram:test'),
    send:         (text) => ipcRenderer.invoke('telegram:send', text),
    sync:         ()     => ipcRenderer.invoke('telegram:sync'),
  },

  // Store refresh — уведомление от main-процесса об изменении данных (бот добавил задачу)
  store: {
    onRefresh: (cb) => ipcRenderer.on('store:refresh', (_, key) => cb(key)),
  },

})
