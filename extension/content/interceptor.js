/**
 * AdGuard — YouTube MAIN World Interceptor
 * Runs directly in the page context to patch JSON and Fetch.
 * Avoids CSP violations by being injected via manifest.json "world": "MAIN".
 */
(function() {
  'use strict';

  // Anti-Adblock Universal Defuser
  window.hasAdBlocker = false;
  window.isAdBlockActive = false;
  window.canRunAds = true;
  window.isAdBlockOn = false;
  window.adblocker = false;
  window.IsAdBlockActive = false;
  window._sp_ = undefined;

  // Ultimate Anti-Adblock Fake Script Loader
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const el = originalCreateElement.apply(this, arguments);
    if (tagName && typeof tagName === 'string' && tagName.toLowerCase() === 'script') {
        const originalSet = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (originalSet && originalSet.set) {
           Object.defineProperty(el, 'src', {
             set: function(val) {
                if (typeof val === 'string' && (val.includes('ads.js') || val.includes('advertisement.js') || val.includes('banner.js') || val.includes('adblock') || val.includes('fuckadblock') || val.includes('blockadblock') || val.includes('track.js'))) {
                    // This is an anti-adblock honeypot payload targeting our presence!
                    // We instantly simulate a success event to pacify the detector script without ever fetching the file!
                    setTimeout(() => { el.dispatchEvent(new Event('load')); }, 25);
                    return; 
                }
                originalSet.set.call(this, val);
             },
             get: function() { return originalSet.get.call(this); }
           });
        }
    }
    return el;
  };

  const shouldBlockAds = () => !document.documentElement.hasAttribute('data-adguard-disabled');

  const cleanAds = (obj) => {
    if (!shouldBlockAds() || !obj || typeof obj !== 'object') return obj;
    
    // Set to avoid infinite loops on circular references
    const visited = new WeakSet();
    const keysToDelete = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams', 'adSignalsInfo'];
    
    const recursiveClean = (target) => {
      if (!target || typeof target !== 'object' || visited.has(target)) return;
      visited.add(target);
      
      for (const key of keysToDelete) {
         if (target[key] !== undefined) delete target[key];
      }
      
      for (const key in target) {
         if (target.hasOwnProperty(key)) {
            recursiveClean(target[key]);
         }
      }
    };

    try { recursiveClean(obj); } catch (e) {}
    return obj;
  };

  let _ytpr = window.ytInitialPlayerResponse;
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    get: () => _ytpr,
    set: (val) => { _ytpr = cleanAds(val); },
    configurable: true
  });

  let _ytid = window.ytInitialData;
  Object.defineProperty(window, 'ytInitialData', {
    get: () => _ytid,
    set: (val) => { _ytid = cleanAds(val); },
    configurable: true
  });

  if (window.Notification) {
    const originalReq = window.Notification.requestPermission;
    window.Notification.requestPermission = function() {
      if (shouldBlockAds()) return Promise.resolve('denied');
      return originalReq.apply(this, arguments);
    };
  }

  const originalOpenWindow = window.open;
  window.open = function(url) {
    if (shouldBlockAds() && typeof url === 'string' && (url.includes('ad') || url.includes('pop') || url.includes('track'))) {
      return { close: () => {}, focus: () => {}, closed: false };
    }
    return originalOpenWindow.apply(this, arguments);
  };

  const originalParse = JSON.parse;
  JSON.parse = function(text, reviver) {
    let parsed = originalParse.apply(this, arguments);
    if (typeof text === 'string' && (text.includes('adPlacements') || text.includes('playerAds'))) {
        parsed = cleanAds(parsed);
    }
    return parsed;
  };

  const originalJson = Response.prototype.json;
  Response.prototype.json = async function() {
    let data = await originalJson.apply(this, arguments);
    return cleanAds(data);
  };

  const originalFetch = window.fetch;
  window.fetch = async function() {
    let args = arguments;
    const reqURL = args[0] && typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    
    if (shouldBlockAds() && (reqURL.includes('/youtubei/v1/player') || reqURL.includes('/youtubei/v1/next'))) {
      if (args[1] && args[1].body && typeof args[1].body === 'string') {
        try {
          let bodyObj = JSON.parse(args[1].body);
          if (bodyObj.adSignalsInfo) delete bodyObj.adSignalsInfo;
          args[1].body = JSON.stringify(bodyObj);
        } catch (e) {}
      }
    }
    
    const response = await originalFetch.apply(this, args);

    if (shouldBlockAds() && (reqURL.includes('/youtubei/v1/player') || reqURL.includes('/youtubei/v1/next'))) {
      try {
        const clone = response.clone();
        const text = await clone.text();
        if (text.includes('adPlacements') || text.includes('playerAds')) {
          let data = JSON.parse(text);
          return new Response(JSON.stringify(cleanAds(data)), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      } catch (e) {}
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    if (typeof arguments[1] === 'string') this._ytUrl = arguments[1];
    return originalOpen.apply(this, arguments);
  };

  const originalGet = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
  if (originalGet) {
    Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
      get: function() {
        let text = originalGet.get.call(this);
        if (shouldBlockAds() && this._ytUrl && (this._ytUrl.includes('/youtubei/v1/player') || this._ytUrl.includes('/youtubei/v1/next'))) {
          if (text && typeof text === 'string' && (text.includes('adPlacements') || text.includes('playerAds'))) {
            try {
              const data = originalParse(text);
              return JSON.stringify(cleanAds(data));
            } catch (e) {}
          }
        }
        return text;
      },
      configurable: true
    });
  }
})();
