/**
 * Command Handler for WhatsApp Bot
 * Handles all commands with . prefix
 * Supports multiple sessions (each user has their own bot)
 */

const config = require('../../config');
const Wbails = require('../utils/wbails');
const fs = require('fs');
const path = require('path');

// ─── Group Settings Storage ──────────────────────────────────
const SETTINGS_DIR = path.join(__dirname, '..', 'sessions');

function getSettingsPath(sessionPhone) {
  const dir = path.join(SETTINGS_DIR, sessionPhone);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'groupSettings.json');
}

function loadSettings(sessionPhone) {
  try {
    const file = getSettingsPath(sessionPhone);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveSettings(sessionPhone, settings) {
  try {
    const file = getSettingsPath(sessionPhone);
    fs.writeFileSync(file, JSON.stringify(settings, null, 2));
  } catch (e) {}
}

function getGroupSettings(sessionPhone, groupId) {
  const settings = loadSettings(sessionPhone);
  if (!settings[groupId]) {
    settings[groupId] = { antilink: false, welcome: false };
    saveSettings(sessionPhone, settings);
  }
  return settings[groupId];
}

function setGroupSettings(sessionPhone, groupId, key, value) {
  const settings = loadSettings(sessionPhone);
  if (!settings[groupId]) {
    settings[groupId] = { antilink: false, welcome: false };
  }
  settings[groupId][key] = value;
  saveSettings(sessionPhone, settings);
  return settings[groupId];
}

// ─── Helper Functions ────────────────────────────────────────

function getText(msg) {
  if (!msg.message) return '';
  const type = Object.keys(msg.message)[0];
  switch (type) {
    case 'conversation':
      return msg.message.conversation || '';
    case 'extendedTextMessage':
      return msg.message.extendedTextMessage?.text || '';
    case 'listResponseMessage':
      return msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
    case 'buttonsResponseMessage':
      return msg.message.buttonsResponseMessage?.selectedButtonId || '';
    case 'interactiveResponseMessage':
      try {
        const params = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
        if (params) {
          const parsed = JSON.parse(params);
          return parsed.id || params;
        }
      } catch {}
      return '';
    default:
      return '';
  }
}

function getSenderJid(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function isGroup(jid) {
  return jid && jid.endsWith('@g.us');
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

// ─── Command Map ─────────────────────────────────────────────

const commands = {

  // ═══════════════════════════════════════════
  //  GENERAL COMMANDS
  // ═══════════════════════════════════════════

  ping: {
    name: 'ping',
    description: 'Check bot speed',
    category: 'general',
    handler: async (sock, msg, args, sessionPhone) => {
      const start = Date.now();
      const jid = msg.key.remoteJid;
      const sent = await sock.sendMessage(jid, { text: '🏓 Pinging...' }, { quoted: msg });
      const latency = Date.now() - start;
      await sock.sendMessage(jid, {
        text: `🏓 *Pong!*\n⚡ Speed: *${latency}ms*\n🟢 Status: Online`,
        edit: sent.key,
      });
    },
  },

  dev: {
    name: 'dev',
    description: 'Developer info',
    category: 'general',
    handler: async (sock, msg, args, sessionPhone) => {
      const jid = msg.key.remoteJid;
      const text = `
👨‍💻 *Developer Info*

🧑 *Name:* ${config.OWNER_NAME}
📱 *Number:* ${config.OWNER_NUMBER}
🤖 *Bot:* ${config.BOT_NAME}
📦 *Lib:* @whiskeysockets/baileys
🔧 *Node:* ${process.version}
⚡ *Uptime:* ${formatUptime(Date.now() - config.startTime)}

_Made with ❤️ by ${config.OWNER_NAME}_
      `.trim();
      await sock.sendMessage(jid, { text }, { quoted: msg });
    },
  },

  alive: {
    name: 'alive',
    description: 'Check bot status',
    category: 'general',
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const uptime = formatUptime(Date.now() - config.startTime);
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const text = `
✅ *${config.BOT_NAME} is Alive!*

⏱️ *Uptime:* ${uptime}
💾 *Memory:* ${mem} MB
🔧 *Node:* ${process.version}
🟢 *Status:* Online & Running

_Type ${config.PREFIX}menu for commands_
      `.trim();
      await sock.sendMessage(jid, { text }, { quoted: msg });
    },
  },

  owner: {
    name: 'owner',
    description: 'Get owner contact',
    category: 'general',
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const vcard =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${config.OWNER_NAME}\n` +
        `TEL;type=CELL;type=VOICE;waid=${config.OWNER_NUMBER}:+${config.OWNER_NUMBER}\n` +
        'END:VCARD';
      await sock.sendMessage(jid, {
        contacts: {
          displayName: config.OWNER_NAME,
          contacts: [{ vcard }],
        },
      }, { quoted: msg });
    },
  },

  menu: {
    name: 'menu',
    description: 'Show interactive command menu',
    category: 'general',
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      const wbails = new Wbails(sock);

      const sections = [
        {
          title: '🌟 General Commands',
          rows: [
            { title: '.ping', description: 'Check bot speed', id: '.ping' },
            { title: '.alive', description: 'Bot status & uptime', id: '.alive' },
            { title: '.dev', description: 'Developer information', id: '.dev' },
            { title: '.owner', description: 'Get owner contact', id: '.owner' },
          ],
        },
        {
          title: '👥 Group Commands',
          rows: [
            { title: '.groupinfo', description: 'Group information', id: '.groupinfo' },
            { title: '.admins', description: 'List group admins', id: '.admins' },
            { title: '.tagall', description: 'Tag all members', id: '.tagall' },
            { title: '.hidetag', description: 'Hidden tag all', id: '.hidetag' },
            { title: '.promote', description: 'Promote to admin (reply)', id: '.promote' },
            { title: '.demote', description: 'Demote admin (reply)', id: '.demote' },
            { title: '.kick', description: 'Remove member (reply)', id: '.kick' },
          ],
        },
        {
          title: '⚙️ Settings',
          rows: [
            { title: '.antilink', description: 'Toggle anti-link', id: '.antilink' },
            { title: '.welcome', description: 'Toggle welcome messages', id: '.welcome' },
          ],
        },
      ];

      await wbails.sendList(jid, {
        title: `🤖 ${config.BOT_NAME}`,
        text: `
👋 *Welcome to ${config.BOT_NAME}!*

📌 *Prefix:* ${config.PREFIX}
📋 *Total Commands:* ${Object.keys(commands).length}
⏱️ *Uptime:* ${formatUptime(Date.now() - config.startTime)}

_Tap the button below to see commands_
        `.trim(),
        footer: `© ${config.BOT_NAME} | by ${config.OWNER_NAME}`,
        buttonText: '📋 View Commands',
        sections,
      }, msg);
    },
  },

  // ═══════════════════════════════════════════
  //  GROUP COMMANDS
  // ═══════════════════════════════════════════

  groupinfo: {
    name: 'groupinfo',
    description: 'Get group information',
    category: 'group',
    groupOnly: true,
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      try {
        const metadata = await sock.groupMetadata(jid);
        const admins = metadata.participants.filter(p => p.admin);
        const text = `
📊 *Group Information*

📛 *Name:* ${metadata.subject}
🆔 *ID:* ${jid}
👥 *Members:* ${metadata.participants.length}
👑 *Admins:* ${admins.length}
📅 *Created:* ${new Date(metadata.creation * 1000).toLocaleString()}
👤 *Owner:* ${metadata.owner ? '@' + metadata.owner.split('@')[0] : 'Unknown'}
📝 *Desc:* ${metadata.desc || 'No description'}

${metadata.restrict ? '🔒 Only admins can edit group info' : '🔓 Anyone can edit group info'}
${metadata.announce ? '🔇 Only admins can send messages' : '🔊 Anyone can send messages'}
        `.trim();
        await sock.sendMessage(jid, { text }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Could not fetch group info.' }, { quoted: msg });
      }
    },
  },

  admins: {
    name: 'admins',
    description: 'List group admins',
    category: 'group',
    groupOnly: true,
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      try {
        const metadata = await sock.groupMetadata(jid);
        const admins = metadata.participants.filter(p => p.admin);
        let text = `👑 *Group Admins (${admins.length})*\n\n`;
        admins.forEach((admin) => {
          const role = admin.admin === 'superadmin' ? '🌟' : '👑';
          text += `${role} @${admin.id.split('@')[0]}\n`;
        });
        await sock.sendMessage(jid, { text, mentions: admins.map(a => a.id) }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Could not fetch admins.' }, { quoted: msg });
      }
    },
  },

  tagall: {
    name: 'tagall',
    description: 'Tag all group members',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      try {
        const metadata = await sock.groupMetadata(jid);
        const participants = metadata.participants;
        const message = args || '';
        let text = `📢 *TAG ALL*\n\n`;
        if (message) text += `${message}\n\n`;
        participants.forEach(p => { text += `@${p.id.split('@')[0]}\n`; });
        await sock.sendMessage(jid, { text, mentions: participants.map(p => p.id) }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Could not tag all.' }, { quoted: msg });
      }
    },
  },

  hidetag: {
    name: 'hidetag',
    description: 'Hidden tag all members',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;
      try {
        const metadata = await sock.groupMetadata(jid);
        const participants = metadata.participants;
        const message = args || 'Attention everyone!';
        await sock.sendMessage(jid, { text: message, mentions: participants.map(p => p.id) }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Could not hidetag.' }, { quoted: msg });
      }
    },
  },

  promote: {
    name: 'promote',
    description: 'Promote member to admin (reply)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      try {
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant
          || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) {
          await sock.sendMessage(jid, { text: '❌ Reply to a message or tag the person you want to promote.' }, { quoted: msg });
          return;
        }
        await sock.groupParticipantsUpdate(jid, [target], 'promote');
        await sock.sendMessage(jid, { text: `✅ @${target.split('@')[0]} has been promoted to admin!`, mentions: [target] }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Failed to promote. Make sure I am admin.' }, { quoted: msg });
      }
    },
  },

  demote: {
    name: 'demote',
    description: 'Demote admin (reply)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      try {
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant
          || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) {
          await sock.sendMessage(jid, { text: '❌ Reply to a message or tag the person you want to demote.' }, { quoted: msg });
          return;
        }
        await sock.groupParticipantsUpdate(jid, [target], 'demote');
        await sock.sendMessage(jid, { text: `✅ @${target.split('@')[0]} has been demoted from admin.`, mentions: [target] }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Failed to demote. Make sure I am admin.' }, { quoted: msg });
      }
    },
  },

  kick: {
    name: 'kick',
    description: 'Remove member (reply)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg) => {
      const jid = msg.key.remoteJid;
      try {
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant
          || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) {
          await sock.sendMessage(jid, { text: '❌ Reply to a message or tag the person you want to kick.' }, { quoted: msg });
          return;
        }
        await sock.groupParticipantsUpdate(jid, [target], 'remove');
        await sock.sendMessage(jid, { text: `✅ @${target.split('@')[0]} has been removed.`, mentions: [target] }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Failed to kick. Make sure I am admin.' }, { quoted: msg });
      }
    },
  },

  // ═══════════════════════════════════════════
  //  SETTINGS COMMANDS
  // ═══════════════════════════════════════════

  antilink: {
    name: 'antilink',
    description: 'Toggle anti-link',
    category: 'settings',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg, args, sessionPhone) => {
      const jid = msg.key.remoteJid;
      const current = getGroupSettings(sessionPhone, jid);

      if (args === 'on') {
        setGroupSettings(sessionPhone, jid, 'antilink', true);
        await sock.sendMessage(jid, { text: '✅ *Anti-link enabled!* Links will be deleted.' }, { quoted: msg });
      } else if (args === 'off') {
        setGroupSettings(sessionPhone, jid, 'antilink', false);
        await sock.sendMessage(jid, { text: '❌ *Anti-link disabled.*' }, { quoted: msg });
      } else {
        const status = current.antilink ? 'ON ✅' : 'OFF ❌';
        await sock.sendMessage(jid, { text: `🔗 *Anti-link Status:* ${status}\n\n_Use ${config.PREFIX}antilink on/off_` }, { quoted: msg });
      }
    },
  },

  welcome: {
    name: 'welcome',
    description: 'Toggle welcome messages',
    category: 'settings',
    groupOnly: true,
    adminOnly: true,
    handler: async (sock, msg, args, sessionPhone) => {
      const jid = msg.key.remoteJid;
      const current = getGroupSettings(sessionPhone, jid);

      if (args === 'on') {
        setGroupSettings(sessionPhone, jid, 'welcome', true);
        await sock.sendMessage(jid, { text: '✅ *Welcome messages enabled!*' }, { quoted: msg });
      } else if (args === 'off') {
        setGroupSettings(sessionPhone, jid, 'welcome', false);
        await sock.sendMessage(jid, { text: '❌ *Welcome messages disabled.*' }, { quoted: msg });
      } else {
        const status = current.welcome ? 'ON ✅' : 'OFF ❌';
        await sock.sendMessage(jid, { text: `👋 *Welcome Status:* ${status}\n\n_Use ${config.PREFIX}welcome on/off_` }, { quoted: msg });
      }
    },
  },
};

// ─── Main Message Handler ────────────────────────────────────

async function handleMessage(sock, msg, sessionPhone) {
  try {
    const text = getText(msg);
    if (!text) return;

    const PREFIX = config.PREFIX;
    if (!text.startsWith(PREFIX)) return;

    const body = text.slice(PREFIX.length).trim();
    if (!body) return;

    const [command, ...argParts] = body.split(/\s+/);
    const args = argParts.join(' ');
    const cmd = command.toLowerCase();

    const jid = msg.key.remoteJid;

    const cmdObj = commands[cmd];
    if (!cmdObj) return;

    // Group-only check
    if (cmdObj.groupOnly && !isGroup(jid)) {
      await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      return;
    }

    // Admin-only check
    if (cmdObj.adminOnly && isGroup(jid)) {
      const metadata = await sock.groupMetadata(jid);
      const sender = getSenderJid(msg);
      const isAdmin = metadata.participants.find(
        p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
      );
      if (!isAdmin) {
        await sock.sendMessage(jid, { text: '❌ This command is for admins only.' }, { quoted: msg });
        return;
      }
    }

    await cmdObj.handler(sock, msg, args, sessionPhone);
  } catch (error) {
    console.error('Command handler error:', error);
  }
}

// ─── Anti-link Handler ───────────────────────────────────────

async function handleAntiLink(sock, msg, sessionPhone) {
  try {
    const jid = msg.key.remoteJid;
    if (!isGroup(jid)) return;

    const settings = getGroupSettings(sessionPhone, jid);
    if (!settings.antilink) return;

    const metadata = await sock.groupMetadata(jid);
    const sender = getSenderJid(msg);
    const isAdmin = metadata.participants.find(
      p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    if (isAdmin) return;

    const linkRegex = /(https?:\/\/|chat\.whatsapp\.com|wa\.me|t\.me|www\.)/i;
    const text = getText(msg);
    if (linkRegex.test(text)) {
      await sock.sendMessage(jid, { delete: msg.key });
      await sock.sendMessage(jid, {
        text: `⚠️ @${sender.split('@')[0]} links are not allowed here!`,
        mentions: [sender],
      });
    }
  } catch (error) {
    console.error('Anti-link error:', error);
  }
}

// ─── Welcome Handler ─────────────────────────────────────────

async function handleGroupUpdate(sock, update, sessionPhone) {
  try {
    const { id, participants, action } = update;
    if (!isGroup(id)) return;

    const settings = getGroupSettings(sessionPhone, id);
    if (!settings.welcome) return;

    if (action === 'add') {
      for (const participant of participants) {
        await sock.sendMessage(id, {
          text: `👋 *Welcome!*\n\n🎉 @${participant.split('@')[0]} has joined!\n\n_Type ${config.PREFIX}menu to see commands._`,
          mentions: [participant],
        });
      }
    } else if (action === 'remove') {
      for (const participant of participants) {
        await sock.sendMessage(id, {
          text: `👋 @${participant.split('@')[0]} has left the group.`,
          mentions: [participant],
        });
      }
    }
  } catch (error) {
    console.error('Welcome handler error:', error);
  }
}

module.exports = { handleMessage, handleAntiLink, handleGroupUpdate, commands, getText };
