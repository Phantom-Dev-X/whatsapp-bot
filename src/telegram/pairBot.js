/**
 * Telegram Pairing Bot (Multi-Session)
 * Anyone can /pair and get their own bot instance
 */

const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config');
const sessionManager = require('../sessionManager');

function startTelegramBot() {
  if (!config.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ No TELEGRAM_BOT_TOKEN - Telegram pairing disabled');
    return;
  }

  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('🤖 Telegram pairing bot started!');

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'User';

    bot.sendMessage(chatId, `
👋 *Hey ${name}!*

I'm the pairing bot for *${config.BOT_NAME}*.

📌 *Commands:*
/pair <phone> — Get WhatsApp pairing code
/status — Check server status
/help — Help

💡 *Example:*
\`/pair 223XXXXXXXXX\`
\`/pair 234XXXXXXXXXX\`

🌍 *Any country works!*
    `, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/pair\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phone = match[1].replace(/\D/g, '');

    if (!phone || phone.length < 10) {
      bot.sendMessage(chatId, '❌ Invalid number. Use: `/pair 234XXXXXXXXXX`', { parse_mode: 'Markdown' });
      return;
    }

    if (config.TELEGRAM_CHAT_ID && String(chatId) !== String(config.TELEGRAM_CHAT_ID)) {
      bot.sendMessage(chatId, '❌ Not authorized.');
      return;
    }

    const waitMsg = await bot.sendMessage(chatId, '⏳ Generating pairing code...');

    try {
      const result = await sessionManager.createSession(phone);

      if (result.error) {
        bot.editMessageText(`❌ *Error:*\n${result.error}`, {
          chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown',
        });
      } else {
        bot.editMessageText(
          `✅ *Your WhatsApp Pairing Code:*\n\n` +
          `🔐 \`${result.code}\`\n\n` +
          `📱 *Steps:*\n` +
          `1️⃣ Open WhatsApp\n` +
          `2️⃣ Settings → Linked Devices\n` +
          `3️⃣ Tap "Link with phone number"\n` +
          `4️⃣ Enter the code above\n\n` +
          `⏰ Code expires in a few minutes!`,
          { chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown' }
        );
      }
    } catch (e) {
      bot.editMessageText('❌ Failed. Try again.', { chat_id: chatId, message_id: waitMsg.message_id });
    }
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const active = sessionManager.getActiveCount();
    const uptime = formatUptime(Date.now() - config.startTime);

    bot.sendMessage(chatId, `
📊 *${config.BOT_NAME} Status*

🟢 *Server:* Online
🤖 *Active bots:* ${active} / 50
⏱️ *Uptime:* ${uptime}
🌍 *Countries:* All supported
    `, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
🤖 *${config.BOT_NAME} Help*

/pair <phone> — Get WhatsApp pairing code
/status — Server status
/start — Welcome message

🌍 *Any country! Mali 🇲🇱, Nigeria 🇳🇬, Ghana 🇬🇭, USA 🇺🇸, etc.*

Example: \`/pair 223XXXXXXXXX\`
    `, { parse_mode: 'Markdown' });
  });

  bot.on('polling_error', (error) => {
    if (error.message && !error.message.includes('ETELEGRAM') && !error.message.includes('404')) {
      console.error('Telegram error:', error.message);
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
