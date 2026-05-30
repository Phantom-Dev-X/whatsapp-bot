/**
 * Web Pairing Server (Multi-Session)
 * Anyone can visit the site and pair their WhatsApp
 * Each user gets their own bot instance
 */

const express = require('express');
const config = require('../config');
const sessionManager = require('./sessionManager');

function startWebServer() {
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
    .logo { font-size: 48px; margin-bottom: 8px; }
    h1 {
      font-size: 28px; font-weight: 700; margin-bottom: 4px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .subtitle { color: #888; margin-bottom: 24px; font-size: 14px; }
    .status-badge {
      display: inline-block; padding: 4px 16px; border-radius: 20px;
      font-size: 12px; font-weight: 600; margin-bottom: 24px;
    }
    .status-online { background: rgba(37,211,102,0.15); color: #25D366; border: 1px solid rgba(37,211,102,0.3); }
    .status-waiting { background: rgba(255,193,7,0.15); color: #FFC107; border: 1px solid rgba(255,193,7,0.3); }
    .input-group { position: relative; margin-bottom: 16px; }
    .prefix { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #888; font-size: 16px; }
    input, select {
      width: 100%; padding: 16px 16px 16px 36px;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 14px;
      background: rgba(255,255,255,0.05); color: #fff; font-size: 16px;
      transition: all 0.3s; outline: none;
    }
    input:focus, select:focus { border-color: #25D366; box-shadow: 0 0 0 3px rgba(37,211,102,0.15); }
    input::placeholder { color: #555; }
    select option { background: #1a1a2e; color: #fff; }
    .btn {
      width: 100%; padding: 16px; border: none; border-radius: 14px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      color: #fff; font-size: 16px; font-weight: 600;
      cursor: pointer; transition: all 0.3s; margin-top: 8px;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37,211,102,0.3); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-danger {
      background: linear-gradient(135deg, #FF5252, #D32F2F); margin-top: 12px;
    }
    .result {
      display: none; margin-top: 24px; padding: 20px; border-radius: 14px;
      background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.3);
    }
    .result.show { display: block; }
    .code {
      font-size: 32px; font-weight: 800; letter-spacing: 4px;
      color: #25D366; margin: 12px 0; font-family: 'Courier New', monospace;
    }
    .copy-btn {
      padding: 8px 20px; border: 1px solid rgba(37,211,102,0.5);
      border-radius: 10px; background: transparent; color: #25D366;
      cursor: pointer; font-size: 13px; transition: all 0.3s;
    }
    .copy-btn:hover { background: rgba(37,211,102,0.15); }
    .error {
      display: none; margin-top: 24px; padding: 16px; border-radius: 14px;
      background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); color: #FF5252;
    }
    .error.show { display: block; }
    .info {
      margin-top: 24px; padding: 16px; border-radius: 14px;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    }
    .info h3 { font-size: 14px; color: #25D366; margin-bottom: 8px; }
    .info ol { text-align: left; padding-left: 20px; }
    .info li { font-size: 13px; color: #999; margin-bottom: 4px; line-height: 1.6; }
    .worldwide {
      margin-top: 16px; padding: 12px; border-radius: 10px;
      background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.2);
      font-size: 13px; color: #25D366;
    }
    .worldwide span { font-size: 18px; }
    .spinner {
      display: inline-block; width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
      border-radius: 50%; animation: spin 0.6s linear infinite;
      vertical-align: middle; margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .tab {
      flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px; background: transparent; color: #888;
      cursor: pointer; font-size: 13px; transition: all 0.3s;
    }
    .tab.active { border-color: #25D366; color: #25D366; background: rgba(37,211,102,0.1); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🤖</div>
    <h1>${config.BOT_NAME}</h1>
    <p class="subtitle">Pair your WhatsApp — Get your own bot!</p>
    <div id="statusBadge" class="status-badge status-waiting">🟡 Ready to Pair</div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('pair')">🔗 Pair</button>
      <button class="tab" onclick="switchTab('status')">📊 Status</button>
    </div>

    <!-- PAIR TAB -->
    <div id="pairTab" class="tab-content active">
      <div class="input-group">
        <span class="prefix">+</span>
        <input type="tel" id="phone" placeholder="Your number e.g. 223XXXXXXXXX" maxlength="15" />
      </div>
      <button class="btn" id="pairBtn" onclick="requestPair()">🔗 Get Pairing Code</button>

      <div class="result" id="result">
        <p style="font-size:13px;color:#999;">Your pairing code:</p>
        <div class="code" id="pairCode"></div>
        <button class="copy-btn" onclick="copyCode()">📋 Copy Code</button>
      </div>

      <div class="error" id="error"></div>

      <div class="worldwide">
        <span>🌍</span> Works with ANY country — Nigeria, Mali, Ghana, USA, India, everywhere!
      </div>

      <div class="info">
        <h3>📱 How to Pair</h3>
        <ol>
          <li>Enter <strong>your</strong> WhatsApp number (with country code)</li>
          <li>Click "Get Pairing Code"</li>
          <li>Open WhatsApp → Settings → Linked Devices</li>
          <li>Tap "Link with phone number"</li>
          <li>Enter the code — that's it!</li>
        </ol>
      </div>
    </div>

    <!-- STATUS TAB -->
    <div id="statusTab" class="tab-content">
      <div id="statusInfo" style="text-align:left;font-size:14px;color:#999;">Loading...</div>
    </div>
  </div>

  <script>
    // Check server status
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        const badge = document.getElementById('statusBadge');
        if (data.serverUp) {
          badge.textContent = '🟢 Server Online — ' + data.activeSessions + ' bots running';
          badge.className = 'status-badge status-online';
        }
      })
      .catch(() => {
        document.getElementById('statusBadge').textContent = '🔴 Offline';
      });

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach((t, i) => {
        t.classList.toggle('active', (tab === 'pair' && i === 0) || (tab === 'status' && i === 1));
      });
      document.getElementById('pairTab').classList.toggle('active', tab === 'pair');
      document.getElementById('statusTab').classList.toggle('active', tab === 'status');
      if (tab === 'status') loadStatus();
    }

    async function loadStatus() {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        document.getElementById('statusInfo').innerHTML =
          '<p style="margin-bottom:8px;">🟢 <strong>Server:</strong> Online</p>' +
          '<p style="margin-bottom:8px;">🤖 <strong>Active bots:</strong> ' + d.activeSessions + ' / ' + d.maxSessions + '</p>' +
          '<p>👥 <strong>Users can pair from:</strong> Any country 🌍</p>';
      } catch {
        document.getElementById('statusInfo').innerHTML = '<p>❌ Could not load status</p>';
      }
    }

    async function requestPair() {
      const phone = document.getElementById('phone').value.replace(/\\D/g, '');
      const btn = document.getElementById('pairBtn');
      const result = document.getElementById('result');
      const error = document.getElementById('error');

      result.className = 'result';
      error.className = 'error';

      if (!phone || phone.length < 10) {
        error.textContent = 'Please enter a valid phone number with country code';
        error.className = 'error show';
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Generating code...';

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
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy Code'; }, 2000);
      });
    }

    document.getElementById('phone').addEventListener('keypress', e => {
      if (e.key === 'Enter') requestPair();
    });
  </script>
</body>
</html>`;

  // ─── Routes ──────────────────────────────────────────────

  app.get('/', (req, res) => res.send(pairPage));

  app.get('/api/status', (req, res) => {
    res.json({
      serverUp: true,
      activeSessions: sessionManager.getActiveCount(),
      maxSessions: 50,
    });
  });

  app.post('/api/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.json({ error: 'Invalid phone number. Include country code.' });
    }
    const cleanPhone = phone.replace(/\D/g, '');
    try {
      const result = await sessionManager.createSession(cleanPhone);
      res.json(result);
    } catch (e) {
      res.json({ error: 'Server error. Try again.' });
    }
  });

  const server = app.listen(config.PORT, () => {
    console.log(`🌐 Web server running on port ${config.PORT}`);
  });

  return server;
}

module.exports = { startWebServer };
