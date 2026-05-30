/**
 * Telegram Pairing Bot
 * Users can request a WhatsApp pairing code via Telegram
 * 
 * Commands:
 *   /start  - Welcome message
 *   /pair <phone> - Request pairing code
 *   /status - Check bot connection status
 * 
 * Works in both private messages and groups (if TELEGRAM_CHAT_ID not set)
 * If TELEGRAM_CHAT_ID is set, only that chat/user can use it
 */

const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config');

function startTelegramBot(pairBot) {
  if (!config.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ No TELEGRAM_BOT_TOKEN set. Telegram pairing disabled.');
    return;
  }

  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

  console.log('🤖 Telegram pairing bot started!');
  console.log('   Token is active, listening for commands...');

  // ─── /start Command ──────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'User';

    bot.sendMessage(chatId, `
👋 *Hey ${name}!*

I'm the pairing bot for *${config.BOT_NAME}* WhatsApp bot.

📌 *Commands:*
/pair <phone> - Get WhatsApp pairing code
/status - Check bot connection status

💡 *Example:*
\`/pair 234XXXXXXXXXX\`

⚠️ Your phone number without the +
    `, {
      parse_mode: 'Markdown',
    });
  });

  // ─── /pair Command ───────────────────────────────────────
  bot.onText(/\/pair\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phone = match[1].replace(/\D/g, '');

    if (!phone || phone.length < 10) {
      bot.sendMessage(chatId, '❌ Invalid phone number. Use format:\n`/pair 234XXXXXXXXXX`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    // If TELEGRAM_CHAT_ID is set, only allow that chat
    if (config.TELEGRAM_CHAT_ID && String(chatId) !== String(config.TELEGRAM_CHAT_ID)) {
      bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
      return;
    }

    const waitMsg = await bot.sendMessage(chatId, '⏳ Generating pairing code...');

    try {
      const result = await pairBot.requestPairingCode(phone);

      if (result.error) {
        bot.editMessageText(`❌ *Error:*\n${result.error}`, {
          chat_id: chatId,
          message_id: waitMsg.message_id,
          parse_mode: 'Markdown',
        });
      } else {
        bot.editMessageText(
          `✅ *Your WhatsApp Pairing Code:*\n\n` +
          `🔐 \`${result.code}\`\n\n` +
          `📱 *Steps:*\n` +
          `1️⃣ Open WhatsApp\n` +
          `2️⃣ Go to ⚙️ Settings → Linked Devices\n` +
          `3️⃣ Tap "Link with phone number"\n` +
          `4️⃣ Enter the code above\n\n` +
          `⏰ Code expires in a few minutes!`,
          {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'Markdown',
          }
        );
      }
    } catch (e) {
      bot.editMessageText('❌ Failed to generate code. Try again or restart the bot.', {
        chat_id: chatId,
        message_id: waitMsg.message_id,
      });
    }
  });

  // ─── /status Command ─────────────────────────────────────
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const connected = pairBot.isConnected();
    const uptime = formatUptime(Date.now() - config.startTime);

    bot.sendMessage(chatId, `
📊 *${config.BOT_NAME} Status*

${connected ? '🟢 *Connected*' : '🔴 *Disconnected*'}
⏱️ Uptime: ${uptime}
🔧 Node: ${process.version}
    `, { parse_mode: 'Markdown' });
  });

  // ─── /help Command ───────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
🤖 *${config.BOT_NAME} Pairing Bot Help*

/pair <phone> - Get a WhatsApp pairing code
/status - Check if WhatsApp bot is connected
/start - Welcome message

📝 *Note:* Replace <phone> with your full phone number including country code (no +)
Example: \`/pair 234XXXXXXXXXX\`
    `, { parse_mode: 'Markdown' });
  });

  // Error handling
  bot.on('polling_error', (error) => {
    // Don't spam logs for common errors
    if (error.message && !error.message.includes('ETELEGRAM') && !error.message.includes('404')) {
      console.error('Telegram polling error:', error.message);
    }
  });

  return bot;
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

module.exports = { startTelegramBot };
