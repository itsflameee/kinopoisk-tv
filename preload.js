const origCreateElement = document.createElement.bind(document);
document.createElement = function(tagName, ...args) {
  const name = tagName.toLowerCase();
  if (name === 'object') {
    const fakeObj = origCreateElement('video', ...args);
    fakeObj.type = 'video/mp4';
    return fakeObj;
  }
  const element = origCreateElement(tagName, ...args);
  if (name === 'script') {
    const origSetAttribute = element.setAttribute.bind(element);
    element.setAttribute = function(attr, value) {
      if (attr.toLowerCase() === 'src' && typeof value === 'string' && value.includes('$WEBAPIS')) {
        setTimeout(() => {
          if (typeof element.onload === 'function') element.onload(new Event('load'));
        }, 0);
          return;
      }
      return origSetAttribute(attr, value);
    };
    Object.defineProperty(element, 'src', {
      set(value) {
        if (typeof value === 'string' && value.includes('$WEBAPIS')) {
          setTimeout(() => {
            if (typeof element.onload === 'function') element.onload(new Event('load'));
          }, 0);
            return;
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
        BUILD: { modelNumber: 'QE65QN90CAU', buildVersion: 'T-PTMDEUC-1402.5' },
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
    getModelCode: function() { return 'QE65QN90CAU'; },
    getModel: function() { return 'QE65QN90CAU'; },
    getRealModel: function() { return 'QE65QN90CAU'; },
    getFirmware: function() { return 'T-PTMDEUC-1402.5'; },
    getSmartTVServerVersion: function() { return 'T-PTMDEUC-1402.5'; },
    isHdrFlagSupported: function() { return true; },
    isUdPanelSupported: function() { return true; },
    is8KPanelSupported: function() { return false; },
    getSystemConfig: function() { return '1'; }
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
  if (e.keyCode === 27 || e.keyCode === 8) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      if (e.keyCode === 8) return;
    }
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
  }
}, true);

(function initGamepadSupport() {
  const BUTTON_MAP = {
    0: { key: 'Enter', code: 'Enter', keyCode: 13 },
    1: { key: 'Return', code: 'Return', keyCode: 10009 },
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
