/**
 * WhatsApp Bot - Main Entry Point
 * Connects to WhatsApp, starts web pairing & Telegram pairing
 * 
 * Deploy on Render as a Web Service (free tier):
 *   - Render gives you a URL like https://yourapp.onrender.com
 *   - Web pairing page is at that URL
 *   - Telegram pairing starts automatically if TELEGRAM_BOT_TOKEN is set
 */

const config = require('./config');
const { connectToWhatsApp } = require('./src/bot');
const { startWebServer } = require('./src/web/server');
const { startTelegramBot } = require('./src/telegram/pairBot');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log(`║       🤖 ${config.BOT_NAME.padEnd(30)} ║`);
  console.log('║       WhatsApp Bot Started               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`📌 Prefix: ${config.PREFIX}`);
  console.log(`👤 Owner: ${config.OWNER_NAME}`);
  console.log('');

  try {
    // Start Web Pairing Server FIRST (so Render sees the port open)
    // We pass a dummy pairBot initially and update it later
    const pairBot = {
      _requestPairingCode: null,
      _isConnected: false,
      requestPairingCode: async function(phone) {
        if (this._requestPairingCode) {
          return this._requestPairingCode(phone);
        }
        return { error: 'Bot is still starting up. Wait a few seconds and try again.' };
      },
      isConnected: function() {
        return this._isConnected;
      },
    };

    console.log('🌐 Starting web pairing server...');
    startWebServer(pairBot);

    // Connect to WhatsApp
    console.log('🔄 Connecting to WhatsApp...');
    const waBot = await connectToWhatsApp();

    // Update pairBot with real functions
    pairBot._requestPairingCode = waBot.requestPairingCode;
    pairBot._isConnected = false;

    // Keep connection status synced
    const origIsConnected = waBot.isConnected;
    pairBot.isConnected = function() {
      const connected = origIsConnected();
      pairBot._isConnected = connected;
      return connected;
    };

    // Start Telegram Pairing Bot (if token is set)
    if (config.TELEGRAM_BOT_TOKEN) {
      console.log('🤖 Starting Telegram pairing bot...');
      startTelegramBot(pairBot);
    } else {
      console.log('⚠️  No TELEGRAM_BOT_TOKEN - Telegram pairing disabled');
      console.log('   Set TELEGRAM_BOT_TOKEN in environment to enable it');
    }

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('✅ Bot is ready!');
    console.log('');
    console.log('🌐 Web Pair: Open your Render URL in a browser');
    console.log('📱 Telegram: /pair <phone> to get pairing code');
    console.log('═══════════════════════════════════════════');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message || err);
});

// Start!
main();
