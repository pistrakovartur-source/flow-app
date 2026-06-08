/* database.js — локальная база данных SQLite */
/* Подключается к main.js через ipcMain                */

const Database = require('better-sqlite3');
const path     = require('path');
const { app }  = require('electron');

// База хранится в папке приложения (не удаляется при обновлении)
const DB_PATH  = path.join(app.getPath('userData'), 'jarvis.db');

let db;

// ── Инициализация ──
function init() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Быстрее при параллельных операциях

  // Создаём таблицы если их нет
  db.exec(`
    -- Задачи
    CREATE TABLE IF NOT EXISTS tasks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      text      TEXT    NOT NULL,
      time      TEXT    DEFAULT '--:--',
      tag       TEXT    DEFAULT 'Личное',
      done      INTEGER DEFAULT 0,
      created   TEXT    DEFAULT (datetime('now'))
    );

    -- Факты памяти (что Jarvis знает о пользователе)
    CREATE TABLE IF NOT EXISTS memory (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      text      TEXT    NOT NULL,
      source    TEXT    DEFAULT 'из разговора',
      created   TEXT    DEFAULT (datetime('now'))
    );

    -- История разговоров (сессии)
    CREATE TABLE IF NOT EXISTS sessions (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT    NOT NULL,
      summary   TEXT    DEFAULT '',
      kind      TEXT    DEFAULT 'text',
      created   TEXT    DEFAULT (datetime('now'))
    );

    -- Сообщения внутри сессий
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      role       TEXT    NOT NULL,  -- 'user' | 'assistant'
      content    TEXT    NOT NULL,
      created    TEXT    DEFAULT (datetime('now'))
    );

    -- Профиль пользователя (пары ключ-значение)
    CREATE TABLE IF NOT EXISTS profile (
      key       TEXT    PRIMARY KEY,
      value     TEXT    NOT NULL
    );
  `);

  console.log('[DB] База данных инициализирована:', DB_PATH);
  return db;
}

// ── Задачи ──

function getTasks() {
  return db.prepare('SELECT * FROM tasks ORDER BY created DESC').all();
}

function saveTask(task) {
  const stmt = db.prepare('INSERT INTO tasks (text, time, tag) VALUES (?, ?, ?)');
  const res  = stmt.run(task.text, task.time || '--:--', task.tag || 'Личное');
  return { id: res.lastInsertRowid, ...task };
}

function toggleTask(id) {
  db.prepare('UPDATE tasks SET done = 1 - done WHERE id = ?').run(id);
}

function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// ── Память ──

function getMemory() {
  return db.prepare('SELECT * FROM memory ORDER BY created DESC').all();
}

function saveMemory(item) {
  const stmt = db.prepare('INSERT INTO memory (text, source) VALUES (?, ?)');
  const res  = stmt.run(item.text, item.source || 'из разговора');
  return { id: res.lastInsertRowid, ...item };
}

function deleteMemory(id) {
  db.prepare('DELETE FROM memory WHERE id = ?').run(id);
}

// ── История ──

function getHistory() {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY created DESC').all();
  return sessions.map(s => ({
    ...s,
    messages: db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created').all(s.id),
  }));
}

function saveMessage({ sessionId, role, content, title, kind }) {
  // Создаём сессию если нужно
  if (!sessionId) {
    const res = db.prepare('INSERT INTO sessions (title, kind) VALUES (?, ?)').run(title || 'Разговор', kind || 'text');
    sessionId = res.lastInsertRowid;
  }
  db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)').run(sessionId, role, content);
  return sessionId;
}

// ── Профиль ──

function getProfile() {
  const rows = db.prepare('SELECT key, value FROM profile').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function setProfile(key, value) {
  db.prepare('INSERT OR REPLACE INTO profile (key, value) VALUES (?, ?)').run(key, String(value));
}

module.exports = {
  init,
  getTasks, saveTask, toggleTask, deleteTask,
  getMemory, saveMemory, deleteMemory,
  getHistory, saveMessage,
  getProfile, setProfile,
};
