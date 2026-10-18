const { app, BrowserWindow, session, screen, components, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'Vulkan');
app.commandLine.appendSwitch('enable-features', 'MediaSourceInWorkers');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

app.setPath('userData', path.join(app.getPath('appData'), 'kinopoisktv-data'));

const USER_AGENT = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/108.0.5359.125 TV Safari/537.36';

app.whenReady().then(async () => {
  powerSaveBlocker.start('prevent-display-sleep');

  if (components) {
    try {
      await components.whenReady();
      console.log('Widevine components ready');
    } catch (e) {
      console.warn('Components initialization warning:', e);
    }
  }

  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0);
  });

  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (!details.url.includes('mc.yandex.ru') && !details.url.includes('metrika')) {
      console.log('[NetError]', details.error, details.url);
    }
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = USER_AGENT;
    for (const key of Object.keys(details.requestHeaders)) {
      const lower = key.toLowerCase();
      if (lower === 'x-device-video-codecs') details.requestHeaders[key] = 'AVC';
      if (lower === 'x-device-video-formats') details.requestHeaders[key] = 'SD,HD';
      if (lower === 'x-device-dynamic-ranges') details.requestHeaders[key] = 'SDR';
      if (lower === 'x-device-audio-codecs') details.requestHeaders[key] = 'AAC';
      if (lower === 'x-device-model') details.requestHeaders[key] = 'UE43T5300AU';
    }
    if (details.url.includes('ott.yandex.ru') || details.url.includes('strm.yandex.ru')) {
      if (!details.requestHeaders['x-device-video-codecs'] && !details.requestHeaders['X-Device-Video-Codecs']) {
        details.requestHeaders['x-device-video-codecs'] = 'AVC';
      }
      if (!details.requestHeaders['x-device-video-formats'] && !details.requestHeaders['X-Device-Video-Formats']) {
        details.requestHeaders['x-device-video-formats'] = 'SD,HD';
      }
      if (!details.requestHeaders['x-device-audio-codecs'] && !details.requestHeaders['X-Device-Audio-Codecs']) {
        details.requestHeaders['x-device-audio-codecs'] = 'AAC';
      }
      if (!details.requestHeaders['x-device-dynamic-ranges'] && !details.requestHeaders['X-Device-Dynamic-Ranges']) {
        details.requestHeaders['x-device-dynamic-ranges'] = 'SDR';
      }
      if (!details.requestHeaders['x-device-model'] && !details.requestHeaders['X-Device-Model']) {
        details.requestHeaders['x-device-model'] = 'UE43T5300AU';
      }
    }
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

  win.webContents.on('console-message', (event, ...rest) => {
    let message = (typeof event === 'object' && event && event.message !== undefined) ? event.message : rest[1];
    let level = (typeof event === 'object' && event && event.level !== undefined) ? event.level : rest[0];
    if (typeof event === 'string') message = event;
    if (!message) return;
    if (message.includes('[DRM-') || message.includes('PlayerError') || message.includes('PlaybackError') || message.includes('Shaka') || message.includes('YASP') || level >= 2) {
      console.log(`[Renderer] ${message}`);
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
