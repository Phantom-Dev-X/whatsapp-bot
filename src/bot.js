/**
 * WhatsApp Bot - Baileys Connection Manager
 * Handles WhatsApp connection using @whiskeysockets/baileys
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

// ─── State ──────────────────────────────────────────────────
let isConnected = false;
let socketReady = false; // WebSocket connected but not yet authenticated

/**
 * Wait for socket to be ready for pairing code request
 */
function waitForSocket(maxWaitMs = 30000) {
  return new Promise((resolve, reject) => {
    if (socketReady || isConnected) {
      resolve();
      return;
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (socketReady || isConnected) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > maxWaitMs) {
        clearInterval(interval);
        reject(new Error('Timed out waiting for socket connection'));
      }
    }, 1000);
  });
}

/**
 * Connect to WhatsApp and return the socket + pairing function
 */
async function connectToWhatsApp() {
  // Ensure session directory exists
  if (!fs.existsSync(config.SESSION_DIR)) {
    fs.mkdirSync(config.SESSION_DIR, { recursive: true });
  }

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_DIR);

  // Fetch latest Baileys version
  const { version } = await fetchLatestBaileysVersion();
  console.log(`📦 Using Baileys version: ${version.join('.')}`);

  // Create in-memory store
  const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

  // Check if we already have a session (already paired before)
  const hasSession = state.creds?.registered;

  // Create socket
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: [config.BOT_NAME, 'Chrome', '1.0.0'],
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 25_000,
    emitOwnEvents: false,
    markOnlineOnConnect: true,
    fireInitQueries: true,
    // mobile: false, // pairing code mode
  });

  // Bind store
  store.bind(sock.ev);

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // ─── Connection Update Handler ─────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;

    if (connection) {
      console.log('Connection update:', connection);
    }

    if (connection === 'close') {
      socketReady = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        isConnected = false;
        setTimeout(() => connectToWhatsApp(), 5000);
      } else {
        console.log('🔴 Logged out. Delete session folder and restart.');
        isConnected = false;
      }
    } else if (connection === 'open') {
      isConnected = true;
      socketReady = true;
      console.log('✅ WhatsApp connected successfully!');
      console.log(`📱 Bot: ${sock.user?.id?.split('@')[0] || 'Unknown'}`);
    } else if (connection === 'connecting') {
      socketReady = false;
      isConnected = false;
      console.log('🔄 Connecting to WhatsApp servers...');
    }
  });

  // Mark socket as ready when creds are registered (even before full connection)
  sock.ev.on('creds.update', (update) => {
    if (update.registered) {
      socketReady = true;
    }
  });

  // ─── Message Handler ──────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip messages from self
      if (msg.key.fromMe) continue;

      // Skip status messages
      if (msg.key.remoteJid === 'status@broadcast') continue;

      // Skip if no message content
      if (!msg.message) continue;

      // Process anti-link check first
      await handleAntiLink(sock, msg);

      // Process commands
      await handleMessage(sock, msg);
    }
  });

  // ─── Group Update Handler (Welcome/Goodbye) ──────────
  sock.ev.on('group-participants.update', async (update) => {
    await handleGroupUpdate(sock, update);
  });

  // ─── Pairing Code Function with retry ────────────────
  const requestPairingCode = async (phone) => {
    if (isConnected) {
      return { error: 'Bot is already connected to WhatsApp. No pairing needed!' };
    }

    try {
      // Clean phone number - remove + and spaces
      const cleanPhone = phone.replace(/\+/g, '').replace(/\s/g, '');

      console.log(`🔗 Requesting pairing code for: ${cleanPhone}`);

      // Wait for socket to be ready (up to 30 seconds)
      // The WebSocket needs to connect to WhatsApp servers first
      await waitForSocket(30000);

      // Small delay to ensure everything is settled
      await new Promise(r => setTimeout(r, 1000));

      const code = await sock.requestPairingCode(cleanPhone);

      if (code) {
        console.log(`✅ Pairing code generated: ${code}`);
        return { code: code };
      } else {
        return { error: 'Failed to generate pairing code. Try again.' };
      }
    } catch (error) {
      console.error('Pairing code error:', error);

      // If it's a timeout, give a helpful message
      if (error.message?.includes('Timed out')) {
        return { error: 'Bot is still connecting to WhatsApp servers. Wait 10 seconds and try again.' };
      }

      // If it's a 429 or rate limit
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        return { error: 'Too many requests. Wait a minute and try again.' };
      }

      return { error: error.message || 'Failed to generate pairing code. Restart the bot and try again.' };
    }
  };

  // ─── Return Control Interface ────────────────────────
  return {
    sock,
    requestPairingCode,
    isConnected: () => isConnected,
  };
}

module.exports = { connectToWhatsApp };
