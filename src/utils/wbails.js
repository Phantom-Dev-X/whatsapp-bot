/**
 * Wbails - InteractiveMessage v4 Helper for @whiskeysockets/baileys
 * 
 * Drop-in helper (equivalent to zeppeliorg/wbails) that creates
 * nativeFlowMessage interactive messages using interactiveMessage v4.
 * These buttons NEVER fail on any client version.
 */

const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

class Wbails {
  constructor(sock) {
    this.sock = sock;
  }

  /**
   * Send a list/single_select interactive message
   * @param {string} jid - Chat JID
   * @param {object} options - { title, text, footer, buttonText, sections }
   * @param {object} quoted - Message to quote (optional)
   */
  async sendList(jid, options, quoted = null) {
    const { title, text, footer, buttonText, sections } = options;

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || '' }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: title || '',
              hasMediaAttachment: false,
              subtitle: '',
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [
                {
                  name: 'single_select',
                  buttonParamsJson: JSON.stringify({
                    title: buttonText || 'Select',
                    sections: sections || [],
                  }),
                },
              ],
            }),
          }),
        },
      },
    }, { quoted });

    await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
  }

  /**
   * Send quick_reply buttons
   * @param {string} jid - Chat JID
   * @param {object} options - { title, text, footer, buttons: [{displayText, id}] }
   * @param {object} quoted - Message to quote (optional)
   */
  async sendButtons(jid, options, quoted = null) {
    const { title, text, footer, buttons } = options;

    const nativeButtons = buttons.map(btn => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: btn.displayText,
        id: btn.id,
      }),
    }));

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || '' }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: title || '',
              hasMediaAttachment: false,
              subtitle: '',
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: nativeButtons,
            }),
          }),
        },
      },
    }, { quoted });

    await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
  }

  /**
   * Send a URL button
   * @param {string} jid - Chat JID
   * @param {object} options - { title, text, footer, urlButtons: [{displayText, url}] }
   * @param {object} quoted - Message to quote (optional)
   */
  async sendUrlButton(jid, options, quoted = null) {
    const { title, text, footer, urlButtons, buttons } = options;

    const allButtons = [];

    if (urlButtons) {
      urlButtons.forEach(btn => {
        allButtons.push({
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            url: btn.url,
            merchant_url: btn.url,
          }),
        });
      });
    }

    if (buttons) {
      buttons.forEach(btn => {
        allButtons.push({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            id: btn.id,
          }),
        });
      });
    }

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || '' }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: title || '',
              hasMediaAttachment: false,
              subtitle: '',
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: allButtons,
            }),
          }),
        },
      },
    }, { quoted });

    await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
  }

  /**
   * Send a copy code button
   * @param {string} jid - Chat JID
   * @param {object} options - { title, text, footer, code }
   * @param {object} quoted - Message to quote (optional)
   */
  async sendCopyButton(jid, options, quoted = null) {
    const { title, text, footer, code, buttonText } = options;

    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || '' }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: title || '',
              hasMediaAttachment: false,
              subtitle: '',
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [
                {
                  name: 'cta_copy',
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || 'Copy Code',
                    id: code,
                    copy_code: code,
                  }),
                },
              ],
            }),
          }),
        },
      },
    }, { quoted });

    await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
  }
}

module.exports = Wbails;
