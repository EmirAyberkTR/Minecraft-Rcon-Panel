const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { Rcon } = require('rcon-client');
const http = require('http');

let mainWindow;
let rconClient = null;
let agentBaseUrl = null;
let pollInterval = null;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Dış linkleri tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Pencere kontrolleri ───────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => mainWindow.close());

// ─── RCON Bağlantısı ──────────────────────────────────────────────────────────

ipcMain.handle('rcon-connect', async (_, { host, port, password }) => {
  try {
    if (rconClient) {
      try { await rconClient.end(); } catch {}
      rconClient = null;
    }

    rconClient = new Rcon({ host, port: parseInt(port), password, timeout: 5000 });
    await rconClient.connect();

    rconClient.on('error', (err) => {
      sendToRenderer('rcon-error', err.message);
      rconClient = null;
    });

    rconClient.on('end', () => {
      sendToRenderer('rcon-disconnected');
      rconClient = null;
    });

    return { success: true };
  } catch (err) {
    rconClient = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rcon-disconnect', async () => {
  stopPolling();
  if (rconClient) {
    try { await rconClient.end(); } catch {}
    rconClient = null;
  }
  return { success: true };
});

ipcMain.handle('rcon-send', async (_, command) => {
  if (!rconClient) return { success: false, error: 'RCON bağlı değil' };
  try {
    const response = await rconClient.send(command);
    return { success: true, response: stripColors(response) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Agent (Python) HTTP ───────────────────────────────────────────────────────

ipcMain.handle('agent-connect', async (_, { host, port }) => {
  agentBaseUrl = `http://${host}:${port}`;
  try {
    const data = await httpGet(`${agentBaseUrl}/ping`);
    return { success: true, version: data.version };
  } catch (err) {
    agentBaseUrl = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('agent-metrics', async () => {
  if (!agentBaseUrl) return { success: false, error: 'Agent bağlı değil' };
  try {
    const data = await httpGet(`${agentBaseUrl}/metrics`);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Polling (canlı veri) ──────────────────────────────────────────────────────

ipcMain.handle('start-polling', async (_, intervalMs = 3000) => {
  stopPolling();
  pollInterval = setInterval(async () => {
    // Oyuncu listesi
    if (rconClient) {
      try {
        const listRaw = await rconClient.send('list');
        sendToRenderer('players-update', parsePlayerList(listRaw));
      } catch {}
    }
    // Sistem metrikleri ve Loglar
    if (agentBaseUrl) {
      try {
        const metrics = await httpGet(`${agentBaseUrl}/metrics`);
        sendToRenderer('metrics-update', metrics);

        const logs = await httpGet(`${agentBaseUrl}/log`);
        if (logs && logs.lines) {
          sendToRenderer('agent-log-update', logs.lines);
        }
      } catch {}
    }
  }, intervalMs);
  return { success: true };
});

ipcMain.handle('stop-polling', async () => { stopPolling(); return { success: true }; });

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ─── Yardımcılar ───────────────────────────────────────────────────────────────

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function stripColors(str) {
  // Minecraft renk kodlarını temizle
  return str.replace(/§[0-9a-fklmnor]/gi, '').trim();
}

function parsePlayerList(raw) {
  // "There are 3 of a max of 20 players online: Ayberk, Steve, Bob"
  const match = raw.match(/(\d+) of a max of (\d+).*?:\s*(.*)/s);
  if (!match) return { online: 0, max: 20, players: [] };
  const online = parseInt(match[1]);
  const max = parseInt(match[2]);
  const players = match[3].trim() ? match[3].trim().split(', ').map(n => n.trim()).filter(Boolean) : [];
  return { online, max, players };
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse hatası')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
