/* Tests für die alte Adresse gr3hab.github.io/numfact: Sie leitet nach https://ciphro.eu weiter und nimmt den Spielstand mit.
   Aufruf im Ordner _dev: npm test
   Ein kleiner Server spielt GitHub Pages nach (Seite unter /numfact/, 404.html für alles Unbekannte).
   https://ciphro.eu wird im Browser abgefangen: entweder ein Platzhalter oder, mit CIPHRO_DIR=/pfad/zu/ciphro,
   das echte neue Spiel (dann wird der ganze Umzug bis zum übernommenen Spielstand geprüft). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const CIPHRO_DIR = process.env.CIPHRO_DIR || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// Nur für die Tests: eine alte Offline-Hilfe, die angemeldet bleibt (wie die bisherige von NUMIGMA)
const OLD_SW = "self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.clients.claim())); self.addEventListener('fetch', () => {});";

function startServer() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/start.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end('<!doctype html><title>start</title>'); return; }
    if (u.pathname === '/numfact/__alt-sw.js' || u.pathname === '/andere/__alt-sw.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'] }); res.end(OLD_SW); return; }
    if (!u.pathname.startsWith('/numfact/')) { res.writeHead(404); res.end(); return; }
    let rel = decodeURIComponent(u.pathname.slice('/numfact/'.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    const hidden = rel.split('/').some(p => p.startsWith('_') || p.startsWith('.'));
    if (!hidden && file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res); return;
    }
    if (!hidden && fs.existsSync(path.join(file, 'index.html'))) { res.writeHead(301, { Location: u.pathname + '/' + u.search }); res.end(); return; }
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(c => server.close(c)) })));
}

// https://ciphro.eu abfangen: Platzhalter (zeigt, wohin weitergeleitet wurde) oder echtes Spiel aus CIPHRO_DIR
async function routeCiphro(ctx, real) {
  await ctx.route('https://ciphro.eu/**', route => {
    const u = new URL(route.request().url());
    if (!real) return route.fulfill({ status: 200, contentType: TYPES['.html'], body: '<!doctype html><title>ciphro</title>' });
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(CIPHRO_DIR, rel);
    if (!file.startsWith(CIPHRO_DIR) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
}

let srv, browser;
test.before(async () => { srv = await startServer(); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); await srv.close(); });

async function context(opt = {}) {
  const ctx = await browser.newContext({ locale: opt.locale || 'de-AT', timezoneId: 'Europe/Vienna', serviceWorkers: opt.sw ? 'allow' : 'block' });
  if (opt.time) await ctx.clock.install({ time: new Date(opt.time) });
  await routeCiphro(ctx, !!opt.real);
  return ctx;
}
// Spielstand auf der alten Adresse hinterlegen, dann den alten Link öffnen und warten, bis ciphro.eu erreicht ist
async function follow(ctx, link, stored) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  if (stored !== undefined) {
    await page.goto(srv.url + '/start.html');
    await page.evaluate(s => localStorage.setItem('numfact.v2', s), stored);
  }
  await page.goto(srv.url + link);
  await page.waitForURL(/^https:\/\/ciphro\.eu\//);
  return page;
}
const decode = hash => Buffer.from(hash.replace(/^#import=/, ''), 'base64url').toString('utf8');

// Ein Spielstand wie aus dem echten Spiel, mit Umlauten (Archiv #1–#8) und Sonderzeichen
const STORED = JSON.stringify({
  v: 2, seenHelp: true, lang: 'de', theme: 'dark', coach: { first: true },
  days: { '2026-10-22': { easy: { sig: 'GRÖSSTE STADT', typed: ['GROESSTE', 'STADT'], status: 'solved', elapsed: 64000, hints: {}, hintCount: 0, cuts: [], given: [], helped: [], startedOn: '2026-10-22', doneOn: '2026-10-22' } } },
  daysEn: {}, note: 'Ä Ö Ü ß € 😅 / + ='
});

test('Mit Spielstand: alter Link → ciphro.eu mit denselben Angaben, Spielstand unverändert im Anker', async () => {
  const ctx = await context();
  const page = await follow(ctx, '/numfact/?n=4&m=easy', STORED);
  const u = new URL(page.url());
  assert.equal(u.origin + u.pathname + u.search, 'https://ciphro.eu/?n=4&m=easy');
  assert.match(u.hash, /^#import=[A-Za-z0-9_-]+$/, 'Base64url ohne + / =');
  assert.equal(decode(u.hash), STORED);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

test('Ohne Spielstand, kaputter Spielstand, Englisch, Unterseiten und unbekannte Pfade', async () => {
  const cases = [
    ['/numfact/', undefined, 'https://ciphro.eu/#moved'],
    ['/numfact/index.html?n=2', undefined, 'https://ciphro.eu/?n=2#moved'],
    ['/numfact/?lang=en', undefined, 'https://ciphro.eu/?lang=en#moved'],
    ['/numfact/en/?n=3&m=hard', undefined, 'https://ciphro.eu/en/?n=3&m=hard#moved'],
    ['/numfact/en/index.html', undefined, 'https://ciphro.eu/en/#moved'],
    ['/numfact/en', undefined, 'https://ciphro.eu/en/#moved'],
    ['/numfact/kern.js', undefined, 'https://ciphro.eu/#moved'],
    ['/numfact/irgendwas/tief?x=1', undefined, 'https://ciphro.eu/?x=1#moved'],
    ['/numfact/en/gibts-nicht', undefined, 'https://ciphro.eu/en/#moved'],
    ['/numfact/', '{kaputt', 'https://ciphro.eu/#moved'],
    ['/numfact/', JSON.stringify({ v: 1, days: {} }), 'https://ciphro.eu/#moved']
  ];
  for (const [link, stored, want] of cases) {
    const ctx = await context();
    const page = await follow(ctx, link, stored);
    assert.equal(page.url(), want, link);
    await ctx.close();
  }
  // Englischer Link mit Spielstand
  const ctx = await context();
  const page = await follow(ctx, '/numfact/en/?n=3', STORED);
  assert.ok(page.url().startsWith('https://ciphro.eu/en/?n=3#import='));
  assert.equal(decode(new URL(page.url()).hash), STORED);
  await ctx.close();
});

test('Alte Offline-Hilfe von /numfact/ wird abgemeldet, andere Seiten auf derselben Domain nicht', async () => {
  const ctx = await context({ sw: true });
  const page = await ctx.newPage();
  await page.goto(srv.url + '/start.html');
  await page.evaluate(async () => {
    const active = reg => new Promise(r => { const w = reg.installing || reg.waiting || reg.active; if (w.state === 'activated') r(); else w.addEventListener('statechange', () => { if (w.state === 'activated') r(); }); });
    await active(await navigator.serviceWorker.register('/numfact/__alt-sw.js', { scope: '/numfact/' }));
    await active(await navigator.serviceWorker.register('/andere/__alt-sw.js', { scope: '/andere/' }));
  });
  assert.equal((await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)), 2);
  await page.goto(srv.url + '/numfact/?n=4');
  await page.waitForURL(/^https:\/\/ciphro\.eu\//);
  assert.ok(page.url().startsWith('https://ciphro.eu/?n=4#'));
  await page.goto(srv.url + '/start.html');
  const scopes = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname));
  assert.deepEqual(scopes, ['/andere/']);
  await ctx.close();
});

test('Neue sw.js der alten Adresse: löscht den alten Zwischenspeicher und meldet sich selbst ab', async () => {
  const ctx = await context({ sw: true });
  const page = await ctx.newPage();
  await page.goto(srv.url + '/start.html');
  await page.evaluate(async () => {
    await (await caches.open('numigma-v15')).put('/numfact/x', new Response('alt'));
    await (await caches.open('fremd-v1')).put('/fremd/x', new Response('fremd'));
    await navigator.serviceWorker.register('/numfact/sw.js', { scope: '/numfact/' });
  });
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0, null, { timeout: 10000, polling: 200 });
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['fremd-v1']);
  await ctx.close();
});

test('Linkvorschau der alten Adresse zeigt schon CIPHRO mit neuem Bild; Weiterleitung in allen drei Seiten gleich', () => {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const meta = (src, prop) => (src.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`)) || [])[1];
  const de = read('index.html'), en = read('en/index.html'), nf = read('404.html');
  assert.equal(meta(de, 'og:title'), 'CIPHRO · Das tägliche Zahlenrätsel');
  assert.equal(meta(de, 'og:url'), 'https://ciphro.eu/');
  assert.equal(meta(de, 'og:image'), 'https://ciphro.eu/og-de.png?v=3');
  assert.equal(meta(en, 'og:url'), 'https://ciphro.eu/en/');
  assert.equal(meta(en, 'og:image'), 'https://ciphro.eu/og-en.png?v=3');
  assert.equal(meta(en, 'og:locale'), 'en_GB');
  for (const src of [de, en, nf]) assert.equal(meta(src, 'robots'), 'noindex');
  const block = src => src.match(/<script>\n\/\* NUMIGMA heißt[\s\S]*?<\/script>/)[0];
  assert.equal(block(en), block(de));
  assert.equal(block(nf), block(de));
  // Bilder für ältere, schon geteilte Vorschauen bleiben liegen
  for (const f of ['og.png', 'og-de.png', 'og-en.png', 'icon-192.png', 'icon.png']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});

test('Ganzer Umzug mit dem echten neuen Spiel (nur mit CIPHRO_DIR): Spielstand, Serie und Hinweis kommen an', { skip: !CIPHRO_DIR && 'CIPHRO_DIR nicht gesetzt' }, async () => {
  const ctx = await context({ time: '2026-10-24T10:00:00+02:00', real: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  // Spielstand im alten Spiel erzeugen: #3 Easy gestern gelöst, #4 Easy heute gelöst
  await page.goto(srv.url + '/start.html');
  const old = JSON.parse(STORED);
  old.days = {};
  const nf = require(path.join(CIPHRO_DIR, '_dev', 'tests', 'helpers.js')).loadNF();
  for (const [n, key] of [[3, '2026-10-23'], [4, '2026-10-24']]) {
    const p = nf.buildDay(nf.keyOfNumber(n), 'de').puzzles.easy;
    old.days[key] = { easy: { sig: p.sig, typed: p.words.map(w => w.plain), status: 'solved', elapsed: 70000 + n, hints: {}, hintCount: 0, cuts: [], given: [], helped: [], startedOn: key, doneOn: key } };
  }
  await page.evaluate(s => localStorage.setItem('numfact.v2', s), JSON.stringify(old));
  await page.goto(srv.url + '/numfact/?n=3&m=easy');
  await page.waitForURL(/^https:\/\/ciphro\.eu\/\?/);
  await page.waitForFunction(() => document.querySelector('#issue') && document.querySelector('#issue').textContent);
  assert.equal(await page.evaluate(() => location.hash), '');
  assert.equal((await page.textContent('#noticeText')).trim(), 'NUMIGMA heißt jetzt CIPHRO. Dein Spielstand ist mitgekommen.');
  assert.match(await page.textContent('#issue'), /#3\b/);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('numfact.v2')));
  assert.equal(s.days['2026-10-24'].easy.elapsed, 70004);
  assert.equal(s.theme, 'dark');
  await page.click('#backToday');
  await page.click('#statsBtn');
  const tiles = await page.$$eval('#statsBody .n', ns => ns.map(n => n.nextElementSibling.textContent + '=' + n.textContent));
  assert.ok(tiles.includes('Serie=2'), JSON.stringify(tiles));
  assert.deepEqual(page.errors, []);
  await ctx.close();
});
