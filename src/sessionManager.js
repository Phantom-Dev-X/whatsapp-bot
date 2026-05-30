/**
 * Session Manager - Handles multiple WhatsApp sessions
 * Each user gets their own Baileys connection + bot instance
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const config = require('../config');
const { handleMessage, handleAntiLink, handleGroupUpdate } = require('./commands');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
const MAX_SESSIONS = 50;

const activeSessions = new Map();

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function getSessionDir(phone) {
  const dir = path.join(SESSIONS_DIR, phone);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getActiveCount() {
  let count = 0;
  for (const [, s] of activeSessions) { if (s.connected) count++; }
  return count;
}

function getAllSessions() {
  const sessions = [];
  for (const [phone, s] of activeSessions) sessions.push({ phone, connected: s.connected });
  return sessions;
}

function hasSession(phone) { return activeSessions.has(phone); }
function isSessionConnected(phone) {
  const s = activeSessions.get(phone);
  return s ? s.connected : false;
}

/**
 * Set up event handlers for a socket (reused by create + reconnect)
 */
function setupSocketHandlers(sock, sessionObj, sessionDir, cleanPhone) {
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    console.log(`📡 [${cleanPhone}] connection: ${connection || 'waiting'}`);

    if (connection === 'close') {
      sessionObj.connected = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`🔴 [${cleanPhone}] Logged out. Removing session.`);
        activeSessions.delete(cleanPhone);
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
      } else {
        console.log(`❌ [${cleanPhone}] Disconnected (${statusCode}). Reconnecting in 5s...`);
        setTimeout(() => reconnectSession(cleanPhone), 5000);
      }
    } else if (connection === 'open') {
      sessionObj.connected = true;
      console.log(`✅ [${cleanPhone}] WhatsApp connected!`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (!msg.message) continue;
      await handleAntiLink(sock, msg, cleanPhone);
      await handleMessage(sock, msg, cleanPhone);
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    await handleGroupUpdate(sock, update, cleanPhone);
  });
}

/**
 * Try to request pairing code with retries
 * The WS takes a few seconds to fully connect after socket creation
 */
async function requestPairingCodeWithRetry(sock, phone, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔗 [${phone}] Attempt ${attempt}/${maxRetries} requesting pairing code...`);

      // Wait before trying (WS needs time to connect + handshake)
      const delay = attempt === 1 ? 5000 : 3000; // 5s first try, 3s for retries
      await new Promise(r => setTimeout(r, delay));

      const code = await sock.requestPairingCode(phone);

      if (code) {
        console.log(`✅ [${phone}] Pairing code: ${code}`);
        return { code };
      } else {
        console.log(`⚠️ [${phone}] No code returned on attempt ${attempt}`);
      }
    } catch (error) {
      console.log(`⚠️ [${phone}] Attempt ${attempt} failed: ${error.message}`);

      // If it's a rate limit, don't retry
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        return { error: 'Too many requests. Wait a minute and try again.' };
      }
    }
  }

  return { error: 'Failed to get pairing code after multiple tries. Please try again.' };
}

/**
 * Create a new WhatsApp session for a user
 */
async function createSession(phone) {
  const cleanPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return { error: 'Invalid phone number.' };
  }

  if (activeSessions.size >= MAX_SESSIONS && !activeSessions.has(cleanPhone)) {
    return { error: `Server full (${MAX_SESSIONS} max). Try later.` };
  }

  const existing = activeSessions.get(cleanPhone);
  if (existing && existing.connected) {
    return { error: 'This number is already paired and connected!' };
  }

  // If there's a pending session for this phone that's not connected, clean it up
  if (existing && existing.sock && !existing.connected) {
    try { existing.sock.end(undefined); } catch {}
    activeSessions.delete(cleanPhone);
  }

  try {
    const sessionDir = getSessionDir(cleanPhone);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`📦 [${cleanPhone}] Creating session (Baileys v${version.join('.')})`);

    const store = makeInMemoryStore({
      logger: pino().child({ level: 'silent', stream: 'store' })
    });

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: [config.BOT_NAME, 'Chrome', '1.0.0'],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      emitOwnEvents: false,
      markOnlineOnConnect: true,
      fireInitQueries: true,
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    const sessionObj = {
      phone: cleanPhone,
      sock,
      store,
      connected: false,
      startTime: Date.now(),
    };

    activeSessions.set(cleanPhone, sessionObj);
    setupSocketHandlers(sock, sessionObj, sessionDir, cleanPhone);

    // ─── Request pairing code with retries ─────────────
    const result = await requestPairingCodeWithRetry(sock, cleanPhone);
    return result;

  } catch (error) {
    console.error(`❌ [${cleanPhone}] Session error:`, error.message);

    if (error.message?.includes('429') || error.message?.includes('rate')) {
      return { error: 'Too many requests. Wait a minute and try again.' };
    }

    return { error: 'Failed to create session. Please try again.' };
  }
}

/**
 * Reconnect an existing session
 */
async function reconnectSession(phone) {
  const sessionDir = getSessionDir(phone);

  if (!fs.existsSync(path.join(sessionDir, 'creds.json'))) {
    activeSessions.delete(phone);
    return;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const store = makeInMemoryStore({
      logger: pino().child({ level: 'silent', stream: 'store' })
    });

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: [config.BOT_NAME, 'Chrome', '1.0.0'],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      emitOwnEvents: false,
      markOnlineOnConnect: true,
      fireInitQueries: true,
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    const sessionObj = activeSessions.get(phone) || {
      phone, connected: false, startTime: Date.now(),
    };
    sessionObj.sock = sock;
    sessionObj.store = store;
    sessionObj.connected = false;

    activeSessions.set(phone, sessionObj);
    setupSocketHandlers(sock, sessionObj, sessionDir, phone);

  } catch (error) {
    console.error(`❌ [${phone}] Reconnect error:`, error.message);
    setTimeout(() => reconnectSession(phone), 15000);
  }
}

/**
 * Restore all saved sessions on startup
 */
async function restoreSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return;

  const dirs = fs.readdirSync(SESSIONS_DIR);
  let restored = 0;

  for (const dir of dirs) {
    const sessionDir = path.join(SESSIONS_DIR, dir);
    const credsFile = path.join(sessionDir, 'creds.json');

    if (fs.existsSync(credsFile) && fs.statSync(credsFile).size > 0) {
      try {
        const { state } = await useMultiFileAuthState(sessionDir);
        if (state.creds?.registered) {
          console.log(`🔄 Restoring: ${dir}`);
          activeSessions.set(dir, { phone: dir, connected: false, startTime: Date.now() });
          setTimeout(() => reconnectSession(dir), restored * 3000);
          restored++;
        }
      } catch (e) {
        console.log(`⚠️ Restore failed for ${dir}:`, e.message);
      }
    }
  }

  console.log(`🔄 Restoring ${restored} saved session(s)...`);
}

async function deleteSession(phone) {
  const session = activeSessions.get(phone);
  if (session?.sock) { try { await session.sock.logout(); } catch {} }
  activeSessions.delete(phone);
  try { fs.rmSync(getSessionDir(phone), { recursive: true, force: true }); } catch {}
  console.log(`🗑️ [${phone}] Session deleted.`);
}

module.exports = {
  createSession, restoreSessions, getAllSessions,
  getActiveCount, hasSession, isSessionConnected, deleteSession, activeSessions,
};
