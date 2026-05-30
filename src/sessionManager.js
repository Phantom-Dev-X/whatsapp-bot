/**
 * Session Manager - Handles multiple WhatsApp sessions
 * Each user gets their own Baileys connection + bot instance
 * FIXED: Properly waits for WebSocket connection before requesting pairing code
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

// phone -> { sock, connected, startTime }
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
 * Wait for Baileys WebSocket to connect to WhatsApp servers
 * Returns true if connected, false if timed out
 */
function waitForWSConnection(sock, maxWaitMs = 15000) {
  return new Promise((resolve) => {
    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      sock.ev.off('connection.update', handler);
      resolve(result);
    };

    const handler = (update) => {
      // 'connecting' = WS connected, handshaking with WhatsApp
      // 'open' = fully authenticated (existing session)
      // Either one means we can call requestPairingCode
      if (update.connection === 'connecting' || update.connection === 'open') {
        done(true);
      }
    };

    sock.ev.on('connection.update', handler);

    // Safety timeout
    setTimeout(() => done(false), maxWaitMs);
  });
}

/**
 * Set up event handlers for a socket (reused by create + reconnect)
 */
function setupSocketHandlers(sock, sessionObj, sessionDir, cleanPhone) {
  // ─── Connection Updates ────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

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
      console.log(`✅ [${cleanPhone}] Connected!`);
    }
  });

  // ─── Messages ──────────────────────────────────────────
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

  // ─── Group Updates (Welcome/Goodbye) ──────────────────
  sock.ev.on('group-participants.update', async (update) => {
    await handleGroupUpdate(sock, update, cleanPhone);
  });
}

/**
 * Create a new WhatsApp session for a user
 * Returns { code } on success, { error } on failure
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

  try {
    const sessionDir = getSessionDir(cleanPhone);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`📦 [${cleanPhone}] Baileys v${version.join('.')}`);

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

    // ─── Wait for WebSocket to connect to WhatsApp ──────
    console.log(`🔗 [${cleanPhone}] Waiting for WS connection...`);

    const wsReady = await waitForWSConnection(sock, 15000);

    if (!wsReady) {
      console.log(`❌ [${cleanPhone}] WS connection timeout`);
      return { error: 'Could not reach WhatsApp servers. Check internet and try again.' };
    }

    console.log(`🔗 [${cleanPhone}] WS connected! Requesting pairing code...`);

    // Small settle delay to ensure handshake completes
    await new Promise(r => setTimeout(r, 2000));

    // ─── Request Pairing Code ────────────────────────────
    const code = await sock.requestPairingCode(cleanPhone);

    if (code) {
      console.log(`✅ [${cleanPhone}] Pairing code: ${code}`);
      return { code };
    } else {
      return { error: 'Failed to generate pairing code. Try again.' };
    }

  } catch (error) {
    console.error(`❌ [${cleanPhone}] Error:`, error.message);

    if (error.message?.includes('429') || error.message?.includes('rate')) {
      return { error: 'Too many requests. Wait a minute and try again.' };
    }
    if (error.message?.includes('Timed Out') || error.message?.includes('timeout')) {
      return { error: 'Connection timed out. Try again.' };
    }

    return { error: 'Failed to pair. Try again or restart the bot.' };
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
