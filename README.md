# 🤖 WhatsApp Bot

A WhatsApp bot built with **Node.js** + **@whiskeysockets/baileys** featuring:
- 🔗 **Web Pairing** — Beautiful website (your Render URL) to get pairing code
- 📱 **Telegram Pairing** — Get pairing code via Telegram bot (works immediately when token is set)
- 📋 **Interactive v4 Menu** — Native flow buttons that never fail on any client version
- 👥 **Full Group Commands** — tagall, hidetag, promote, kick, etc.

---

## 🚀 Quick Deploy to Render (Free)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Create Render Web Service
1. Go to [render.com](https://render.com) → New → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Name:** Your bot name
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

### Step 3: Set Environment Variables
In Render → Environment:

| Variable | Value |
|----------|-------|
| `BOT_NAME` | `YourBotName` |
| `OWNER_NAME` | `Your Name` |
| `OWNER_NUMBER` | `234XXXXXXXXXX` |
| `TELEGRAM_BOT_TOKEN` | Get from @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (optional, restricts to you) |
| `PREFIX` | `.` |

> ⚡ Render will automatically set `PORT` — don't add it manually

### Step 4: Pair Your WhatsApp
1. Render gives you a URL like `https://yourapp.onrender.com`
2. Open that URL → Enter your phone number → Get pairing code
3. **OR** Send `/pair 234XXXXXXXXXX` to your Telegram bot
4. Open WhatsApp → Settings → Linked Devices → Link with phone number
5. Enter the code ✅

---

## 📱 Pairing Methods

### 🌐 Web Pair (Render URL)
- Open `https://yourapp.onrender.com`
- Enter your phone number (no +)
- Click "Get Pairing Code"
- Enter code in WhatsApp

### 📱 Telegram Pair
- Send `/pair 234XXXXXXXXXX` to your Telegram bot
- Copy the code
- Enter in WhatsApp → Linked Devices → Link with phone number

> Both methods work immediately. The token just needs to be in Render's environment variables.

---

## 📋 Commands

### General
| Command | Description |
|---------|-------------|
| `.ping` | Check bot speed/latency |
| `.dev` | Developer information |
| `.alive` | Bot status & uptime |
| `.owner` | Get owner contact card |
| `.menu` | Interactive command menu (v4 buttons overlay) |

### Group
| Command | Description |
|---------|-------------|
| `.groupinfo` | Group information |
| `.admins` | List group admins |
| `.tagall [msg]` | Tag all members with message |
| `.hidetag [msg]` | Hidden tag all members |
| `.promote` | Promote to admin (reply to user) |
| `.demote` | Demote admin (reply to user) |
| `.kick` | Remove member (reply to user) |

### Settings (Group Admins Only)
| Command | Description |
|---------|-------------|
| `.antilink on/off` | Toggle anti-link (auto-deletes links) |
| `.welcome on/off` | Toggle welcome/goodbye messages |

---

## 📁 Project Structure

```
├── index.js              # Entry point
├── config.js             # Configuration (reads from .env)
├── package.json          # Dependencies
├── .env.example          # Environment template
├── session/              # WhatsApp auth (auto-created, DO NOT DELETE)
├── groupSettings.json    # Group settings (auto-created)
└── src/
    ├── bot.js            # Baileys connection + pairing with retry
    ├── commands/
    │   └── index.js      # All 12 commands + handlers
    ├── utils/
    │   └── wbails.js     # InteractiveMessage v4 helper
    ├── web/
    │   └── server.js     # Web pairing (Express + beautiful UI)
    └── telegram/
        └── pairBot.js    # Telegram pairing bot
```

---

## 🔧 How Telegram Pair Works

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get the bot token
3. Add `TELEGRAM_BOT_TOKEN` to Render environment variables
4. Render redeploys automatically
5. Send `/pair 234XXXXXXXXXX` to your bot
6. Get the pairing code instantly!

> If you set `TELEGRAM_CHAT_ID`, only you can use the bot. Leave empty to allow anyone.

---

## 📌 Notes

- **Render Free Tier:** Spins down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds to wake up.
- **Session:** Stored in `session/` folder. On Render free tier, this resets on each deploy. To persist, consider using a database or Render Disk (paid).
- **wbails.js:** Custom helper for interactiveMessage v4 — works on ALL WhatsApp versions, no failures.
- **Group commands** like kick/promote require the bot to be a group admin.
