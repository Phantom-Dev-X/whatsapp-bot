/**
 * WhatsApp Bot - Multi-User Platform
 * 
 * Anyone can pair their WhatsApp and get their own bot instance!
 * Works worldwide — Nigeria, Mali, Ghana, USA, India, etc.
 * 
 * Deploy on Render as a free Web Service:
 *   - Render gives you https://yourapp.onrender.com
 *   - Users visit that URL to pair
 *   - Telegram /pair also works if token is set
 */

const config = require('./config');
const { startWebServer } = require('./src/web/server');
const { startTelegramBot } = require('./src/telegram/pairBot');
const { restoreSessions } = require('./src/sessionManager');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║       🤖 ${config.BOT_NAME.padEnd(34)} ║`);
  console.log('║       Multi-User WhatsApp Bot Platform       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`📌 Prefix: ${config.PREFIX}`);
  console.log(`👤 Owner: ${config.OWNER_NAME}`);
  console.log(`🌍 Countries: ALL — worldwide!`);
  console.log('');

  try {
    // Start web server first (Render needs port open)
    console.log('🌐 Starting web server...');
    startWebServer();

    // Restore any existing sessions from before restart
    console.log('🔄 Restoring saved sessions...');
    await restoreSessions();

    // Start Telegram bot (if token set)
    if (config.TELEGRAM_BOT_TOKEN) {
      console.log('🤖 Starting Telegram pairing bot...');
      startTelegramBot();
    } else {
      console.log('⚠️  No TELEGRAM_BOT_TOKEN — Telegram pairing disabled');
    }

    console.log('');
    console.log('════════════════════════════════════════════════');
    console.log('✅ Bot platform is ready!');
    console.log('');
    console.log('🌐 Web Pair: Open your Render URL in a browser');
    console.log('📱 Telegram: /pair <phone> to get pairing code');
    console.log('🌍 Works worldwide — ANY country can pair!');
    console.log('════════════════════════════════════════════════');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => console.error('Uncaught:', err.message || err));
process.on('unhandledRejection', (err) => console.error('Rejected:', err.message || err));

main();
