/**
 * Minimal entry: show a native loader as soon as the app process starts.
 * Then load the full main app. This makes the loader appear before webpack/heavy deps load.
 */
import { app, BrowserWindow } from 'electron';

function createSplashWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 340,
    height: 220,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#f5f5f7',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  w.setBackgroundColor('#f5f5f7');
  w.show();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>*{margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f5f5f7;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}.logo{font-size:26px;font-weight:700;color:#1d1d1f}.sub{font-size:12px;color:#6e6e73}.s{width:32px;height:32px;border:3px solid #e5e5ea;border-top-color:#0071e3;border-radius:50%;animation:r .7s linear infinite}.t{font-size:12px;color:#8e8e93}@keyframes r{to{transform:rotate(360deg)}}</style></head><body><div class="logo">POS</div><div class="sub">AiwaPOS</div><div class="s"></div><div class="t" id="t">Starting…</div></body></html>`;
  w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return w;
}

app.whenReady().then(() => {
  const splash = createSplashWindow();
  // Load full main (sync, config, window) after splash is visible
  require('./main').boot(splash);
});
