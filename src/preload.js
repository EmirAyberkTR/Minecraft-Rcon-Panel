const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mcapi', {
  // Pencere
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // RCON
  rconConnect:    (opts) => ipcRenderer.invoke('rcon-connect', opts),
  rconDisconnect: ()     => ipcRenderer.invoke('rcon-disconnect'),
  rconSend:       (cmd)  => ipcRenderer.invoke('rcon-send', cmd),

  // Agent
  agentConnect:  (opts) => ipcRenderer.invoke('agent-connect', opts),
  agentMetrics:  ()     => ipcRenderer.invoke('agent-metrics'),

  // Polling
  startPolling: (ms) => ipcRenderer.invoke('start-polling', ms),
  stopPolling:  ()   => ipcRenderer.invoke('stop-polling'),

  // Renderer'a gelen olaylar
  on: (channel, cb) => {
    const allowed = ['rcon-error','rcon-disconnected','players-update','metrics-update', 'agent-log-update'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => cb(data));
    }
  },
  off: (channel) => ipcRenderer.removeAllListeners(channel),
});
