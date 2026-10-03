const { app, BrowserWindow, session, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const possibleWidevinePaths = [
  '/usr/lib/chromium/WidevineCdm/_platform_specific/linux_x64/libwidevinecdm.so',
'/opt/google/chrome/WidevineCdm/_platform_specific/linux_x64/libwidevinecdm.so',
'/opt/vivaldi/WidevineCdm/_platform_specific/linux_x64/libwidevinecdm.so'
];

for (const wPath of possibleWidevinePaths) {
  if (fs.existsSync(wPath)) {
    app.commandLine.appendSwitch('widevine-cdm-path', wPath);
    app.commandLine.appendSwitch('widevine-cdm-version', '4.10.3112.0');
    break;
  }
}

app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'Vulkan');

app.setPath('userData', path.join(app.getPath('appData'), 'kinopoisktv-data'));

const USER_AGENT = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/108.0.5359.125 TV Safari/537.36';

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = USER_AGENT;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  const primaryDisplay = screen.getPrimaryDisplay();
  let { width: screenW, height: screenH } = primaryDisplay.size;

  if (screenW < screenH && screenH === 1280) {
    const tmp = screenW;
    screenW = screenH;
    screenH = tmp;
  }

  let targetW = 1920;
  let targetH = 1080;

  if (screenW < 1920 || screenH < 1080) {
    targetW = 1280;
    targetH = 720;
  }

  const scale = Math.min(screenW / targetW, screenH / targetH);
  const finalW = Math.round(targetW * scale);
  const finalH = Math.round(targetH * scale);

  const win = new BrowserWindow({
    width: screenW,
    height: screenH,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
                                contextIsolation: false,
                                nodeIntegration: true,
                                sandbox: false,
                                webSecurity: false,
                                plugins: true
    }
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
    html, body {
      background-color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      overflow: hidden !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    #root, #app, body > div:first-child {
    width: ${finalW}px !important;
    height: ${finalH}px !important;
    max-width: ${finalW}px !important;
    max-height: ${finalH}px !important;
    position: relative !important;
    margin: auto !important;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.8) !important;
    }
    `);
  });

  win.loadURL('https://smarttv-app.ott.yandex.ru/', { userAgent: USER_AGENT });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
