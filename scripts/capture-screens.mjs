import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/\//g, '\\');
const outDir = join(root, 'assets', 'Screenshot');
const profile = join(root, '.capture-chrome-profile');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const lang = process.env.ATRIA_CAPTURE_LANG || 'es';
const suffix = process.env.ATRIA_CAPTURE_SUFFIX || '';
const base = process.env.ATRIA_CAPTURE_BASE || `https://demos.lyokodev.com/${lang}/`;
mkdirSync(outDir, { recursive: true });

const port = 9224;
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(300); } }
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find(item => item.type === 'page' && item.url.startsWith(base))
  || tabs.find(item => item.type === 'page');
if (!tab) throw new Error('No browser page available for capture');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  const handler = event => { const msg = JSON.parse(event.data); if (msg.id !== id) return; ws.onmessage = null; msg.error ? reject(msg.error) : resolve(msg.result); };
  ws.onmessage = handler; ws.send(JSON.stringify({ id, method, params }));
});
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
await call('Runtime.evaluate', { expression: `localStorage.setItem('tid_alters', JSON.stringify([{id:'atria-demo-1',name:'Luna',role:'Host',pronouns:'elle',color:'#a08aff',bg:'rgba(160,138,255,.16)',emoji:'🌙',isAdmin:true},{id:'atria-demo-2',name:'Sol',role:'Protector/a',pronouns:'él',color:'#8affe0',bg:'rgba(138,255,224,.12)',emoji:'☀️'}])); localStorage.setItem('tid_tutorial_version','20260831-1'); location.reload();`});
await sleep(1800);
await call('Runtime.evaluate', { expression: `document.querySelector('.alter-card[data-id="atria-demo-1"]')?.click()` });
await sleep(900);
const routes = [
  ['capture-fronting.png', 'fronting'],
  ['capture-agenda.png', 'agenda'],
  ['capture-projects.png', 'proyectos'],
  ['capture-journal.png', 'diario'],
  ['capture-analytics.png', 'analisis'],
  ['capture-settings.png', 'config'],
  ['capture-profiles.png', 'perfiles'],
  ['capture-finances.png', 'finanzas'],
  ['capture-routines.png', 'rutinas'],
  ['capture-library.png', 'biblioteca'],
];
for (const [file, view] of routes) {
  await call('Runtime.evaluate', { expression: `window.navigateTo?.('${view}')` });
  await sleep(450);
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const outputFile = suffix ? file.replace('.png', `-${suffix}.png`) : file;
  await (await import('node:fs/promises')).writeFile(join(outDir, outputFile), Buffer.from(shot.data, 'base64'));
}
ws.close();
console.log(`Captured ${routes.length} screens in ${outDir}`);
