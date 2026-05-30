/**
 * Web Pairing Server
 * Serves a website where users can enter their phone number
 * and receive a WhatsApp pairing code
 */

const express = require('express');
const config = require('../../config');

function startWebServer(pairBot) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── HTML Pairing Page ───────────────────────────────────
  const pairPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.BOT_NAME} - Pair</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 40px;
      width: 90%;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
    }
    .logo {
      font-size: 48px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 4px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: #888;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .status-online {
      background: rgba(37, 211, 102, 0.15);
      color: #25D366;
      border: 1px solid rgba(37, 211, 102, 0.3);
    }
    .status-offline {
      background: rgba(255, 82, 82, 0.15);
      color: #FF5252;
      border: 1px solid rgba(255, 82, 82, 0.3);
    }
    .input-group {
      position: relative;
      margin-bottom: 16px;
    }
    .prefix {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #888;
      font-size: 16px;
    }
    input {
      width: 100%;
      padding: 16px 16px 16px 36px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px;
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 16px;
      transition: all 0.3s;
      outline: none;
    }
    input:focus {
      border-color: #25D366;
      box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.15);
    }
    input::placeholder { color: #555; }
    .btn {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 8px;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37,211,102,0.3); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .result {
      display: none;
      margin-top: 24px;
      padding: 20px;
      border-radius: 14px;
      background: rgba(37, 211, 102, 0.1);
      border: 1px solid rgba(37, 211, 102, 0.3);
    }
    .result.show { display: block; }
    .code {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #25D366;
      margin: 12px 0;
      font-family: 'Courier New', monospace;
    }
    .copy-btn {
      padding: 8px 20px;
      border: 1px solid rgba(37, 211, 102, 0.5);
      border-radius: 10px;
      background: transparent;
      color: #25D366;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.3s;
    }
    .copy-btn:hover { background: rgba(37,211,102,0.15); }
    .error {
      display: none;
      margin-top: 24px;
      padding: 16px;
      border-radius: 14px;
      background: rgba(255, 82, 82, 0.1);
      border: 1px solid rgba(255, 82, 82, 0.3);
      color: #FF5252;
    }
    .error.show { display: block; }
    .info {
      margin-top: 24px;
      padding: 16px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .info h3 { font-size: 14px; color: #25D366; margin-bottom: 8px; }
    .info ol { text-align: left; padding-left: 20px; }
    .info li { font-size: 13px; color: #999; margin-bottom: 4px; line-height: 1.6; }
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🤖</div>
    <h1>${config.BOT_NAME}</h1>
    <p class="subtitle">WhatsApp Bot Pairing</p>
    <div id="statusBadge" class="status-badge status-offline">⚫ Checking...</div>
    
    <div class="input-group">
      <span class="prefix">+</span>
      <input type="tel" id="phone" placeholder="234XXXXXXXXXX" maxlength="15" />
    </div>
    <button class="btn" id="pairBtn" onclick="requestPair()">
      🔗 Get Pairing Code
    </button>
    
    <div class="result" id="result">
      <p style="font-size:13px;color:#999;">Your pairing code:</p>
      <div class="code" id="pairCode"></div>
      <button class="copy-btn" onclick="copyCode()">📋 Copy Code</button>
    </div>
    
    <div class="error" id="error"></div>
    
    <div class="info">
      <h3>📱 How to Pair</h3>
      <ol>
        <li>Enter your WhatsApp phone number</li>
        <li>Click "Get Pairing Code"</li>
        <li>Open WhatsApp → Linked Devices</li>
        <li>Click "Link with phone number"</li>
        <li>Enter the pairing code</li>
      </ol>
    </div>
  </div>

  <script>
    // Check bot status on load
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        const badge = document.getElementById('statusBadge');
        if (data.connected) {
          badge.textContent = '🟢 Bot Connected';
          badge.className = 'status-badge status-online';
        } else {
          badge.textContent = '🟡 Ready to Pair';
          badge.className = 'status-badge status-offline';
        }
      })
      .catch(() => {
        document.getElementById('statusBadge').textContent = '🔴 Offline';
      });

    async function requestPair() {
      const phone = document.getElementById('phone').value.replace(/\\D/g, '');
      const btn = document.getElementById('pairBtn');
      const result = document.getElementById('result');
      const error = document.getElementById('error');
      
      result.className = 'result';
      error.className = 'error';
      
      if (!phone || phone.length < 10) {
        error.textContent = 'Please enter a valid phone number';
        error.className = 'error show';
        return;
      }
      
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Getting code...';
      
      try {
        const res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();
        
        if (data.error) {
          error.textContent = data.error;
          error.className = 'error show';
        } else if (data.code) {
          document.getElementById('pairCode').textContent = data.code;
          result.className = 'result show';
        }
      } catch (e) {
        error.textContent = 'Failed to connect. Try again.';
        error.className = 'error show';
      }
      
      btn.disabled = false;
      btn.innerHTML = '🔗 Get Pairing Code';
    }
    
    function copyCode() {
      const code = document.getElementById('pairCode').textContent;
      navigator.clipboard.writeText(code);
    }

    // Enter key support
    document.getElementById('phone').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') requestPair();
    });
  </script>
</body>
</html>`;

  // ─── Routes ──────────────────────────────────────────────

  // Serve pairing page
  app.get('/', (req, res) => {
    res.send(pairPage);
  });

  // Status check
  app.get('/api/status', (req, res) => {
    res.json({ connected: pairBot.isConnected() });
  });

  // Request pairing code
  app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.json({ error: 'Invalid phone number' });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    try {
      const result = await pairBot.requestPairingCode(cleanPhone);
      if (result.error) {
        res.json({ error: result.error });
      } else {
        res.json({ code: result.code });
      }
    } catch (e) {
      res.json({ error: 'Failed to generate pairing code. Try restarting the bot.' });
    }
  });

  // Start server
  const server = app.listen(config.PORT, () => {
    console.log(`🌐 Web pairing server running on port ${config.PORT}`);
  });

  return server;
}

module.exports = { startWebServer };
