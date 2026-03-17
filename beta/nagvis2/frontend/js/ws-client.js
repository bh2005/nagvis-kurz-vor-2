// NagVis 2 – ws-client.js
// WebSocket-Client, Demo-WS-Client, detectDemoMode,
// Demo-Daten (DEMO_MAP / DEMO_STATUS), Verbindungen, api()-Wrapper.
'use strict';

//  WEBSOCKET CLIENT
// ═══════════════════════════════════════════════════════════════════════

function makeWsClient(mapId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url   = `${proto}://${location.host}/ws/map/${mapId}`;

  const client = {
    mapId, ws: null, _dead: false, _delay: 2000,

    connect() {
      if (this._dead) return;
      this.ws = new WebSocket(url);
      this.ws.onopen    = () => { this._delay = 2000; onWsOpen(); };
      this.ws.onmessage = e => { try { onWsMsg(JSON.parse(e.data)); } catch { } };
      this.ws.onclose   = () => {
        if (this._dead) return;
        onWsClose();
        setTimeout(() => this.connect(), this._delay);
        this._delay = Math.min(this._delay * 1.5, 30_000);
      };
      this.ws.onerror = () => { };
    },

    send(data) {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
    },

    forceRefresh() { this.send({ cmd: 'force_refresh' }); },

    disconnect() { this._dead = true; this.ws?.close(); },
  };

  return client;
}

function onWsOpen()  { setConnDot('connected');    setSidebarLive(true,  'Livestatus · verbunden'); }
function onWsClose() { setConnDot('disconnected'); setSidebarLive(false, 'Getrennt – verbinde…');   setStatusBar('Verbindung unterbrochen…'); }


// ═══════════════════════════════════════════════════════════════════════
//  WEBSOCKET MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════

function onWsMsg(ev) {
  switch (ev.event) {

    case 'snapshot':
      applyStatuses(ev.hosts ?? [], ev.services ?? []);
      updateTopbarPills(ev.hosts ?? []);
      renderHostsPanel(ev.hosts ?? []);
      fillHostDatalist(ev.hosts ?? []);
      setStatusBar(`${fmt(ev.ts)} · Snapshot · ${ev.hosts?.length ?? 0} Hosts`);
      break;

    case 'status_update': {
      applyStatuses(ev.hosts ?? [], ev.services ?? []);
      updateTopbarPills(Object.values(hostCache));
      renderHostsPanel(Object.values(hostCache));
      appendEvents(ev.hosts ?? [], ev.services ?? [], ev.ts);
      if (ev.downtime_started?.length) showDowntimeBanner(ev.downtime_started, true);
      if (ev.downtime_ended?.length)   showDowntimeBanner(ev.downtime_ended,   false);
      const n = (ev.hosts?.length ?? 0) + (ev.services?.length ?? 0);
      setStatusBar(`${fmt(ev.ts)} · ${n} Änderung${n !== 1 ? 'en' : ''} · ${ev.elapsed}ms`);
      break;
    }

    case 'heartbeat':
      setStatusBar(`${fmt(ev.ts)} · live ♥`);
      break;

    case 'object_added':
      if (ev.map_id === activeMapId) {
        const el = createNode(ev.object);
        if (el && editActive) makeDraggable(el);
      }
      break;

    case 'object_removed':
      document.getElementById(`nv2-${ev.object_id}`)?.remove();
      break;

    case 'gadget_update': {
      const gadget = document.getElementById(`nv2-${ev.object_id}`);
      if (gadget) updateGadget(gadget, ev);
      break;
    }

    case '_connected':    setConnDot('connected');    break;
    case '_disconnected': setConnDot('disconnected'); break;
    case 'backend_error': setStatusBar(`⚠ ${ev.message}`); break;
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  DEMO MODE
// ═══════════════════════════════════════════════════════════════════════

const DEMO_MAP = {
  id: "demo-features", title: "NagVis 2 – Feature Demo", background: null, canvas: { mode: "ratio", ratio: "16:9" },
  objects: [
    { object_id:"host::srv-web-01::abc123",  type:"host",     name:"srv-web-01",  x:15, y:20, iconset:"server",   label:"Webserver 01 (OK)" },
    { object_id:"host::srv-db-01::def456",   type:"host",     name:"srv-db-01",   x:35, y:20, iconset:"database", label:"Datenbank (ACK + DT)" },
    { object_id:"service::srv-web-01::HTTP", type:"service",  name:"HTTP Response Time", host_name:"srv-web-01", x:15, y:35, iconset:"default", label:"HTTP (CRITICAL)" },
    { object_id:"hostgroup::webservers",     type:"hostgroup",name:"webservers",   x:55, y:20, iconset:"default", label:"Alle Webserver" },
    { object_id:"textbox::zone-a",           type:"textbox",  text:"Zone A – Produktion", x:8, y:8, w:18, h:5, font_size:16, bold:true, color:"#0ea5e9", bg_color:"rgba(14,165,233,0.08)" },
    { object_id:"line::connection-1",        type:"line",     x:30, y:30, x2:70, y2:70, line_style:"dashed", line_width:2, color:"#475569" },
    { object_id:"line::wm-srv-db",           type:"line",     x:15, y:20, x2:35, y2:20,
      line_type:"weathermap", host_from:"srv-web-01", host_to:"srv-db-01",
      label_from:"42 Mbps", label_to:"18 Mbps", line_width:5, line_style:"solid", line_split:true, show_arrow:true },
    { object_id:"map::datacenter-b",         type:"map",      name:"datacenter-b", x:75, y:35, iconset:"map", label:"Datacenter B (nested)" },
    { object_id:"gadget::cpu-01",     type:"gadget", x:25, y:55,
      gadget_config:{ type:"radial",    metric:"CPU Load",   value:42, unit:"%",    min:0, max:100, warning:70, critical:90 }, label:"CPU Load" },
    { object_id:"gadget::memory-01",  type:"gadget", x:45, y:55,
      gadget_config:{ type:"linear",    metric:"RAM",        value:78, unit:"%",    min:0, max:100, warning:75, critical:90 }, label:"RAM" },
    { object_id:"gadget::traffic-01", type:"gadget", x:25, y:72,
      gadget_config:{ type:"sparkline", metric:"Traffic Out",value:68,
        history:[45,52,61,58,72,68,80,75,62,68,55,70,65,78,82,60,68,74,71,69] }, label:"Traffic Out" },
    { object_id:"gadget::flow-01",    type:"gadget", x:50, y:72,
      gadget_config:{ type:"weather",   metric:"Backbone",   value:620, unit:"Mbps", max:1000 }, label:"Backbone 1G" },
    { object_id:"gadget::raw-01",     type:"gadget", x:70, y:55,
      gadget_config:{ type:"rawnumber", metric:"Disk I/O",   value:3752690, unit:"B/s",
        display_unit:"MB/s", divide:1048576, min:0, max:200, warning:150, critical:190 }, label:"Disk I/O" },
    { object_id:"gadget::thermo-01",  type:"gadget", x:85, y:55,
      gadget_config:{ type:"thermometer", metric:"CPU Temp", value:62, unit:"°C",
        min:0, max:100, warning:70, critical:85 }, label:"CPU Temp" },
  ]
};

const DEMO_STATUS = [
  { name:"srv-web-01",  state:0, state_label:"UP",   acknowledged:false, in_downtime:false, output:"PING OK - 1.4ms", services_ok:8, services_warn:0, services_crit:1, services_unkn:0 },
  { name:"srv-db-01",   state:0, state_label:"UP",   acknowledged:true,  in_downtime:true,  output:"PING OK - 0.8ms", services_ok:5, services_warn:1, services_crit:0, services_unkn:0 },
  { name:"srv-backup",  state:1, state_label:"DOWN", acknowledged:false, in_downtime:false, output:"Connection refused", services_ok:0, services_warn:0, services_crit:3, services_unkn:0 },
  { name:"srv-monitor", state:0, state_label:"UP",   acknowledged:false, in_downtime:false, output:"PING OK - 2.1ms", services_ok:12, services_warn:2, services_crit:0, services_unkn:0 },
];

window._demoMode = false;
window._demoMaps = [
  { id:"demo-features", title:"NagVis 2 – Feature Demo", background:null, canvas: { mode:"ratio", ratio:"16:9" }, object_count:DEMO_MAP.objects.length }
];

window._connections = JSON.parse(localStorage.getItem('nv2-connections') || '[]');
if (!_connections.length) {
  _connections = [{ id:'local', name:'Lokal (Demo)', type:'demo', host:'', port:'', site:'', active:true }];
}
function _saveConnections() {
  localStorage.setItem('nv2-connections', JSON.stringify(_connections));
}

async function detectDemoMode() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(600) });
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      // Backend meldet sich selbst als Demo (kein Livestatus konfiguriert)
      if (data.demo_mode) {
        _demoMode = true;
        _activateDemoUI();
      } else {
        _demoMode = false;
      }
      return;
    }
  } catch { }
  // Kein Backend erreichbar → Demo-Modus
  _demoMode = true;
  _activateDemoUI();
}

function _activateDemoUI() {
  console.info('[NV2] Demo-Modus aktiv');
  setSidebarLive(true, 'Demo-Modus · kein Backend');
  setStatusBar('Demo-Modus · statische Daten');
  document.getElementById('nv2-conn-dot').className = 'conn-dot connected';
  // Demo-Banner einblenden
  const banner = document.getElementById('nv2-demo-banner');
  if (banner) banner.style.display = 'flex';
  // Demo-Map automatisch öffnen (kleines Delay damit loadMaps()+renderOverview() zuerst laufen)
  setTimeout(() => { if (!activeMapId) openMap('demo-features'); }, 300);
}

function makeDemoWsClient(mapId) {
  let _interval = null;
  return {
    mapId, ws: null, _dead: false,
    connect() {
      if (this._dead) return;
      setTimeout(() => {
        if (this._dead) return;
        onWsMsg({ event:'snapshot', ts:Date.now()/1000, hosts:DEMO_STATUS, services:[] });
        onWsOpen();
      }, 200);
      _interval = setInterval(() => {
        if (this._dead) { clearInterval(_interval); return; }
        const changed  = DEMO_STATUS[Math.floor(Math.random() * DEMO_STATUS.length)];
        const states   = ['UP','UP','UP','DOWN','WARNING'];
        const newState = states[Math.floor(Math.random() * states.length)];
        const fake = { ...changed, state_label:newState, output:newState==='UP'?'PING OK':'Check failed', change_type:'state_change' };
        onWsMsg({ event:'status_update', ts:Date.now()/1000, elapsed:Math.floor(Math.random()*30)+5, hosts:[fake], services:[] });
      }, 8000);
    },
    forceRefresh() { onWsMsg({ event:'snapshot', ts:Date.now()/1000, hosts:DEMO_STATUS, services:[] }); },
    disconnect() { this._dead = true; clearInterval(_interval); },
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  API WRAPPER
// ═══════════════════════════════════════════════════════════════════════

async function api(path, method = 'GET', body = null) {
  if (_demoMode) {
    // ── Kiosk-User Demo-Mode-Handlers ──────────────────────────────────
    if (path === '/api/kiosk-users' && method === 'GET') {
      return JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
    }
    if (path === '/api/kiosk-users' && method === 'POST') {
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
      const u = { ...body,
        id:    body.id    || Math.random().toString(36).slice(2),
        token: body.token || Math.random().toString(36).slice(2, 26),
      };
      users.push(u);
      localStorage.setItem('nv2-kiosk-users', JSON.stringify(users));
      return u;
    }
    const _kioskPut = path.match(/^\/api\/kiosk-users\/([\w-]+)$/);
    if (_kioskPut && method === 'PUT') {
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
      const idx = users.findIndex(u => u.id === _kioskPut[1]);
      if (idx >= 0) { Object.assign(users[idx], body); localStorage.setItem('nv2-kiosk-users', JSON.stringify(users)); return users[idx]; }
      return null;
    }
    const _kioskDel = path.match(/^\/api\/kiosk-users\/([\w-]+)$/);
    if (_kioskDel && method === 'DELETE') {
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]').filter(u => u.id !== _kioskDel[1]);
      localStorage.setItem('nv2-kiosk-users', JSON.stringify(users));
      return true;
    }
    if (path.startsWith('/api/kiosk-users/resolve')) {
      const t = new URL(location.href).searchParams.get('token') || path.split('token=')[1];
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
      const found = users.find(u => u.token === t);
      return found ? { ...found } : null;
    }

    // ── Standard Demo-Mode Handlers ────────────────────────────────────
    if (path === '/api/maps' && method === 'GET') return [..._demoMaps];

    if (path === '/api/maps' && method === 'POST') {
      const id  = body.map_id || body.title.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      const map = { id, title:body.title, background:null, canvas: body.canvas ?? { mode:'free' }, objects:[] };
      _demoMaps.push({ ...map, object_count:0 });
      return { ...map };
    }

    const mGet = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mGet && method === 'GET') {
      if (mGet[1] === 'demo-features') return JSON.parse(JSON.stringify(DEMO_MAP));
      const found = _demoMaps.find(m => m.id === mGet[1]);
      if (found) return JSON.parse(JSON.stringify({ ...found, objects: found.objects ?? [], canvas: found.canvas ?? { mode: 'free' } }));
      return null;
    }

    const mDel = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mDel && method === 'DELETE') { _demoMaps = _demoMaps.filter(m => m.id !== mDel[1]); return true; }

    const mObj = path.match(/^\/api\/maps\/([\w-]+)\/objects$/);
    if (mObj && method === 'POST') {
      const obj = { ...body, object_id:`${body.type}::${body.name||''}::${Math.random().toString(36).slice(2,8)}` };
      const map = _demoMaps.find(m => m.id === mObj[1]);
      if (map) map.object_count = (map.object_count || 0) + 1;
      return obj;
    }
    if (method === 'PATCH' || (method === 'DELETE' && path.includes('/objects/'))) return method === 'DELETE' ? true : body;

    const mCanvas = path.match(/^\/api\/maps\/([\w-]+)\/canvas$/);
    if (mCanvas && method === 'PUT') {
      const m = _demoMaps.find(m => m.id === mCanvas[1]);
      if (m) m.canvas = body;
      return body;
    }
    if (path === '/api/health') return { status:'ok', demo_mode:true };
    console.warn('[NV2] Demo: unhandled API call', method, path);
    return null;
  }

  try {
    const opts = { method, headers:{} };
    if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(path, opts);
    if (!r.ok) { console.warn(`[NV2] API ${method} ${path} → ${r.status}`); return null; }
    if (method === 'DELETE') return true;
    return r.json();
  } catch (err) {
    console.error('[NV2] api() error:', err);
    return null;
  }
}