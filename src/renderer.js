// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  rconConnected: false,
  agentConnected: false,
  players: [],         // [{name, ping, op, world}]
  opList: [],
  logs: [],
  plugins: [],
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── Tab navigation ────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

// ── Titlebar controls ─────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click', () => window.mcapi.minimize());
document.getElementById('btn-max').addEventListener('click', () => window.mcapi.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.mcapi.close());

// ── Settings — RCON connect ───────────────────────────────────────────────────
document.getElementById('btn-rcon-connect').addEventListener('click', async () => {
  const host = document.getElementById('s-host').value.trim();
  const port = document.getElementById('s-rcon-port').value.trim();
  const password = document.getElementById('s-pass').value;
  const fb = document.getElementById('rcon-feedback');

  fb.className = 'conn-feedback';
  fb.textContent = 'Bağlanıyor...';

  const res = await window.mcapi.rconConnect({ host, port, password });
  if (res.success) {
    state.rconConnected = true;
    fb.className = 'conn-feedback ok';
    fb.textContent = '✓ RCON bağlantısı kuruldu';
    setConnStatus(true);
    toast('RCON bağlandı', 'ok');
    await onRconConnected();
  } else {
    state.rconConnected = false;
    fb.className = 'conn-feedback err';
    fb.textContent = '✗ ' + res.error;
    toast('Bağlantı hatası: ' + res.error, 'err');
  }
});

document.getElementById('btn-rcon-disconnect').addEventListener('click', async () => {
  await window.mcapi.rconDisconnect();
  state.rconConnected = false;
  setConnStatus(false);
  document.getElementById('rcon-feedback').className = 'conn-feedback';
  document.getElementById('rcon-feedback').textContent = '';
  toast('Bağlantı kesildi');
});

// ── Settings — Agent connect ───────────────────────────────────────────────────
document.getElementById('btn-agent-connect').addEventListener('click', async () => {
  const host = document.getElementById('a-host').value.trim();
  const port = document.getElementById('a-port').value.trim();
  const fb = document.getElementById('agent-feedback');

  fb.className = 'conn-feedback';
  fb.textContent = 'Agent\'a bağlanıyor...';

  const res = await window.mcapi.agentConnect({ host, port });
  if (res.success) {
    state.agentConnected = true;
    fb.className = 'conn-feedback ok';
    fb.textContent = `✓ Agent bağlandı (v${res.version || '1.0'})`;
    toast('Agent bağlandı', 'ok');
    
    fetchOp();
    
    try {
      const mRes = await window.mcapi.agentMetrics();
      if (mRes && mRes.success) {
         renderMetrics(mRes.data);
      } else {
         toast('Agent CPU/RAM çekilemedi (Hata)', 'err');
      }
    } catch (e) {
      console.error(e);
      toast('Agent CPU/RAM çekilemedi (CORS)', 'err');
    }
    
  } else {
    state.agentConnected = false;
    fb.className = 'conn-feedback err';
    fb.textContent = '✗ ' + res.error;
    toast('Agent hatası: ' + res.error, 'err');
  }
});
// ── After RCON connected ───────────────────────────────────────────────────────
async function onRconConnected() {
  await fetchVersion();
  await fetchPlayers();
  fetchPlugins();
  await fetchOp();
  window.mcapi.startPolling(1000);
  addLog('info', 'RCON bağlantısı kuruldu.');
}

// ── RCON events (from main) ────────────────────────────────────────────────────
window.mcapi.on('rcon-error', (msg) => {
  state.rconConnected = false;
  setConnStatus(false);
  toast('RCON hatası: ' + msg, 'err');
  addLog('err', 'RCON hatası: ' + msg);
});

window.mcapi.on('rcon-disconnected', () => {
  state.rconConnected = false;
  setConnStatus(false);
  addLog('warn', 'RCON bağlantısı kesildi.');
});

window.mcapi.on('players-update', (data) => {
  updatePlayersFromPoll(data);
});

window.mcapi.on('metrics-update', (metrics) => {
  renderMetrics(metrics);
});

// ── Send RCON command ─────────────────────────────────────────────────────────
async function sendCmd(cmd) {
  if (!state.rconConnected) { toast('Önce RCON\'a bağlan', 'err'); return; }
  const ts = now();
  addLog('cmd', '> ' + cmd);
  const res = await window.mcapi.rconSend(cmd);
  if (res.success) {
    if (res.response) addLog('out', res.response);
  } else {
    addLog('err', res.error);
    toast(res.error, 'err');
  }
}
window.sendCmd = sendCmd;

// ── Console UI ────────────────────────────────────────────────────────────────
const consoleInp = document.getElementById('console-inp');
document.getElementById('console-send').addEventListener('click', () => sendFromConsole());
consoleInp.addEventListener('keydown', e => { if (e.key === 'Enter') sendFromConsole(); });

function sendFromConsole() {
  const val = consoleInp.value.trim();
  if (!val) return;
  consoleInp.value = '';
  sendCmd(val);
}

// Quick commands
document.querySelectorAll('.qbtn').forEach(btn => {
  btn.addEventListener('click', () => sendCmd(btn.dataset.cmd));
});

// Broadcast
document.getElementById('bc-send').addEventListener('click', () => {
  const msg = document.getElementById('bc-inp').value.trim();
  if (!msg) return;
  sendCmd(`say ${msg}`);
  document.getElementById('bc-inp').value = '';
  toast('Mesaj gönderildi');
});

// ── Logs ──────────────────────────────────────────────────────────────────────
function addLog(type, msg) {
  const ts = now();
  state.logs.push({ ts, type, msg });
  if (state.logs.length > 300) state.logs.shift();
  renderLogs();
}

function renderLogs() {
  const out = document.getElementById('console-out');
  const mini = document.getElementById('d-log-mini');
  const typeClass = { info:'log-info', warn:'log-warn', err:'log-err', join:'log-join', leave:'log-leave', cmd:'log-cmd', out:'log-out' };

  const html = state.logs.map(l =>
    `<div><span class="log-ts">[${l.ts}]</span><span class="${typeClass[l.type]||'log-info'}">${escHtml(l.msg)}</span></div>`
  ).join('');

  out.innerHTML = html;
  out.scrollTop = out.scrollHeight;

  const last5 = state.logs.slice(-6).reverse();
  mini.innerHTML = last5.map(l =>
    `<div><span class="log-ts">[${l.ts}]</span><span class="${typeClass[l.type]||'log-info'}">${escHtml(l.msg)}</span></div>`
  ).join('');
}

// ── Version ───────────────────────────────────────────────────────────────────
async function fetchVersion() {
  const res = await window.mcapi.rconSend('version');
  if (res.success && res.response) {
    let verText = res.response;
    
    // "Checking version, please wait..." mesajını temizle
    if (verText.toLowerCase().includes('please wait')) {
      const lines = verText.split('\n').filter(l => !l.toLowerCase().includes('please wait') && l.trim() !== '');
      if (lines.length > 0) verText = lines[0];
    }

    const match = verText.match(/(Purpur|Paper|Spigot|Bukkit) version [^\s]+/i);
    const ver = match ? match[0] : verText.split('\n')[0].replace(/This server is running /i, '').split(' (')[0];
    
    document.getElementById('srv-version').textContent = '— ' + ver;
    addLog('info', res.response.split('\n')[0]);
  }
}

// ── Players ───────────────────────────────────────────────────────────────────
async function fetchPlayers() {
  const res = await window.mcapi.rconSend('list');
  if (!res.success) return;
  const { online, max, players } = parseList(res.response);

  // Mevcut oyuncu verisini güncelle
  state.players = players.map(name => {
    const existing = state.players.find(p => p.name === name);
    return existing || { name, ping: '?', op: state.opList.includes(name), world: '?' };
  });

  updatePlayerUI(online, max);
}

function parseList(raw) {
  const match = raw.match(/(\d+) of a max of (\d+).*?:\s*(.*)/s);
  if (!match) return { online: 0, max: 20, players: [] };
  const online = parseInt(match[1]);
  const max = parseInt(match[2]);
  const players = match[3].trim() ? match[3].trim().split(/,\s*/).filter(Boolean) : [];
  return { online, max, players };
}

function updatePlayersFromPoll(data) {
  const { online, max, players: names } = data;
  state.players = names.map(name => {
    const existing = state.players.find(p => p.name === name);
    return existing || { name, ping: '?', op: state.opList.includes(name), world: '?' };
  });
  updatePlayerUI(online, max);
}

function updatePlayerUI(online, max) {
  // Metric card
  document.getElementById('m-players').textContent = online;
  document.getElementById('m-players-sub').textContent = `${online} / ${max} slot`;
  document.getElementById('bar-players').style.width = (online / max * 100) + '%';

  // Nav badge
  const badge = document.getElementById('nav-player-count');
  badge.textContent = online;
  badge.style.display = online > 0 ? 'inline' : 'none';

  // Player header
  document.getElementById('player-header-sub').textContent = `${online} / ${max} oyuncu`;
  document.getElementById('d-player-badge').textContent = online;

  // Dashboard mini list
  renderPlayerList('d-player-list', true);
  // Players tab full list
  renderPlayerList('player-table', false);
  // Console side
  renderPlayerList('console-players', true);
}

function renderPlayerList(containerId, mini) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (state.players.length === 0) {
    c.innerHTML = '<div class="empty-state">Sunucuda oyuncu yok.</div>';
    return;
  }
  c.innerHTML = state.players.map(p => {
    const pingColor = p.ping === '?' ? 'var(--text1)' : p.ping < 50 ? '#4ade80' : p.ping < 100 ? '#f59e0b' : '#ef4444';
    return `<div class="player-row">
      <div class="player-info">
        <img src="https://minotar.net/helm/${p.name}/40.png" style="width: 32px; height: 32px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        <div>
          <div class="player-name">${escHtml(p.name)}${p.op ? '<span class="op-tag">OP</span>' : ''}</div>
          <div class="player-meta" style="color:${pingColor}">${p.ping}ms${p.world !== '?' ? ' · ' + p.world : ''}</div>
        </div>
      </div>
      ${!mini ? `<div class="player-actions">
        <button class="act-btn g" onclick="openTpModal('${p.name}')">tp</button>
        <button class="act-btn" onclick="openMsgModal('${p.name}')">msg</button>
        <button class="act-btn w" onclick="confirmKick('${p.name}')">kick</button>
        <button class="act-btn r" onclick="confirmBan('${p.name}')">ban</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function confirmKick(name) {
  if (confirm(`${name} oyuncusunu kick'lemek istiyor musun?`)) sendCmd(`kick ${name}`);
}
function confirmBan(name) {
  if (confirm(`${name} oyuncusunu banlamak istiyor musun?`)) sendCmd(`ban ${name}`);
}
window.confirmKick = confirmKick;
window.confirmBan = confirmBan;

// ── Op management ─────────────────────────────────────────────────────────────
async function fetchOp() {
  const c = document.getElementById('op-list');
  
  if (!state.agentConnected) {
    c.innerHTML = '<div class="empty-state" style="padding:16px 0">Op listesi için agent bağlantısı gerekli.</div>';
    return;
  }

  try {
    // ARTIK DOĞRUDAN ARKA PLANDAN ÇEKİYORUZ (CORS YOK!)
    const res = await window.mcapi.agentOps();

    if (!res.success) {
       c.innerHTML = `<div class="empty-state" style="padding:16px 0; color: #ef4444;">Bağlantı Hatası: ${res.error}</div>`;
       return;
    }

    const data = res.data;

    if (data.error) {
       c.innerHTML = `<div class="empty-state" style="padding:16px 0; color: #ef4444;">Ajan Hatası: ${data.error}</div>`;
       return;
    }

    state.opList = data.ops || [];
    state.players.forEach(p => { p.op = state.opList.includes(p.name); });

    if (state.opList.length === 0) {
      c.innerHTML = '<div class="empty-state" style="padding:16px 0">Şu an sunucuda kimse OP değil.</div>';
      renderPlayerList('player-table', false); 
      renderPlayerList('d-player-list', true);
      return;
    }

    c.innerHTML = state.opList.map(op => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; border-bottom: 1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="https://minotar.net/helm/${op}/24.png" style="width:24px; height:24px; border-radius:4px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
          <span style="font-weight: 500;">${op}</span>
        </div>
        <button class="btn-ghost sm" onclick="takeOp('${op}')" style="color: #ef4444; border-color: #ef444433;">Yetkiyi Al</button>
      </div>
    `).join('');

    renderPlayerList('player-table', false);
    renderPlayerList('d-player-list', true);

  } catch (err) {
    console.error("Op listesi çekme hatası:", err);
    c.innerHTML = `<div class="empty-state" style="padding:16px 0; color: #ef4444;">Sistem Hatası: ${err.message}</div>`;
  }
}
// ── Plugins (Tam ve Hatasız Sürüm) ─────────────────────────────────────────

async function fetchPlugins() {
  try {
    const res = await window.mcapi.rconSend('plugins');
    if (!res.success) return;

    let raw = res.response.replace(/§[0-9a-fk-orx]/gi, '');
    raw = raw.replace(/[a-zA-Z]+\s*Plugins\s*\(\d+\):/gi, '');

    const names = raw.split(',')
                   .map(n => n.replace(/^[-:\s]+/, '').trim())
                   .filter(n => n.length > 0);

    let list = [];
    const subHeader = document.getElementById('plugin-header-sub');
    if(subHeader) subHeader.textContent = `${names.length} plugin bulunuyor...`;

    // Sunucu bağlantıyı kesmesin diye aralara 150ms bekleme ekledik
    for (let name of names) {
      let pObj = { name: name, enabled: true, ver: 'Yükleniyor...', author: '—', desc: '' };

      try {
        await new Promise(r => setTimeout(r, 150)); 
        const detailRes = await window.mcapi.rconSend(`version ${name}`);
        
        if (detailRes.success && detailRes.response) {
          let detailRaw = detailRes.response.replace(/§[0-9a-fk-orx]/gi, '');
          const lines = detailRaw.split('\n').map(l => l.trim());

          const verMatch = lines[0].match(/version\s+(.+)/i);
          if (verMatch) pObj.ver = verMatch[1];

          const authorLine = lines.find(l => l.toLowerCase().startsWith('author'));
          if (authorLine) pObj.author = authorLine.split(':')[1].trim();

          const descLine = lines.find(l => l.toLowerCase().startsWith('description'));
          if (descLine) pObj.desc = descLine.split(':')[1].trim();
        }
      } catch (err) {
        pObj.ver = 'Bilinmiyor';
      }
      
      list.push(pObj);
      state.plugins = list;
      
      // Ekranda renderPluginList varsa çizdir
      if (typeof renderPluginList === "function") renderPluginList();
    }

    if(subHeader) subHeader.textContent = `${list.length} plugin`;

  } catch (error) {
    console.error("Eklenti çekme hatası:", error);
  }
}

function renderPluginList() {
  const c = document.getElementById('plugin-list');
  if (!c) return; // Hata koruması
  
  if (state.plugins.length === 0) {
    c.innerHTML = '<div class="empty-state" style="padding:16px 0">Plugin bulunamadı.</div>';
    return;
  }
  
  c.innerHTML = state.plugins.map((p, i) => `
    <div class="plugin-row" onclick="showPlugin(${i})">
      <div>
        <div class="plugin-name">${escHtml(p.name)}</div>
        <div class="plugin-ver">v${p.ver}</div>
      </div>
      <span class="badge ${p.enabled ? 'on' : 'off'}">${p.enabled ? 'aktif' : 'devre dışı'}</span>
    </div>`).join('');
}

function showPlugin(i) {
  const p = state.plugins[i];
  document.getElementById('plugin-detail').innerHTML = `
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <tr><td style="color:var(--text1);padding:5px 0">İsim</td><td style="text-align:right;font-weight:500">${escHtml(p.name)}</td></tr>
      <tr><td style="color:var(--text1);padding:5px 0">Versiyon</td><td style="text-align:right;font-family:var(--mono)">${p.ver}</td></tr>
      <tr><td style="color:var(--text1);padding:5px 0">Yazar</td><td style="text-align:right">${escHtml(p.author)}</td></tr>
      <tr><td style="color:var(--text1);padding:5px 0">Durum</td><td style="text-align:right"><span class="badge ${p.enabled?'on':'off'}">${p.enabled?'aktif':'devre dışı'}</span></td></tr>
      ${p.desc ? `<tr><td colspan="2" style="padding-top:10px;color:var(--text1);font-size:11px;line-height:1.5">${escHtml(p.desc)}</td></tr>` : ''}
    </table>`;
}

window.showPlugin = showPlugin;

// ── Metrics (from agent) ──────────────────────────────────────────────────────
function renderMetrics(m) {
  // CPU
  const cpuPct = Math.round(m.cpu_percent || 0);
  document.getElementById('m-cpu').textContent = cpuPct + '%';
  document.getElementById('m-cpu-sub').textContent = (m.cpu_cores || '?') + ' çekirdek';
  document.getElementById('bar-cpu').style.width = cpuPct + '%';
  document.getElementById('bar-cpu').style.background = cpuPct > 80 ? '#ef4444' : cpuPct > 60 ? '#f59e0b' : '#f59e0b';

  // RAM
  const ramUsed = fmtBytes(m.ram_used || 0);
  const ramTotal = fmtBytes(m.ram_total || 0);
  const ramPct = Math.round((m.ram_used || 0) / (m.ram_total || 1) * 100);
  document.getElementById('m-ram').textContent = ramUsed;
  document.getElementById('m-ram-sub').textContent = ramTotal + ' üzerinden';
  document.getElementById('bar-ram').style.width = ramPct + '%';

  // Disk
  if (m.disk_used !== undefined) {
    const diskPct = Math.round((m.disk_used || 0) / (m.disk_total || 1) * 100);
    document.getElementById('m-disk').textContent = fmtBytes(m.disk_used);
    document.getElementById('m-disk-sub').textContent = fmtBytes(m.disk_total) + ' üzerinden';
    document.getElementById('bar-disk').style.width = diskPct + '%';
  }

  // Uptime
  if (m.uptime_seconds !== undefined) {
    const chip = document.getElementById('uptime-chip');
    chip.textContent = '⏱ ' + fmtUptime(m.uptime_seconds);
    chip.style.display = 'inline';
  }
}

// ── Refresh all ───────────────────────────────────────────────────────────────
async function refreshAll() {
  if (!state.rconConnected) { toast('RCON bağlı değil', 'err'); return; }
  await fetchVersion();
  await fetchPlayers();
  fetchPlugins();
  if (state.agentConnected) {
    const res = await window.mcapi.agentMetrics();
    if (res.success) renderMetrics(res.data);
  }
  toast('Yenilendi', 'ok');
}
window.refreshAll = refreshAll;

// ── Status helpers ────────────────────────────────────────────────────────────
function setConnStatus(connected) {
  const dot = document.getElementById('status-dot');
  const lbl = document.getElementById('status-label');
  if (connected) {
    dot.classList.remove('off');
    lbl.textContent = 'Bağlı';
  } else {
    dot.classList.add('off');
    lbl.textContent = 'Bağlı değil';
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString('tr', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}g ${h}s`;
  if (h > 0) return `${h}s ${m}d`;
  return `${m}d`;
}

// ── Canlı Log (latest.log) Takibi ──────────────────────────────────────────────
let lastLogLine = null;

window.mcapi.on('agent-log-update', (lines) => {
  if (!lines || lines.length === 0) return;

  // Panel ilk açıldığında doğrudan son satırı baz al ve hepsini ekrana bas
  if (!lastLogLine) {
    lastLogLine = lines[lines.length - 1];
    lines.forEach(line => addLog('out', line));
    return;
  }

  // Hafızadaki son satırı yeni gelen listede ara
  const idx = lines.lastIndexOf(lastLogLine);

  if (idx === lines.length - 1) {
    return; // Hiç yeni satır eklenmemiş, bir şey yapma
  }

  let newLines = [];
  if (idx === -1) {
    // Son gördüğümüz satır artık listede yok (sunucuya çok fazla log akmış)
    newLines = lines; 
  } else {
    // Sadece son okuduğumuz satırdan sonraki YENİ satırları al
    newLines = lines.slice(idx + 1);
  }

  if (newLines.length > 0) {
    lastLogLine = newLines[newLines.length - 1]; // Son satırı güncelle
    newLines.forEach(line => addLog('out', line)); // Yeni satırları konsola yazdır
  }
});

// ── Gerçek Ping Ölçümü (EssentialsX üzerinden) ──────────────────
// ── Gerçek Ping ve TPS Ölçümü ──────────────────────────────────
setInterval(async () => {
  if (!state.rconConnected) return;

  // 1. TPS Çekimi (RCON üzerinden)
  try {
    const tpsRes = await window.mcapi.rconSend('tps');
    if (tpsRes.success && tpsRes.response) {
      // Örnek çıktı: "TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0"
      const match = tpsRes.response.match(/:\s*\*?([\d\.]+)/);
      if (match) {
        const tpsVal = parseFloat(match[1]);
        document.getElementById('m-tps').textContent = tpsVal.toFixed(1);
        document.getElementById('m-tps-sub').textContent = tpsVal >= 19 ? 'Mükemmel' : tpsVal >= 15 ? 'İyi' : 'Düşük';
      }
    }
  } catch (err) {}

  // 2. Oyuncu Pingleri (EssentialsX üzerinden)
  if (state.players.length > 0) {
    for (let p of state.players) {
      try {
        const res = await window.mcapi.rconSend(`ping ${p.name}`);
        if (res.success && res.response) {
          const match = res.response.match(/(\d+)\s*ms/i);
          if (match) p.ping = parseInt(match[1]);
        }
      } catch (err) {}
    }
    renderPlayerList('d-player-list', true);
    renderPlayerList('player-table', false);
    renderPlayerList('console-players', true);
  }
}, 10000);

// ── Popup (Modal) Yönetimi ─────────────────────────────────────
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

// MSG Modalı
function openMsgModal(targetPlayer) {
  document.getElementById('modal-title').textContent = `${targetPlayer} - Özel Mesaj`;
  document.getElementById('modal-body').innerHTML = `
    <label class="field-label">Mesajınız:</label>
    <input type="text" id="modal-msg-inp" class="field" placeholder="Selam..." onkeydown="if(event.key==='Enter') submitMsg('${targetPlayer}')">
  `;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn-ghost" onclick="closeModal()">İptal</button>
    <button class="btn-primary" onclick="submitMsg('${targetPlayer}')">Gönder</button>
  `;
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-msg-inp').focus(), 100);
}

function submitMsg(targetPlayer) {
  const msg = document.getElementById('modal-msg-inp').value.trim();
  if (msg) {
    sendCmd(`msg ${targetPlayer} ${msg}`);
    closeModal();
    toast('Mesaj gönderildi', 'ok');
  }
}

// TP Modalı
function openTpModal(targetPlayer) {
  // Kendisi hariç diğer oyuncuları bul
  const others = state.players.filter(p => p.name !== targetPlayer).map(p => p.name);
  
  document.getElementById('modal-title').textContent = `${targetPlayer} - Işınla`;
  
  if (others.length === 0) {
    document.getElementById('modal-body').innerHTML = `<div class="empty-state">Sunucuda ışınlanacak başka oyuncu yok.</div>`;
    document.getElementById('modal-foot').innerHTML = `<button class="btn-ghost" onclick="closeModal()">Kapat</button>`;
  } else {
    // Diğer oyuncuları açılır listeye (dropdown) ekle
    const options = others.map(n => `<option value="${n}">${n}</option>`).join('');
    document.getElementById('modal-body').innerHTML = `
      <label class="field-label">Kime ışınlanacak?</label>
      <select id="modal-tp-sel" class="field" style="background:var(--bg0)">
        ${options}
      </select>
    `;
    document.getElementById('modal-foot').innerHTML = `
      <button class="btn-ghost" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="submitTp('${targetPlayer}')">Işınla</button>
    `;
  }
  document.getElementById('modal-overlay').classList.add('show');
}

function submitTp(targetPlayer) {
  const dest = document.getElementById('modal-tp-sel')?.value;
  if (dest) {
    sendCmd(`tp ${targetPlayer} ${dest}`);
    closeModal();
    toast(`Işınlanma başarılı`, 'ok');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
addLog('info', 'MC Panel başlatıldı. Ayarlar sekmesinden bağlan.');
