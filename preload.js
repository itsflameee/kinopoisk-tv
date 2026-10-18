try {
  localStorage.setItem('smarttv-device.video.uhd', 'false');
  localStorage.setItem('smarttv-device.video.hdr', 'false');
  localStorage.setItem('smarttv-device.video.uhd8k', 'false');
  localStorage.setItem('smarttv-device.system.model', '"UE43T5300AU"');
  localStorage.setItem('smarttv-device.system.modelCode', '"UE43T5300AU"');
  localStorage.setItem('smarttv-device.system.partialModel', '"UE43T5300AU"');
} catch (e) {}

if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
  const origDecodingInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
  navigator.mediaCapabilities.decodingInfo = async function(config) {
    const videoType = (config.video?.contentType || '').toLowerCase();
    const audioType = (config.audio?.contentType || '').toLowerCase();
    if (videoType.includes('hvc') || videoType.includes('hev') || audioType.includes('ec-3') || audioType.includes('ac-3')) {
      console.log('[DRM-MediaCap] Explicitly rejecting HEVC/EC-3:', videoType, audioType);
      return {
        supported: false,
        smooth: false,
        powerEfficient: false,
        keySystemAccess: null,
        configuration: config
      };
    }
    try {
      const res = await origDecodingInfo(config);
      console.log('[DRM-MediaCap] query:', videoType, audioType, 'drm:', config.keySystemConfiguration?.keySystem, 'origSupported:', res?.supported);
      if (!res || !res.supported) {
        console.log('[DRM-MediaCap] Overriding supported to true for:', videoType, audioType);
        return {
          supported: true,
          smooth: true,
          powerEfficient: true,
          keySystemAccess: (res && res.keySystemAccess) || null,
          configuration: config
        };
      }
      return res;
    } catch (e) {
      console.warn('[DRM-MediaCap] decodingInfo exception bypassed:', e);
      return {
        supported: true,
        smooth: true,
        powerEfficient: true,
        keySystemAccess: null,
        configuration: config
      };
    }
  };
}

if (window.MediaSource && MediaSource.isTypeSupported) {
  const origIsTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);
  MediaSource.isTypeSupported = function(mimeType) {
    if (typeof mimeType === 'string') {
      const lower = mimeType.toLowerCase();
      if (lower.includes('hvc') || lower.includes('hev') || lower.includes('ec-3') || lower.includes('ac-3')) {
        return false;
      }
      if (lower.includes('avc') || lower.includes('mp4a')) {
        return true;
      }
    }
    return origIsTypeSupported(mimeType);
  };
}

if (window.HTMLMediaElement && HTMLMediaElement.prototype.canPlayType) {
  const origCanPlayType = HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType = function(type) {
    if (typeof type === 'string') {
      const lower = type.toLowerCase();
      if (lower.includes('hvc') || lower.includes('hev') || lower.includes('ec-3') || lower.includes('ac-3')) {
        return '';
      }
    }
    return origCanPlayType.call(this, type);
  };
}

function patchDeviceObj(device) {
  if (!device || device.__kp_patched) return;
  device.__kp_patched = true;
  console.log('[DRM-Patch] Successfully patched __SMARTTV_DEVICE__');
  try {
    Object.defineProperty(device, 'video', {
      get() {
        return {
          codecs: { supported: ['AVC'], possiblySupported: ['AVC', 'MPEG-4', 'AV1'] },
          formats: { supported: ['SD', 'HD'], possiblySupported: ['SD', 'HD'] },
          dynamicRanges: { supported: ['SDR'], possiblySupported: ['SDR'] },
          drm: { supported: ['WIDEVINE'], possiblySupported: ['WIDEVINE'] }
        };
      },
      configurable: true
    });
    Object.defineProperty(device, 'audio', {
      get() {
        return {
          codecs: { supported: ['AAC'], possiblySupported: ['AAC', 'MP3'] },
          onVolumeChange: () => {},
          getVolume: () => 50,
          setVolume: () => {},
          isMute: () => false,
          setMute: () => {}
        };
      },
      configurable: true
    });
  } catch (e) {
    console.warn('[DRM-Patch] Error patching __SMARTTV_DEVICE__:', e);
  }
}

let _smartTvDevice = window.__SMARTTV_DEVICE__;
if (_smartTvDevice) patchDeviceObj(_smartTvDevice);
Object.defineProperty(window, '__SMARTTV_DEVICE__', {
  get() { return _smartTvDevice; },
  set(val) {
    _smartTvDevice = val;
    if (_smartTvDevice) patchDeviceObj(_smartTvDevice);
  },
  configurable: true
});

function patchShakaGlobals() {
  if (window.shaka && window.shaka.Player) {
    if (!window.shaka.Player.__kp_patched_support) {
      window.shaka.Player.__kp_patched_support = true;
      window.shaka.Player.isBrowserSupported = function() {
        console.log('[DRM-Patch] shaka.Player.isBrowserSupported called');
        return true;
      };
      console.log('[DRM-Patch] shaka.Player.isBrowserSupported overridden to true');
    }
  }
}

setInterval(patchShakaGlobals, 100);

(function() {
  function processGraphQLStreams(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.onlineStreams && Array.isArray(obj.onlineStreams.streams)) {
      console.log('[DRM-GraphQL] Found streams in onlineStreams count:', obj.onlineStreams.streams.length);
      obj.onlineStreams.streams.forEach((s, idx) => {
        console.log(`[DRM-Stream-${idx}] type=${s.streamType} drm=${s.drmType} uri=${s.uri}`);
      });
      const avcStreams = obj.onlineStreams.streams.filter(s => s && s.uri && !s.uri.includes('hevc') && !s.uri.includes('hvc'));
      if (avcStreams.length > 0) {
        console.log('[DRM-GraphQL] Filtered out HEVC! Keeping AVC streams count:', avcStreams.length);
        obj.onlineStreams.streams = avcStreams;
      } else {
        console.warn('[DRM-GraphQL] Warning: only HEVC streams found in onlineStreams.streams');
      }
    }
    if (Array.isArray(obj.streams)) {
      const avcStreams = obj.streams.filter(s => s && s.uri && !s.uri.includes('hevc') && !s.uri.includes('hvc'));
      if (avcStreams.length > 0 && avcStreams.length < obj.streams.length) {
        obj.streams = avcStreams;
      }
    }
    for (const k in obj) {
      if (obj[k] && typeof obj[k] === 'object') processGraphQLStreams(obj[k]);
    }
  }

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
    if (url && (url.includes('drm') || url.includes('license') || url.includes('widevine') || url.includes('.mpd') || url.includes('strm') || url.includes('manifest'))) {
      console.log('[DRM-Network] fetch:', url);
    }
    try {
      const resp = await origFetch.apply(this, args);
      if (url && (url.includes('drm') || url.includes('license') || url.includes('widevine') || url.includes('.mpd') || url.includes('manifest'))) {
        console.log('[DRM-Network] response status:', resp.status, resp.statusText, url);
        if (url.includes('.mpd') || url.includes('manifest')) {
          resp.clone().text().then(text => {
            const adaptations = text.match(/<AdaptationSet[^>]*>/g) || [];
            console.log('[DRM-Manifest] AdaptationSets:', adaptations);
            const contentProtections = text.match(/<ContentProtection[^>]*>/g) || [];
            console.log('[DRM-Manifest] ContentProtections:', contentProtections);
          }).catch(() => {});
        }
      }
      if (url && (url.includes('/api') || url.includes('/graphql') || url.includes('smarttv-app.ott.yandex.ru'))) {
        try {
          if (args[1] && args[1].body && typeof args[1].body === 'string' && (args[1].body.includes('stream') || args[1].body.includes('onlineStreams') || args[1].body.includes('videoCodec'))) {
            console.log('[DRM-GraphQL] fetch request query:', args[1].body.substring(0, 300));
          }
          const clone = resp.clone();
          const text = await clone.text();
          if (text && (text.includes('onlineStreams') || text.includes('streams'))) {
            console.log('[DRM-GraphQL] Intercepted fetch response for:', url);
            const data = JSON.parse(text);
            processGraphQLStreams(data);
            return new Response(JSON.stringify(data), {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers
            });
          }
        } catch(e) {}
      }
      return resp;
    } catch(err) {
      if (url && (url.includes('drm') || url.includes('license') || url.includes('widevine') || url.includes('.mpd') || url.includes('manifest'))) {
        console.error('[DRM-Network] fetch ERROR:', err, url);
      }
      throw err;
    }
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origResponseTextGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')?.get;
  const origResponseGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response')?.get;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__kp_url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const url = this.__kp_url;
    if (typeof url === 'string') {
      if (url.includes('license') || url.includes('widevine') || url.includes('drm') || url.includes('.mpd') || url.includes('manifest')) {
        console.log('[DRM-Network] XHR send to:', url);
        this.addEventListener('load', () => {
          console.log('[DRM-Network] XHR response:', this.status, this.statusText, url);
        });
        this.addEventListener('error', (e) => {
          console.error('[DRM-Network] XHR network error:', e, url);
        });
      }

      if (url.includes('/api') || url.includes('graphql') || url.includes('smarttv-app.ott.yandex.ru')) {
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('stream') || args[0].includes('onlineStreams') || args[0].includes('videoCodec'))) {
          console.log('[DRM-GraphQL] XHR request body:', args[0].substring(0, 300));
        }

        let modifiedResponse = null;
        let modifiedText = null;

        this.addEventListener('readystatechange', () => {
          if (this.readyState === 4 && this.status === 200) {
            try {
              if (this.responseType === 'json') {
                const data = origResponseGetter ? origResponseGetter.call(this) : this.response;
                if (data && typeof data === 'object') {
                  const str = JSON.stringify(data);
                  if (str.includes('onlineStreams') || str.includes('streams')) {
                    console.log('[DRM-GraphQL] Intercepted JSON XHR response for:', url);
                    processGraphQLStreams(data);
                    modifiedResponse = data;
                  }
                }
              } else {
                let text = '';
                try {
                  text = origResponseTextGetter ? origResponseTextGetter.call(this) : this.responseText;
                } catch(e) {}
                if (text && (text.includes('onlineStreams') || text.includes('streams'))) {
                  console.log('[DRM-GraphQL] Intercepted text XHR response for:', url);
                  const data = JSON.parse(text);
                  processGraphQLStreams(data);
                  modifiedText = JSON.stringify(data);
                  modifiedResponse = modifiedText;
                }
              }
            } catch(e) {
              console.warn('[DRM-GraphQL] Intercept parse warning:', e);
            }
          }
        });

        Object.defineProperty(this, 'responseText', {
          get() {
            if (modifiedText !== null) return modifiedText;
            return origResponseTextGetter ? origResponseTextGetter.call(this) : '';
          },
          configurable: true
        });

        Object.defineProperty(this, 'response', {
          get() {
            if (modifiedResponse !== null) {
              if (this.responseType === 'json') {
                return (typeof modifiedResponse === 'string') ? JSON.parse(modifiedResponse) : modifiedResponse;
              }
              return (typeof modifiedResponse === 'object') ? JSON.stringify(modifiedResponse) : modifiedResponse;
            }
            return origResponseGetter ? origResponseGetter.call(this) : '';
          },
          configurable: true
        });
      }
    }
    return origSend.apply(this, args);
  };

  const origConsoleError = console.error.bind(console);
  console.error = function(...args) {
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        if (arg.name === 'PlayerError' || arg.name === 'PlaybackError' || arg.category || arg.code || arg.vsid) {
          origConsoleError('[DRM-Error-Detail]', JSON.stringify({
            name: arg.name,
            message: arg.message,
            code: arg.code,
            category: arg.category,
            vsid: arg.vsid,
            details: arg.details,
            additional: arg.additional
          }, null, 2));
        }
      }
    }
    origConsoleError(...args);
  };

  window.addEventListener('error', (e) => {
    if (e && e.error) {
      console.error('[DRM-Detail] Uncaught Error:', e.error.name, e.error.message, e.error.type, e.error.code, e.error.additional);
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[DRM-Detail] Unhandled Rejection:', e.reason);
  });
})();

function patchExpFlags(flags) {
  if (!flags) return;
  flags.useEngineName = 'shaka';
  flags.useStableEngineName = 'shaka';
  flags.drmPriority = 'widevine,clear';
}

let rawSSRData = window.__SSR_DATA__;
if (rawSSRData) {
  rawSSRData.drmPriority = 'widevine,clear';
  if (rawSSRData.filmoscopeExpFlags) patchExpFlags(rawSSRData.filmoscopeExpFlags);
}
Object.defineProperty(window, '__SSR_DATA__', {
  get() { return rawSSRData; },
  set(val) {
    rawSSRData = val;
    if (rawSSRData) {
      rawSSRData.drmPriority = 'widevine,clear';
      if (rawSSRData.filmoscopeExpFlags) {
        patchExpFlags(rawSSRData.filmoscopeExpFlags);
      }
    }
  },
  configurable: true
});

try {
  const origUA = navigator.userAgent;
  const spoofedUA = origUA.replace(/Tizen \d+(\.\d+)?/gi, 'TVIP-SmartTV');
  Object.defineProperty(navigator, 'userAgent', {
    get() { return spoofedUA; },
    configurable: true
  });
} catch(e) {}

function patchScriptUrl(url) {
  if (typeof url === 'string') {
    if (url.includes('/bundle/tizen.js')) {
      return url.replace('/bundle/tizen.js', '/bundle/html5.js');
    }
  }
  return url;
}

const origCreateElement = document.createElement.bind(document);
document.createElement = function(tagName, ...args) {
  const name = tagName.toLowerCase();
  const element = origCreateElement(tagName, ...args);

  if (name === 'script') {
    const origSetAttribute = element.setAttribute.bind(element);
    element.setAttribute = function(attr, value) {
      if (attr.toLowerCase() === 'src' && typeof value === 'string') {
        if (value.includes('$WEBAPIS')) {
          setTimeout(() => {
            if (typeof element.onload === 'function') element.onload(new Event('load'));
          }, 0);
          return;
        }
        value = patchScriptUrl(value);
      }
      return origSetAttribute(attr, value);
    };

    Object.defineProperty(element, 'src', {
      set(value) {
        if (typeof value === 'string') {
          if (value.includes('$WEBAPIS')) {
            setTimeout(() => {
              if (typeof element.onload === 'function') element.onload(new Event('load'));
            }, 0);
            return;
          }
          value = patchScriptUrl(value);
        }
        element.setAttribute('src', value);
      },
      get() { return element.getAttribute('src') || ''; }
    });
  }
  return element;
};

let duid = localStorage.getItem('__kp_tizen_duid__');
if (!duid) {
  duid = 'TIZEN' + Math.random().toString(36).substring(2, 12).toUpperCase();
  localStorage.setItem('__kp_tizen_duid__', duid);
}

window.tizen = {
  systeminfo: {
    getCapability: function(key) {
      if (typeof key === 'string') {
        if (key.includes('platform.version')) return '7.0';
        if (key.includes('platform.name')) return 'Tizen';
        if (key.includes('web.version')) return '7.0';
      }
      return '7.0';
    },
    getPropertyValue: function(property, successCallback) {
      const data = {
        BUILD: { modelNumber: 'UE43T5300AU', buildVersion: 'T-KTS2DEUC-1402.5' },
        DISPLAY: { resolutionWidth: 1920, resolutionHeight: 1080, physicalWidth: 1920, physicalHeight: 1080 },
        NETWORK: { networkType: 'ETHERNET', status: 'CONNECTED', ipAddress: '192.168.1.50', gateway: '192.168.1.1' },
        LOCALE: { language: 'ru_RU', country: 'RU' }
      };
      if (typeof successCallback === 'function') {
        setTimeout(() => successCallback(data[property] || {}), 0);
      }
    },
    addPropertyValueChangeListener: function() { return 1; },
    removePropertyValueChangeListener: function() {}
  },
  tvinputdevice: {
    registerKey: function() {},
    unregisterKey: function() {},
    getSupportedKeys: function() {
      return [
        { name: 'MediaPlayPause', code: 10252 },
        { name: 'MediaPlay', code: 415 },
        { name: 'MediaPause', code: 19 },
        { name: 'MediaStop', code: 413 },
        { name: 'MediaFastForward', code: 417 },
        { name: 'MediaRewind', code: 412 },
        { name: '0', code: 48 },
        { name: '1', code: 49 },
        { name: '2', code: 50 },
        { name: '3', code: 51 },
        { name: '4', code: 52 },
        { name: '5', code: 53 },
        { name: '6', code: 54 },
        { name: '7', code: 55 },
        { name: '8', code: 56 },
        { name: '9', code: 57 },
        { name: 'ColorF0Red', code: 403 },
        { name: 'ColorF1Green', code: 404 },
        { name: 'ColorF2Yellow', code: 405 },
        { name: 'ColorF3Blue', code: 406 }
      ];
    }
  },
  application: {
    getCurrentApplication: function() {
      return {
        appInfo: { id: '9q9549f032.Kinopoisk', version: '2.34.0' },
        exit: function() { window.close(); },
        getRequestedAppControl: function() {
          return {
            appControl: { operation: 'http://tizen.org/appcontrol/operation/default', data: [] }
          };
        }
      };
    }
  },
  tvaudiocontrol: {
    getVolume: function() { return 50; },
    setVolume: function() {},
    setVolumeUp: function() {},
    setVolumeDown: function() {},
    isMute: function() { return false; },
    setMute: function() {},
    setVolumeChangeListener: function() {},
    unsetVolumeChangeListener: function() {}
  }
};

window.webapis = {
  productinfo: {
    getDuid: function() { return duid; },
    getModelCode: function() { return 'UE43T5300AU'; },
    getModel: function() { return 'UE43T5300AU'; },
    getRealModel: function() { return 'UE43T5300AU'; },
    getFirmware: function() { return 'T-KTS2DEUC-1402.5'; },
    getSmartTVServerVersion: function() { return 'T-KTS2DEUC-1402.5'; },
    isHdrFlagSupported: function() { return false; },
    isUdPanelSupported: function() { return false; },
    is8KPanelSupported: function() { return false; },
    getSystemConfig: function() { return '1'; }
  },
  avinfo: {
    isHdrTvSupport: function() { return false; }
  },
  network: {
    getNetworkState: function() { return 1; },
    getActiveConnectionType: function() { return 1; },
    getGateway: function() { return '192.168.1.1'; },
    getIp: function() { return '192.168.1.50'; },
    getMac: function() { return '00:11:22:33:44:55'; },
    checkServerConnection: function(cb) {
      if (typeof cb === 'function') setTimeout(() => cb(1), 0);
    },
    addNetworkStateChangeListener: function() { return 1; },
    removeNetworkStateChangeListener: function() {}
  },
  appcommon: {
    getAppId: function() { return '9q9549f032.Kinopoisk'; },
    getVersion: function() { return '2.34.0'; },
    setScreenSaver: function(state, successCb) {
      if (typeof successCb === 'function') setTimeout(successCb, 0);
    }
  },
  avplay: undefined
};

window.addEventListener('keydown', (e) => {
  const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

  if (e.keyCode === 27 || e.keyCode === 8) {
    if (e.keyCode === 8 && isInput) return;
    e.preventDefault();
    e.stopPropagation();

    const backEvent = new KeyboardEvent('keydown', {
      key: 'Return',
      code: 'Return',
      keyCode: 10009,
      which: 10009,
      bubbles: true,
      cancelable: true
    });

    document.dispatchEvent(backEvent);
    window.dispatchEvent(backEvent);
    if (document.activeElement) {
      document.activeElement.dispatchEvent(backEvent);
    }
    return;
  }

  if (isInput) return;

  let mappedKey = null;

  if (e.code === 'KeyP') {
    mappedKey = { key: 'MediaPlayPause', code: 'MediaPlayPause', keyCode: 10252 };
  } else if (e.code === 'BracketLeft') {
    mappedKey = { key: 'MediaRewind', code: 'MediaRewind', keyCode: 412 };
  } else if (e.code === 'BracketRight') {
    mappedKey = { key: 'MediaFastForward', code: 'MediaFastForward', keyCode: 417 };
  } else if (e.keyCode >= 48 && e.keyCode <= 57 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    mappedKey = { key: e.key, code: e.code, keyCode: e.keyCode };
  }

  if (mappedKey) {
    e.preventDefault();
    e.stopPropagation();

    const target = document.activeElement || document.body;
    const evtDown = new KeyboardEvent('keydown', {
      key: mappedKey.key,
      code: mappedKey.code,
      keyCode: mappedKey.keyCode,
      which: mappedKey.keyCode,
      bubbles: true,
      cancelable: true
    });
    target.dispatchEvent(evtDown);

    const evtUp = new KeyboardEvent('keyup', {
      key: mappedKey.key,
      code: mappedKey.code,
      keyCode: mappedKey.keyCode,
      which: mappedKey.keyCode,
      bubbles: true,
      cancelable: true
    });
    target.dispatchEvent(evtUp);
  }
}, true);

(function initCursorAutoHide() {
  let timeoutId = null;

  function showCursor() {
    document.body.style.cursor = 'default';
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      document.body.style.cursor = 'none';
    }, 2500);
  }

  window.addEventListener('mousemove', showCursor, { passive: true });
  window.addEventListener('mousedown', showCursor, { passive: true });
})();

(function initGamepadSupport() {
  const BUTTON_MAP = {
    0: { key: 'Enter', code: 'Enter', keyCode: 13 },
    1: { key: 'Return', code: 'Return', keyCode: 10009 },
    4: { key: 'MediaRewind', code: 'MediaRewind', keyCode: 412 },
    5: { key: 'MediaFastForward', code: 'MediaFastForward', keyCode: 417 },
    12: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    13: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    14: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    15: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    9: { key: 'Return', code: 'Return', keyCode: 10009 }
  };

  const buttonStates = {};
  let lastStickTime = 0;
  const STICK_DELAY = 180;
  const STICK_DEADZONE = 0.5;

  function dispatchKey(keyData) {
    const activeElem = document.activeElement || document.body;
    const evtDown = new KeyboardEvent('keydown', {
      key: keyData.key,
      code: keyData.code,
      keyCode: keyData.keyCode,
      which: keyData.keyCode,
      bubbles: true,
      cancelable: true
    });
    activeElem.dispatchEvent(evtDown);

    const evtUp = new KeyboardEvent('keyup', {
      key: keyData.key,
      code: keyData.code,
      keyCode: keyData.keyCode,
      which: keyData.keyCode,
      bubbles: true,
      cancelable: true
    });
    activeElem.dispatchEvent(evtUp);
  }

  function pollGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0] || gamepads[1];

    if (gp) {
      const now = Date.now();

      gp.buttons.forEach((btn, index) => {
        const isPressed = btn.pressed || btn.value > 0.5;
        const mapping = BUTTON_MAP[index];

        if (mapping) {
          if (isPressed && !buttonStates[index]) {
            buttonStates[index] = true;
            dispatchKey(mapping);
          } else if (!isPressed && buttonStates[index]) {
            buttonStates[index] = false;
          }
        }
      });

      if (now - lastStickTime > STICK_DELAY) {
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;

        if (axisY < -STICK_DEADZONE) {
          dispatchKey(BUTTON_MAP[12]);
          lastStickTime = now;
        } else if (axisY > STICK_DEADZONE) {
          dispatchKey(BUTTON_MAP[13]);
          lastStickTime = now;
        } else if (axisX < -STICK_DEADZONE) {
          dispatchKey(BUTTON_MAP[14]);
          lastStickTime = now;
        } else if (axisX > STICK_DEADZONE) {
          dispatchKey(BUTTON_MAP[15]);
          lastStickTime = now;
        }
      }
    }

    requestAnimationFrame(pollGamepads);
  }

  requestAnimationFrame(pollGamepads);
})();

(function patchShakaAndEME() {
  function applyShakaConfig(shakaInstance) {
    if (!shakaInstance || shakaInstance.__kp_patched) return;
    shakaInstance.__kp_patched = true;

    console.log('[DRM-Patch] Hooked into Shaka Player instance');

    const origLoad = shakaInstance.load.bind(shakaInstance);
    shakaInstance.load = async function(assetUri, ...args) {
      console.log('[DRM-Patch] shaka.load START:', assetUri);
      try {
        const res = await origLoad(assetUri, ...args);
        console.log('[DRM-Patch] shaka.load SUCCESSFUL!');
        try {
          const tracks = shakaInstance.getVariantTracks();
          console.log('[DRM-Patch] Variant tracks count:', tracks.length);
          tracks.forEach(t => {
            console.log(`[DRM-Track] id=${t.id} video=${t.videoCodec} audio=${t.audioCodec} ${t.width}x${t.height} bitrate=${t.bandwidth}`);
          });
        } catch(e) {}
        return res;
      } catch (err) {
        console.error('[DRM-Patch] shaka.load FAILED:', JSON.stringify({
          code: err?.code,
          category: err?.category,
          severity: err?.severity,
          data: err?.data,
          message: err?.message
        }, null, 2));
        throw err;
      }
    };

    shakaInstance.addEventListener('error', (event) => {
      const err = event.detail;
      console.error('[DRM-Patch] Shaka Error Event:', JSON.stringify({
        code: err?.code,
        category: err?.category,
        severity: err?.severity,
        data: err?.data,
        message: err?.message
      }, null, 2));
    });

    const origConfigure = shakaInstance.configure.bind(shakaInstance);
    shakaInstance.configure = function(config, ...args) {
      if (config && typeof config === 'object') {
        if (!config.drm) config.drm = {};
        if (!config.drm.advanced) config.drm.advanced = {};
        config.drm.preferredKeySystems = ['com.widevine.alpha'];

        config.preferredVideoCodecs = ['avc1', 'avc3'];
        config.preferredAudioCodecs = ['mp4a.40.2', 'mp4a'];

        config.restrictions = Object.assign({}, config.restrictions || {}, {
          maxHeight: 1080,
          maxWidth: 1920
        });

        config.drm.advanced['com.widevine.alpha'] = Object.assign(
          {},
          config.drm.advanced['com.widevine.alpha'] || {},
          {
            videoRobustness: 'SW_SECURE_CRYPTO',
            audioRobustness: 'SW_SECURE_CRYPTO',
            sessionType: 'temporary'
          }
        );

        if (!config.manifest) config.manifest = {};
        if (!config.manifest.dash) config.manifest.dash = {};
        config.manifest.dash.ignoreMinBufferTime = true;
        config.manifest.dash.ignoreEmptyAdaptationSet = true;

        if (!config.streaming) config.streaming = {};
        config.streaming.ignoreTextStreamFailures = true;
        config.streaming.dontChooseCodecs = false;

        console.log('[DRM-Patch] Applied patched Shaka config:', JSON.stringify(config.drm));
      }
      return origConfigure(config, ...args);
    };
  }

  function hookShakaClass(shakaObj) {
    if (!shakaObj || !shakaObj.Player || shakaObj.Player.__kp_hooked) return;
    shakaObj.Player.__kp_hooked = true;
    const OrigPlayer = shakaObj.Player;
    shakaObj.Player = function(...args) {
      const player = new OrigPlayer(...args);
      applyShakaConfig(player);
      return player;
    };
    shakaObj.Player.prototype = OrigPlayer.prototype;
    Object.assign(shakaObj.Player, OrigPlayer);
    shakaObj.Player.isBrowserSupported = function() { return true; };
    console.log('[DRM-Patch] Shaka.Player constructor and prototype hooked successfully');
  }

  let _shaka = window.shaka;
  if (_shaka) hookShakaClass(_shaka);

  Object.defineProperty(window, 'shaka', {
    configurable: true,
    enumerable: true,
    get() { return _shaka; },
    set(val) {
      _shaka = val;
      if (_shaka) hookShakaClass(_shaka);
    }
  });

  if (navigator.requestMediaKeySystemAccess) {
    const origRequestMediaKey = navigator.requestMediaKeySystemAccess.bind(navigator);
    navigator.requestMediaKeySystemAccess = function(keySystem, configs) {
      return origRequestMediaKey(keySystem, configs).then(access => {
        console.log('[DRM-Patch] requestMediaKeySystemAccess SUCCESS:', access.keySystem);
        return access;
      }).catch(err => {
        console.warn('[DRM-Patch] requestMediaKeySystemAccess FAILED for', keySystem, 'Error:', err.name, err.message, 'configs:', JSON.stringify(configs));
        throw err;
      });
    };
  }
})();
