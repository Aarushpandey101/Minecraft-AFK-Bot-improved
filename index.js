const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const http = require('http');

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
const HTTP_PORT = Number(
  process.env.PORT ||
  process.env.SERVER_PORT ||
  process.env.PTERODACTYL_PORT ||
  5000
);

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  lastSpawnAt: null,
  errors: [],
  banPaused: false,
  banReason: null,
  lastDisconnectReason: null,
  lastDisconnectKind: null
};

// Health check endpoint for monitoring
// Health check endpoint for monitoring
app.get('/', (req, res) => {
  // "Blue Teal Shadow" Theme - Live Dashboard
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${config.name} Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #0f172a; 
            color: #f8fafc; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
            overflow: hidden;
          }
          .container {
            background: #1e293b;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 0 50px rgba(45, 212, 191, 0.2);
            text-align: center;
            width: 400px;
            border: 1px solid #334155;
            transition: box-shadow 0.3s ease;
          }
          h1 { margin-bottom: 30px; font-size: 24px; color: #ccfbf1; display: flex; align-items: center; justify-content: center; gap: 10px; }
          .stat-card {
            background: #0f172a;
            padding: 15px;
            margin: 15px 0;
            border-radius: 12px;
            border-left: 5px solid #2dd4bf;
            text-align: left;
            box-shadow: 5px 5px 15px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
          }
          .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .value { font-size: 18px; font-weight: bold; color: #2dd4bf; text-shadow: 0 0 10px rgba(45, 212, 191, 0.5); margin-top: 5px; }
          .status-dot { 
            height: 12px; width: 12px; 
            border-radius: 50%; 
            display: inline-block; 
            margin-right: 8px;
            box-shadow: 0 0 10px currentColor;
            transition: color 0.3s ease, box-shadow 0.3s ease;
            background-color: currentColor; /* Use CSS for the dot color */
          }
          /* Override specific IDs to set background color for the dot */
          #live-indicator { background-color: currentColor; }
          
          .pulse { animation: pulse 2s infinite; }
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
          }
          .btn-guide {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 22px;
            background: #2dd4bf;
            color: #0f172a;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            box-shadow: 0 0 15px rgba(45, 212, 191, 0.35);
            transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
            border: none;
            cursor: pointer;
            min-width: 150px;
          }
          .btn-guide:hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 0 22px rgba(45, 212, 191, 0.5); }
          .btn-secondary {
            background: rgba(15, 23, 42, 0.92);
            color: #67e8f9;
            border: 1px solid rgba(45, 212, 191, 0.35);
            box-shadow: 0 0 0 rgba(0, 0, 0, 0);
          }
          .btn-secondary:hover {
            background: rgba(15, 23, 42, 1);
            box-shadow: 0 0 16px rgba(103, 232, 249, 0.2);
          }
          .action-row {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 20px;
            margin-bottom: 6px;
          }
          .connection-bar {
            height: 4px; background: #334155; width: 100%; margin-top: 20px; border-radius: 2px; overflow: hidden;
          }
          .connection-fill {
            height: 100%; width: 100%; background: #2dd4bf;
            animation: loading 2s infinite linear;
            transform-origin: 0% 50%;
          }
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        </style>
      </head>
      <body>
        <div class="container" id="main-container">
          <h1>
            <span id="live-indicator" class="status-dot pulse" style="color: #ef4444;"></span> 
            ${config.name}
          </h1>
          
          <div class="stat-card">
            <div class="label">Status</div>
            <div class="value" id="status-text">Connecting...</div>
          </div>

          <div class="stat-card">
            <div class="label">Username</div>
            <div class="value" id="username-text">${config['bot-account'].username}</div>
          </div>

          <div class="stat-card">
            <div class="label">Uptime</div>
            <div class="value" id="uptime-text">0h 0m 0s</div>
          </div>

          <div class="stat-card">
            <div class="label">Session Uptime</div>
            <div class="value" id="session-uptime-text">0h 0m 0s</div>
          </div>

          <div class="stat-card">
            <div class="label">Coordinates</div>
            <div class="value" id="coords-text">Waiting...</div>
          </div>

          <div class="stat-card">
            <div class="label">Last Disconnect</div>
            <div class="value" id="disconnect-text">None</div>
          </div>

          <div class="stat-card">
            <div class="label">Server</div>
            <div class="value">${config.server.ip}</div>
          </div>

          <div class="action-row">
            <a href="/tutorial" class="btn-guide">View Setup Guide</a>
            <button id="restart-btn" class="btn-guide btn-secondary">Restart Bot</button>
          </div>
          
          <div class="connection-bar">
            <div class="connection-fill" id="activity-bar"></div>
          </div>
          
          <p style="color: #64748b; font-size: 12px; margin-top: 15px;">
            Live connection to Bot Process
          </p>
        </div>

        <script>
          const formatUptime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return \`\${h}h \${m}m \${s}s\`;
          };

          const updateStats = async () => {
            try {
              const res = await fetch('/health');
              const data = await res.json();
              
              const statusText = document.getElementById('status-text');
              const usernameText = document.getElementById('username-text');
              const uptimeText = document.getElementById('uptime-text');
              const sessionUptimeText = document.getElementById('session-uptime-text');
              const coordsText = document.getElementById('coords-text');
              const disconnectText = document.getElementById('disconnect-text');
              const liveDot = document.getElementById('live-indicator');
              const container = document.getElementById('main-container');

              // Update Status
              if (data.status === 'connected') {
                statusText.innerHTML = '<span class="status-dot" style="color: #4ade80;"></span> Online & Running';
                statusText.style.color = '#2dd4bf';
                liveDot.style.color = '#4ade80'; // Green pulse
                container.style.boxShadow = '0 0 50px rgba(45, 212, 191, 0.2)';
              } else if (data.status === 'paused-banned') {
                statusText.innerHTML = '<span class="status-dot" style="color: #f59e0b;"></span> Paused (Ban Detected)';
                statusText.style.color = '#f59e0b';
                liveDot.style.color = '#f59e0b';
                container.style.boxShadow = '0 0 50px rgba(245, 158, 11, 0.2)';
              } else {
                statusText.innerHTML = '<span class="status-dot" style="color: #f87171;"></span> Reconnecting...';
                statusText.style.color = '#f87171';
                liveDot.style.color = '#f87171'; // Red pulse
                container.style.boxShadow = '0 0 50px rgba(248, 113, 113, 0.2)';
              }

              // Update Uptime
              if (data.username) {
                usernameText.innerText = data.username;
              }
              uptimeText.innerText = formatUptime(data.uptime);
              sessionUptimeText.innerText = formatUptime(data.sessionUptime || 0);

              // Update Coords
              if (data.coords) {
                coordsText.innerText = \`Coords: \${Math.floor(data.coords.x)}, \${Math.floor(data.coords.y)}, \${Math.floor(data.coords.z)}\`;
              } else {
                coordsText.innerText = 'Unknown Location';
              }

              if (data.lastDisconnectKind && data.lastDisconnectReason) {
                disconnectText.innerText = \`\${data.lastDisconnectKind}: \${data.lastDisconnectReason}\`;
              } else if (data.lastDisconnectReason) {
                disconnectText.innerText = data.lastDisconnectReason;
              } else {
                disconnectText.innerText = 'None';
              }

            } catch (e) {
              document.getElementById('status-text').innerText = 'System Offline';
              document.getElementById('live-indicator').style.color = '#64748b'; // Grey
            }
          };

          const restartBtn = document.getElementById('restart-btn');
          restartBtn.addEventListener('click', async () => {
            if (!confirm('Restart the bot now?')) return;
            const key = prompt('Enter the dashboard restart key:');
            if (!key) return;
            try {
              const res = await fetch('/restart?key=' + encodeURIComponent(key), { method: 'POST' });
              const data = await res.json();
              alert(data.message || 'Restart requested.');
            } catch (err) {
              alert('Restart failed: ' + err.message);
            }
          });

          // Poll every 1 second
          setInterval(updateStats, 1000);
          updateStats();
        </script>
      </body>
    </html>
  `);
});

app.get('/tutorial', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>${config.name} - Setup Guide</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #cbd5e1; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1, h2 { color: #2dd4bf; }
          h1 { border-bottom: 2px solid #334155; padding-bottom: 10px; }
          .card { background: #1e293b; padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #334155; }
          a { color: #38bdf8; text-decoration: none; }
          code { background: #334155; padding: 2px 6px; border-radius: 4px; color: #e2e8f0; font-family: monospace; }
          .btn-home { display: inline-block; margin-bottom: 20px; padding: 8px 16px; background: #334155; color: white; border-radius: 6px; text-decoration: none; }
        </style>
      </head>
      <body>
        <a href="/" class="btn-home">Back to Dashboard</a>
        <h1>Setup Guide (Under 15 Minutes)</h1>
        
        <div class="card">
          <h2>Step 1: Configure Aternos</h2>
          <ol>
            <li>Go to <strong>Aternos</strong>.</li>
            <li>Install <strong>Paper/Bukkit</strong> software.</li>
            <li>Enable <strong>Cracked</strong> mode (Green Switch).</li>
            <li>Install Plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code>.</li>
          </ol>
        </div>

        <div class="card">
          <h2>Step 2: GitHub Setup</h2>
          <ol>
            <li>Download this code as ZIP and extract.</li>
            <li>Edit <code>settings.json</code> with your IP/Port.</li>
            <li>Upload all files to a new <strong>GitHub Repository</strong>.</li>
          </ol>
        </div>

        <div class="card">
          <h2>Step 3: Render (Free 24/7 Hosting)</h2>
          <ol>
            <li>Go to <a href="https://render.com" target="_blank">Render.com</a> and create a Web Service.</li>
            <li>Connect your GitHub.</li>
            <li>Build Command: <code>npm install</code></li>
            <li>Start Command: <code>npm start</code> (this runs <code>node index.js</code> from <code>package.json</code>)</li>
            <li>Current Render bot username: <code>Testing</code>.</li>
            <li>If you want <strong>spectator mode</strong>, make the bot <strong>OP</strong> on Aternos so the command can work.</li>
            <li><strong>Important:</strong> The bot entry file is <code>index.js</code>, but the launch command is <code>npm start</code>.</li>
            <li><strong>Current stay window:</strong> the bot intentionally leaves roughly every <code>10-20 minutes</code> on this Render copy.</li>
            <li><strong>Current alerts:</strong> ban/idle-kick alerts ping the Discord user ID and pause reconnects until you restart after unban.</li>
            <li><strong>Current status page:</strong> shows process uptime, session uptime, and the last disconnect reason.</li>
            <li><strong>Magic:</strong> The bot automatically pings itself to stay awake!</li>
          </ol>
        </div>
        
        <p style="text-align: center; margin-top: 40px; color: #64748b;">AFK Bot Dashboard</p>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  const sessionUptime = botState.lastSpawnAt
    ? Math.floor((Date.now() - botState.lastSpawnAt) / 1000)
    : 0;
  res.json({
    username: config['bot-account'].username,
    status: botState.banPaused ? 'paused-banned' : (botState.connected ? 'connected' : 'disconnected'),
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    sessionUptime,
    lastSpawnAt: botState.lastSpawnAt ? new Date(botState.lastSpawnAt).toISOString() : null,
    coords: (bot && bot.entity) ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
    banReason: botState.banReason,
    lastDisconnectReason: botState.lastDisconnectReason,
    lastDisconnectKind: botState.lastDisconnectKind
  });
});

app.get('/ping', (req, res) => res.send('pong'));

app.post('/restart', (req, res) => {
  const key = String(req.query.key || '');
  const expectedKey = config.dashboard?.restartKey || '';

  if (!expectedKey || key !== expectedKey) {
    return res.status(403).json({ ok: false, message: 'Invalid restart key.' });
  }

  if (isShuttingDown) {
    return res.json({ ok: true, message: 'Restart already in progress.' });
  }

  res.json({ ok: true, message: 'Restarting bot now...' });
  setTimeout(() => beginShutdown(0, 'dashboard-restart'), 1000);
});

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[Server] HTTP server started on port ${HTTP_PORT}`);
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function normalizeReason(reason) {
  if (reason == null) return 'No specific reason provided';
  if (typeof reason === 'string') return reason;
  if (typeof reason === 'number' || typeof reason === 'boolean') return String(reason);
  try {
    if (typeof reason === 'object') {
      const parts = [];
      const visited = new Set();

      const walk = (value) => {
        if (value == null) return;
        if (typeof value === 'string') {
          const text = value.trim();
          if (text) parts.push(text);
          return;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          parts.push(String(value));
          return;
        }
        if (typeof value !== 'object' || visited.has(value)) return;
        visited.add(value);

        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }

        if (typeof value.text === 'string' && value.text.trim()) parts.push(value.text.trim());
        if (typeof value.reason === 'string' && value.reason.trim()) parts.push(value.reason.trim());
        if (typeof value.message === 'string' && value.message.trim()) parts.push(value.message.trim());

        ['extra', 'with', 'contents'].forEach((key) => {
          if (value[key] != null) walk(value[key]);
        });
      };

      walk(reason);

      const flattened = parts
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+\n\s+/g, '\n')
        .replace(/\n\s+/g, '\n')
        .trim();

      if (flattened) return flattened;
    }
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

function cleanBanReason(reasonText) {
  const text = normalizeReason(reasonText);
  return text.replace(/Reason:\s*null/gi, 'Reason: No specific reason provided');
}

function classifyDisconnectReason(reasonText) {
  const text = normalizeReason(reasonText);
  const lower = text.toLowerCase();

  if (lower.includes('this server is offline')) {
    return {
      kind: 'server-offline',
      label: 'Server offline',
      note: 'Aternos reported that the server is offline or stopping.'
    };
  }

  if (lower.includes('this server is online') && lower.includes('please reconnect to join')) {
    return {
      kind: 'reconnect-prompt',
      label: 'Reconnect prompt',
      note: 'Aternos asked the bot to reconnect. This usually means the session was reset or the join handoff dropped.'
    };
  }

  if (lower.includes('please reconnect to join')) {
    return {
      kind: 'reconnect-prompt',
      label: 'Reconnect prompt',
      note: 'Aternos asked the bot to reconnect.'
    };
  }

  return {
    kind: 'generic',
    label: 'Disconnect',
    note: text
  };
}

function isBanLikeReason(reason) {
  const text = normalizeReason(reason).toLowerCase();
  return (
    text.includes('you are banned') ||
    text.includes('banned from this server') ||
    text.includes('ban from this server') ||
    text.includes('temporarily banned') ||
    // NOTE: 'idle for too long' is NOT treated as a ban - it's just a kick, bot will reconnect normally
    text.includes('violates our terms of service')
  );
}

function pauseForBan(normalizedReason, source) {
  const displayReason = cleanBanReason(normalizedReason);
  botState.banPaused = true;
  botState.banReason = displayReason;
  console.log(`[Bot] Ban/idle kick detected from ${source}. Auto-reconnect is now paused until you unban the bot and restart the service.`);

  if (config.discord && config.discord.enabled && (!config.discord.events || config.discord.events.ban !== false)) {
    const mention = config.discord.userMentionId ? `<@${config.discord.userMentionId}> ` : '';
    sendDiscordWebhook(
      `${mention}[BAN ALERT] **${config['bot-account'].username}** was banned or idle-kicked.\nServer: \`${config.server.ip}:${config.server.port}\`\nReason: ${displayReason}\nAction needed: unban the bot and restart the service. Restart required after unban.`,
      0xf59e0b
    );
  }

  destroyCurrentBot();
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

const https = require('https');

function startSelfPing() {
  setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${HTTP_PORT}`;
    const protocol = url.startsWith('https') ? https : http;

    try {
      const req = protocol.get(`${url}/ping`, (res) => {
        // console.log(`[KeepAlive] Self-ping: ${res.statusCode}`); // Optional: reduce spam
        res.resume(); // Drain the response to free resources
      });
      req.setTimeout(15000, () => {
        req.destroy();
        console.log('[KeepAlive] Self-ping timed out');
      });
      req.on('error', (err) => {
        console.log(`[KeepAlive] Self-ping failed: ${err.message}`);
      });
    } catch (e) {
      console.log(`[KeepAlive] Self-ping exception: ${e.message}`);
    }
  }, SELF_PING_INTERVAL);
  console.log('[KeepAlive] Self-ping system started (every 10 min)');
}

startSelfPing();

// ============================================================
// MEMORY MONITORING
// ============================================================
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  console.log(`[Memory] Heap: ${heapMB} MB`);
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeout = null;
let isReconnecting = false;
let connectionTimeout = null;
let currentConnectAttempt = 0;
let intentionalLeaveInProgress = false;
let isShuttingDown = false;

function clearAllIntervals() {
  console.log(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

function clearConnectionTimeout() {
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }
}

function clearReconnectState() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  isReconnecting = false;
}

function destroyCurrentBot() {
  if (!bot) return;

  clearAllIntervals();
  clearConnectionTimeout();
  clearReconnectState();

  try {
    bot.removeAllListeners();
  } catch (e) {
    console.log('[Cleanup] Error removing listeners:', e.message);
  }

  try {
    bot.end();
  } catch (e) {
    console.log('[Cleanup] Error ending previous bot:', e.message);
  }

  try {
    bot._client?.socket?.destroy();
  } catch (e) {
    console.log('[Cleanup] Error destroying socket:', e.message);
  }

  bot = null;
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay(reason = 'generic') {
  const baseDelay = config.utils['auto-reconnect-delay'] || 4000;
  const maxDelay = config.utils['max-reconnect-delay'] || 12000;
  const networkBaseDelay = config.utils['network-reconnect-delay'] || Math.max(2500, baseDelay - 1000);
  const duplicateBaseDelay = config.utils['duplicate-login-reconnect-delay'] || Math.max(10000, baseDelay + 4000);
  const periodicBaseDelay = config.utils['periodic-rejoin-reconnect-delay'] || Math.max(6000, baseDelay + 2000);

  let effectiveBaseDelay = baseDelay;
  if (reason === 'network') effectiveBaseDelay = networkBaseDelay;
  if (reason === 'duplicate-login') effectiveBaseDelay = duplicateBaseDelay;
  if (reason === 'periodic-rejoin') effectiveBaseDelay = periodicBaseDelay;

  return Math.min(effectiveBaseDelay + (botState.reconnectAttempts * 1000), maxDelay);
}

function createBot() {
  if (isShuttingDown) {
    console.log('[Bot] Bot creation skipped because the process is shutting down.');
    return;
  }

  if (botState.banPaused) {
    console.log('[Bot] Bot creation skipped because service is paused after a ban/idle kick.');
    return;
  }

  currentConnectAttempt += 1;
  const attemptId = currentConnectAttempt;

  // Cleanup previous bot
  destroyCurrentBot();

  clearReconnectState();
  botState.connected = false;
  intentionalLeaveInProgress = false;

  console.log(`[Bot] Creating bot instance...`);
  console.log(`[Bot] Connecting to ${config.server.ip}:${config.server.port}`);

  try {
    bot = mineflayer.createBot({
      username: config['bot-account'].username,
      password: config['bot-account'].password || undefined,
      auth: config['bot-account'].type,
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      hideErrors: false,
      checkTimeoutInterval: config.server['check-timeout-interval'] || 180000,
      connectTimeout: 30000, // 30s - abort initial TCP connection if server unreachable (prevents ETIMEDOUT hangs)
      closeTimeout: 10000 // 10s - time to wait for graceful close before forcing
    });

    bot.loadPlugin(pathfinder);

    // ------ TCP Socket hardening (ECONNRESET / ETIMEDOUT resilience) ------
    bot._client.on('connect', () => {
      const socket = bot._client.socket;
      if (socket) {
        // Enable TCP keep-alive so the OS detects dead connections at the TCP level
        socket.setKeepAlive(true, 30000); // Send keep-alive probe every 30s
        // Handle low-level socket errors that mineflayer may not surface
        socket.on('error', (err) => {
          console.log(`[Socket] Low-level socket error: ${err.message}`);
        });
        socket.on('timeout', () => {
          console.log('[Socket] Socket timeout detected, destroying connection');
          socket.destroy();
        });
        // Set an inactivity timeout on the socket itself (3 minutes)
        socket.setTimeout(Math.max(config.server['check-timeout-interval'] || 180000, 180000));
      }
    });

    // Connection timeout - if no spawn in 45s, reconnect and destroy the stale attempt
    clearConnectionTimeout();
    connectionTimeout = setTimeout(() => {
      if (attemptId !== currentConnectAttempt) return;
      if (!botState.connected) {
        console.log('[Bot] Connection timeout - no spawn received');
        destroyCurrentBot();
        scheduleReconnect('timeout');
      }
    }, 45000);

    bot.once('spawn', () => {
      if (attemptId !== currentConnectAttempt) return;
      clearConnectionTimeout();
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.lastSpawnAt = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;
      intentionalLeaveInProgress = false;

      console.log(`[Bot] [+] Successfully spawned on server!`);
      if (config.discord && config.discord.events.connect) {
        sendDiscordWebhook(`[+] **Connected** to \`${config.server.ip}\``, 0x4ade80); // Green
      }

      const mcData = require('minecraft-data')(config.server.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      // Start all modules
      initializeModules(bot, mcData, defaultMove);

      // Setup enhanced Leave/Rejoin logic
      setupLeaveRejoin(bot, createBot, markIntentionalLeave);

      setTimeout(() => {
        if (bot && botState.connected) {
          // Chain commands with a gap so they don't race
          bot.chat('/gamemode spectator');
          console.log('[INFO] Attempted to set spectator mode (requires OP)');
          setTimeout(() => {
            if (bot && botState.connected) {
              bot.chat('/gamerule sendCommandFeedback false');
            }
          }, 1500);
        }
      }, 3000);

      bot.on('messagestr', (message) => {
        if (
          message.includes('commands.gamemode.success.self') ||
          message.includes('Set own game mode to Spectator Mode')
        ) {
          console.log('[INFO] Bot is now in Spectator Mode.');
          
          bot.chat('/gamerule sendCommandFeedback false');
          
        }
      });
    });

    

    // Handle disconnection
    bot.on('end', (reason) => {
      if (attemptId !== currentConnectAttempt) return;
      clearConnectionTimeout();
      const normalizedReason = normalizeReason(reason);
      const disconnectInfo = classifyDisconnectReason(normalizedReason);
      botState.lastDisconnectReason = cleanBanReason(normalizedReason);
      botState.lastDisconnectKind = disconnectInfo.kind;
      console.log(`[Bot] Disconnected: ${normalizedReason || 'Unknown reason'}`);
      if (disconnectInfo.kind === 'server-offline' || disconnectInfo.kind === 'reconnect-prompt') {
        console.log(`[Bot] ${disconnectInfo.label}: ${disconnectInfo.note}`);
      }
      botState.connected = false;
      clearAllIntervals();

      if (config.discord && config.discord.events.disconnect && normalizedReason !== 'Periodic Rejoin') {
        sendDiscordWebhook(`[-] **Disconnected**: ${normalizedReason || 'Unknown'}`, 0xf87171); // Red
      }

      if (isBanLikeReason(normalizedReason)) {
        pauseForBan(normalizedReason, 'end');
        return;
      }

      if (botState.banPaused) {
        console.log('[Bot] Reconnect paused because the server reported a ban/idle violation. Unban the bot and restart the service.');
        return;
      }

      if (config.utils['auto-reconnect']) {
        const reconnectReason = intentionalLeaveInProgress ? 'periodic-rejoin' : 'end';
        scheduleReconnect(reconnectReason);
      }
    });

    bot.on('kicked', (reason) => {
      if (attemptId !== currentConnectAttempt) return;
      clearConnectionTimeout();
      const normalizedReason = normalizeReason(reason);
      const disconnectInfo = classifyDisconnectReason(normalizedReason);
      botState.lastDisconnectReason = cleanBanReason(normalizedReason);
      botState.lastDisconnectKind = disconnectInfo.kind;
      console.log(`[Bot] Kicked: ${normalizedReason}`);
      if (disconnectInfo.kind === 'server-offline' || disconnectInfo.kind === 'reconnect-prompt') {
        console.log(`[Bot] ${disconnectInfo.label}: ${disconnectInfo.note}`);
      }
      botState.connected = false;
      botState.errors.push({ type: 'kicked', reason: normalizedReason, time: Date.now() });
      clearAllIntervals();

      if (config.discord && config.discord.events.disconnect) {
        sendDiscordWebhook(`[!] **Kicked**: ${normalizedReason}`, 0xff0000); // Bright Red
      }

      if (isBanLikeReason(normalizedReason)) {
        pauseForBan(normalizedReason, 'kicked');
        return;
      }

      if (config.utils['auto-reconnect']) {
        const duplicateLogin = normalizedReason.includes('The same username is already playing on the server!');
        scheduleReconnect(duplicateLogin ? 'duplicate-login' : 'kicked');
      }
    });

    bot.on('error', (err) => {
      if (attemptId !== currentConnectAttempt) return;
      clearConnectionTimeout();
      console.log(`[Bot] Error: ${err.message}`);
      botState.errors.push({ type: 'error', message: err.message, time: Date.now() });

      // For network-level errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED, etc.)
      // the 'end' event may NOT fire, so we must trigger reconnect ourselves
      const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNABORTED', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'EAI_AGAIN'];
      const isNetworkError = networkErrors.some(code => err.message && err.message.includes(code));
      if (isNetworkError) {
        if (intentionalLeaveInProgress) {
          console.log(`[Bot] Ignoring network error during intentional leave: ${err.message}`);
          return;
        }
        console.log(`[Bot] Network error detected (${err.message}), forcing reconnect...`);
        botState.connected = false;
        clearAllIntervals();
        if (config.utils['auto-reconnect']) {
          destroyCurrentBot();
          scheduleReconnect('network');
        }
      }
      // For non-network errors, let 'end' event handle reconnection
    });

  } catch (err) {
    clearConnectionTimeout();
    console.log(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect('create-failed');
  }
}

function scheduleReconnect(reason = 'generic') {
  if (isShuttingDown) {
    console.log('[Bot] Reconnect skipped because the process is shutting down.');
    return;
  }

  if (botState.banPaused) {
    console.log('[Bot] Reconnect skipped because bot is paused after a ban/idle kick.');
    return;
  }

  clearReconnectState();
  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay(reason);
  console.log(`[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts}, reason: ${reason})`);

  reconnectTimeout = setTimeout(() => {
    clearReconnectState();
    createBot();
  }, delay);
}

function markIntentionalLeave() {
  intentionalLeaveInProgress = true;
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  console.log('[Modules] Initializing all modules...');

  // ---------- AUTO AUTH ----------
  if (config.utils['auto-auth'].enabled) {
    const password = config.utils['auto-auth'].password;
    setTimeout(() => {
      bot.chat(`/register ${password} ${password}`);
      bot.chat(`/login ${password}`);
      console.log('[Auth] Sent login commands');
    }, 1000);
  }

  // ---------- CHAT MESSAGES (Human-like: rare, random timing) ----------
  if (config.utils['chat-messages'].enabled) {
    const messages = config.utils['chat-messages'].messages;
    if (config.utils['chat-messages'].repeat) {
      // Send one random message every 15-30 minutes (not sequential, not fast)
      function scheduleNextChatMessage() {
        const delay = 15 * 60 * 1000 + Math.random() * 15 * 60 * 1000; // 15-30 min
        setTimeout(() => {
          if (bot && botState.connected) {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            bot.chat(msg);
            botState.lastActivity = Date.now();
          }
          scheduleNextChatMessage();
        }, delay);
      }
      scheduleNextChatMessage();
    } else {
      messages.forEach((msg, idx) => {
        setTimeout(() => {
          if (bot && botState.connected) bot.chat(msg);
        }, idx * 3000);
      });
    }
  }

  // ---------- MOVE TO POSITION ----------
  if (config.position.enabled) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
  }

  // ---------- ANTI-AFK (Human-like) ----------
  if (config.utils['anti-afk'].enabled) {
    // Randomized jump every 25-45 seconds (not a fixed pattern)
    function scheduleAntiAfkJump() {
      const delay = 25000 + Math.random() * 20000; // 25s to 45s
      setTimeout(() => {
        if (bot && botState.connected) {
          bot.setControlState('jump', true);
          setTimeout(() => {
            if (bot) bot.setControlState('jump', false);
          }, 100 + Math.random() * 150);
          botState.lastActivity = Date.now();
        }
        scheduleAntiAfkJump();
      }, delay);
    }
    scheduleAntiAfkJump();

    // Randomized sneak toggles - humans don't hold sneak forever
    if (config.utils['anti-afk'].sneak) {
      function scheduleSneak() {
        const waitBeforeSneak = 30000 + Math.random() * 60000; // wait 30-90s
        setTimeout(() => {
          if (bot && botState.connected) {
            bot.setControlState('sneak', true);
            const sneakDuration = 500 + Math.random() * 2500; // sneak 0.5-3s
            setTimeout(() => {
              if (bot) bot.setControlState('sneak', false);
            }, sneakDuration);
          }
          scheduleSneak();
        }, waitBeforeSneak);
      }
      scheduleSneak();
    }
  }

  // ---------- MOVEMENT MODULES ----------
  if (config.movement['circle-walk'].enabled) {
    startCircleWalk(bot, defaultMove);
  }
  if (config.movement['random-jump'].enabled) {
    startRandomJump(bot);
  }
  if (config.movement['look-around'].enabled) {
    startLookAround(bot);
  }

  // ---------- CUSTOM MODULES ----------
  if (config.modules.avoidMobs) avoidMobs(bot);
  if (config.modules.combat) combatModule(bot, mcData);
  if (config.modules.beds) bedModule(bot, mcData);
  if (config.modules.chat) chatModule(bot);

  // Periodic Rejoin
  if (config.utils['periodic-rejoin'] && config.utils['periodic-rejoin'].enabled) {
    periodicRejoin(bot);
  }

  console.log('[Modules] All modules initialized!');
}

// Periodic Rejoin Module
const setupLeaveRejoin = require('./leaveRejoin');

// Periodic Rejoin Module - Handled by leaveRejoin.js now
function periodicRejoin(bot) {
  // Deprecated in favor of leaveRejoin.js
  console.log('[Rejoin] Using new leaveRejoin system.');
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement['circle-walk'].radius;
  let angle = Math.random() * Math.PI * 2; // start at random angle
  let lastPathTime = 0;
  let idleUntil = 0; // timestamp until which the bot "idles" doing nothing

  addInterval(() => {
    if (!bot || !botState.connected) return;

    const now = Date.now();

    // Occasionally do nothing for 2-5 minutes (humans stand still sometimes)
    if (now < idleUntil) return;

    // Rate limit pathfinding
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;

    // 5% chance to start a random idle period
    if (Math.random() < 0.05) {
      const idleDuration = 2 * 60 * 1000 + Math.random() * 3 * 60 * 1000; // 2-5 min
      idleUntil = now + idleDuration;
      console.log(`[CircleWalk] Idling for ${Math.round(idleDuration / 1000)}s (human behaviour)`);
      return;
    }

    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z)));
      // Random angle step so circle isn't perfectly uniform
      angle += (Math.PI / 4) + (Math.random() - 0.5) * (Math.PI / 8);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[CircleWalk] Error:', e.message);
    }
  }, config.movement['circle-walk'].speed);
}

function startRandomJump(bot) {
  function scheduleNextJump() {
    // Random interval 20-60 seconds
    const delay = 20000 + Math.random() * 40000;
    setTimeout(() => {
      if (!bot || !botState.connected) { scheduleNextJump(); return; }
      try {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot) bot.setControlState('jump', false);
        }, 200 + Math.random() * 200);
        botState.lastActivity = Date.now();
      } catch (e) {
        console.log('[RandomJump] Error:', e.message);
      }
      scheduleNextJump();
    }, delay);
  }
  scheduleNextJump();
}

function startLookAround(bot) {
  // Randomize look interval (not a fixed beat) - humans don't look around on a timer
  function scheduleNextLook() {
    const delay = 3000 + Math.random() * 9000; // 3-12 seconds
    setTimeout(() => {
      if (!bot || !botState.connected) { scheduleNextLook(); return; }
      try {
        const yaw = Math.random() * Math.PI * 2;
        // Keep pitch realistic - humans mostly look horizontal or slightly down
        const pitch = (Math.random() - 0.3) * Math.PI / 5;
        bot.look(yaw, pitch, true);
        botState.lastActivity = Date.now();
      } catch (e) {
        console.log('[LookAround] Error:', e.message);
      }
      scheduleNextLook();
    }, delay);
  }
  scheduleNextLook();
}

// ============================================================
// CUSTOM MODULES
// ============================================================

// Avoid mobs/players
function avoidMobs(bot) {
  const safeDistance = 5;
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const entities = Object.values(bot.entities).filter(e =>
        e.type === 'mob' || (e.type === 'player' && e.username !== bot.username)
      );
      for (const e of entities) {
        if (!e.position) continue;
        const distance = bot.entity.position.distanceTo(e.position);
        if (distance < safeDistance) {
          bot.setControlState('back', true);
          setTimeout(() => {
            if (bot) bot.setControlState('back', false);
          }, 500);
          break;
        }
      }
    } catch (e) {
      console.log('[AvoidMobs] Error:', e.message);
    }
  }, 2000);
}

// Combat module
function combatModule(bot, mcData) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      if (config.combat['attack-mobs']) {
        const mobs = Object.values(bot.entities).filter(e =>
          e.type === 'mob' && e.position &&
          bot.entity.position.distanceTo(e.position) < 4
        );
        if (mobs.length > 0) {
          bot.attack(mobs[0]);
        }
      }
    } catch (e) {
      console.log('[Combat] Error:', e.message);
    }
  }, 1500);

  bot.on('health', () => {
    if (!config.combat['auto-eat']) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory.items().find(i => {
          const itemData = mcData.itemsByName[i.name];
          return itemData && itemData.food;
        });
        if (food) {
          bot.equip(food, 'hand')
            .then(() => bot.consume())
            .catch(e => console.log('[AutoEat] Error:', e.message));
        }
      }
    } catch (e) {
      console.log('[AutoEat] Error:', e.message);
    }
  });
}

// Bed module (FIXED - beds are blocks, not entities)
function bedModule(bot, mcData) {
  addInterval(async () => {
    if (!bot || !botState.connected) return;

    try {
      const isNight = bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;

      if (config.beds['place-night'] && isNight && !bot.isSleeping) {
        // Find nearby bed blocks
        const bedBlock = bot.findBlock({
          matching: block => block.name.includes('bed'),
          maxDistance: 8
        });

        if (bedBlock) {
          try {
            await bot.sleep(bedBlock);
            console.log('[Bed] Sleeping...');
          } catch (e) {
            // Can't sleep - maybe not night enough or monsters nearby
          }
        }
      }
    } catch (e) {
      console.log('[Bed] Error:', e.message);
    }
  }, 10000);
}

// Chat module
function chatModule(bot) {
  bot.on('chat', (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      if (config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith('!tp ') && config.chat.respond) {
          const target = message.split(' ')[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      console.log('[Chat] Error:', e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!bot || !botState.connected) {
    console.log('[Console] Bot not connected');
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith('say ')) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith('cmd ')) {
    bot.chat('/' + trimmed.slice(4));
  } else if (trimmed === 'status') {
    console.log(`Connected: ${botState.connected}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`);
  } else if (trimmed === 'reconnect') {
    console.log('[Console] Manual reconnect requested');
    bot.end();
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (!config.discord || !config.discord.enabled || !config.discord.webhookUrl || config.discord.webhookUrl.includes('YOUR_DISCORD')) return;

  const protocol = config.discord.webhookUrl.startsWith('https') ? https : http;
  const urlParts = new URL(config.discord.webhookUrl);

  const payload = JSON.stringify({
    username: config.name,
    embeds: [{
      description: content,
      color: color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Slobos AFK Bot' }
    }]
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload) // Use Buffer.byteLength for correct multi-byte support
    },
    timeout: 15000 // 15 second timeout for Discord webhook requests
  };

  try {
    const req = protocol.request(options, (res) => {
      // console.log(`[Discord] Sent webhook: ${res.statusCode}`);
      res.resume(); // Drain the response to free resources
    });

    req.setTimeout(15000, () => {
      req.destroy();
      console.log('[Discord] Webhook request timed out');
    });

    req.on('error', (e) => {
      console.log(`[Discord] Error sending webhook: ${e.message}`);
    });

    req.write(payload);
    req.end();
  } catch (e) {
    console.log(`[Discord] Exception sending webhook: ${e.message}`);
  }
}

// ============================================================
// CRASH RECOVERY - IMMORTAL MODE
// ============================================================
process.on('uncaughtException', (err) => {
  console.log(`[FATAL] Uncaught Exception: ${err.message}`);
  // console.log(err.stack); // Optional: keep logs cleaner
  botState.errors.push({ type: 'uncaught', message: err.message, time: Date.now() });

  // Safety: ignore known transient network errors that bubble up uncaught
  const transientErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNABORTED', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'EAI_AGAIN', 'ERR_SOCKET_CLOSED'];
  const timeoutPhrases = ['client timed out after', 'keepalive timeout'];
  const isTransient = transientErrors.some(code => err.message && err.message.includes(code))
    || timeoutPhrases.some(text => err.message && err.message.toLowerCase().includes(text));
  if (isTransient) {
    console.log('[FATAL] Transient network error caught globally, will reconnect...');
  }

  // CRITICAL: DO NOT EXIT.
  // The user wants the server to stay up "all the time no matter what".
  // We just clear intervals and try to restart the bot logic.
  if (config.utils['auto-reconnect']) {
    botState.connected = false;
    destroyCurrentBot();
    clearAllIntervals();
    // Wrap in a tiny timeout to prevent tight loops if the error is synchronous
    setTimeout(() => {
      scheduleReconnect(isTransient ? 'network' : 'uncaught');
    }, isTransient ? 3000 : 1000); // Wait a bit longer for network issues to settle
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: 'rejection', message: String(reason), time: Date.now() });
  // Do not exit.
});

function beginShutdown(exitCode = 0, source = 'requested') {
  if (isShuttingDown) return;
  console.log(`[System] Shutdown requested from ${source}. Starting graceful shutdown...`);
  isShuttingDown = true;
  botState.connected = false;
  destroyCurrentBot();
  clearAllIntervals();
  clearReconnectState();
  setTimeout(() => process.exit(exitCode), 3000);
}

// Graceful shutdown from external signals (still allowed to exit if system demands it)
process.on('SIGTERM', () => {
  beginShutdown(0, 'SIGTERM');
});

process.on('SIGINT', () => {
  // Local Ctrl+C
  beginShutdown(0, 'SIGINT');
});

// ============================================================
// START THE BOT
// ============================================================
console.log('='.repeat(50));
console.log('  Minecraft AFK Bot v2.3 - Bug Fix Edition');
console.log('='.repeat(50));
console.log(`Account: ${config['bot-account'].username}`);
console.log(`Server: ${config.server.ip}:${config.server.port}`);
console.log(`Version: ${config.server.version}`);
console.log(`Auto-Reconnect: ${config.utils['auto-reconnect'] ? 'Enabled' : 'Disabled'}`);
console.log('='.repeat(50));

createBot();
