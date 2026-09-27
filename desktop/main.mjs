// Stardeck for Windows: the static export (`out/`, copied to ./web) in an Electron window.
// Pages load from app://stardeck/, so the app works fully offline with nothing hosted.
// Designs and photos stay in the app's own storage on this PC, exactly like the web app.
import { app, BrowserWindow, Menu, Notification, protocol, session, shell } from 'electron';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const SCHEME = 'app';
const HOST = 'stardeck';
const ORIGIN = `${SCHEME}://${HOST}`;
const WEB_ROOT = path.join(import.meta.dirname, 'web');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
};

/** The same Content-Security-Policy the web app ships with (from its `_headers` file). */
function readCsp() {
  try {
    const line = readFileSync(path.join(WEB_ROOT, '_headers'), 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('Content-Security-Policy:'));
    return line ? line.slice(line.indexOf(':') + 1).trim() : null;
  } catch {
    return null;
  }
}

/** Maps a URL path to a file in ./web the way a static host does (`/projects/` → projects/index.html). */
function resolveFile(urlPath) {
  let relative;
  try {
    relative = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const candidate = path.normalize(path.join(WEB_ROOT, relative));
  if (candidate !== WEB_ROOT && !candidate.startsWith(WEB_ROOT + path.sep)) return null;
  for (const file of [candidate, path.join(candidate, 'index.html'), `${candidate}.html`]) {
    try {
      if (statSync(file).isFile()) return file;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

function serveApp() {
  const csp = readCsp();
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    const found = resolveFile(url.pathname);
    const file = found ?? path.join(WEB_ROOT, '404.html');
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    };
    if (csp) headers['Content-Security-Policy'] = csp;
    const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(file));
    return new Response(body, { status: found ? 200 : 404, headers });
  });
}

/* ───────────── Downloads ─────────────
   Saving works like Chrome: files go straight to the Downloads folder (no dialog per file),
   and one notification says so. Clicking it shows the file in Explorer. */

const reserved = new Set();
function uniquePath(dir, name) {
  const { name: base, ext } = path.parse(name);
  let candidate = path.join(dir, name);
  for (let i = 1; reserved.has(candidate) || existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  reserved.add(candidate);
  return candidate;
}

let saved = [];
let announceTimer;
function announce(file) {
  saved.push(file);
  clearTimeout(announceTimer);
  // Carousels save several files at once: wait for the batch, then notify once.
  announceTimer = setTimeout(() => {
    const files = saved;
    saved = [];
    if (!Notification.isSupported()) return;
    const names = files.map((f) => path.basename(f));
    const note = new Notification({
      title: files.length === 1 ? 'Saved to Downloads' : `Saved ${files.length} files to Downloads`,
      body: names.length > 3 ? `${names.slice(0, 3).join(', ')}…` : names.join(', '),
      silent: true,
    });
    note.on('click', () => shell.showItemInFolder(files[0]));
    note.show();
  }, 800);
}

function handleDownloads() {
  session.defaultSession.on('will-download', (_event, item) => {
    const target = uniquePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(target);
    item.once('done', (_e, state) => {
      reserved.delete(target);
      if (state === 'completed') announce(target);
    });
  });
}

/* ───────────── Window ───────────── */

const isWebLink = (url) => url.startsWith('https://') || url.startsWith('http://');

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    show: false,
    title: 'Stardeck',
    backgroundColor: '#101012',
    icon: path.join(WEB_ROOT, 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => (win = null));

  // Links to other sites open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebLink(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${ORIGIN}/`)) return;
    event.preventDefault();
    if (isWebLink(url)) void shell.openExternal(url);
  });

  void win.loadURL(`${ORIGIN}/`);
}

// One window: opening Stardeck again focuses the one that's already open.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('com.stardustgamings.stardeck');
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    // Nothing in Stardeck needs the camera, microphone or location (the web app's
    // Permissions-Policy says the same).
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(!['media', 'geolocation'].includes(permission));
    });
    serveApp();
    handleDownloads();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
