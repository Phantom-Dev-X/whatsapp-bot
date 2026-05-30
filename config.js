const fs = require('fs');
const path = require('path');

// Load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

module.exports = {
  BOT_NAME: process.env.BOT_NAME || 'FlashBot',
  OWNER_NAME: process.env.OWNER_NAME || 'Developer',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '234XXXXXXXXXX',
  PREFIX: process.env.PREFIX || '.',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  PORT: process.env.PORT || 3000,
  SESSION_DIR: path.join(__dirname, 'session'),
  startTime: Date.now(),
};
