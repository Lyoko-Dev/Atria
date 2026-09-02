const pages = {
  es: 'http://127.0.0.1:4173/es/index.html',
  en: 'http://127.0.0.1:4173/en/index.html',
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
const page = browser.find(item => item.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('Chrome CDP page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
function cdp(method, params = {}) {
  return new Promise(resolve => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
}
async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text || 'Browser evaluation failed');
  return response.result?.result?.value;
}
const results = [];
for (const [lang, url] of Object.entries(pages)) {
  await cdp('Page.navigate', { url });
  await sleep(1800);
  results.push({
    lang,
    title: await evaluate('document.title'),
    pathname: await evaluate('location.pathname'),
    layer0: await evaluate('!!document.querySelector("#layer-0")'),
    shell: await evaluate('!!document.querySelector("#shell")'),
    appScript: await evaluate('typeof navigateTo === "function"'),
    storageRoundtrip: await evaluate(`(() => { const k='atria_smoke_${lang}'; localStorage.setItem(k, JSON.stringify({ok:true,lang:'${lang}'})); const v=JSON.parse(localStorage.getItem(k)); localStorage.removeItem(k); return v.ok && v.lang==='${lang}' && !localStorage.getItem(k); })()`),
    crypto: await evaluate('!!(window.crypto?.subtle)'),
  });
}
console.log(JSON.stringify(results, null, 2));
ws.close();
