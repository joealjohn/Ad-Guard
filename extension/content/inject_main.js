/**
 * Ghost Ad Blocker — MAIN World Injector
 * Runs in the main page context to spoof anti-adblock variables securely.
 */
(function() {
  if (window.ghostPopupBlockerLoaded) return;
  window.ghostPopupBlockerLoaded = true;
  
  // Neutralize window.open
  const originalOpen = window.open;
  window.open = function(url, windowName, windowFeatures) {
    console.log('[Ghost] Blocked popup/pop-under attempt.');
    return null;
  };

  // Anti-Adblock Spoofing
  window.hasAdblock = false;
  window._hasAdblock = false;
  window.isAdBlockActive = false;
  window.adblock = false;

  const fakeAdBlock = {
    on: function() { return this; },
    onDetected: function() { return this; },
    onNotDetected: function(fn) { if (typeof fn === 'function') fn(); return this; },
    check: function() { return false; },
    clearEvent: function() { return this; },
    emitEvent: function() { return this; }
  };
  window.FuckAdBlock = fakeAdBlock;
  window.fuckAdBlock = fakeAdBlock;
  window.BlockAdBlock = fakeAdBlock;
  window.blockAdBlock = fakeAdBlock;

  // Analytics & Error Tracking Stubs (defeats script execution checks)
  window.ga = window.ga || function() {};
  window.GoogleAnalyticsObject = 'ga';
  window.dataLayer = window.dataLayer || [];
  window.yaCounter = window.yaCounter || function() {};
  window.ym = window.ym || function() {};
  window.Bugsnag = window.Bugsnag || {
    start: function() {}, notify: function() {}, leaveBreadcrumb: function() {}
  };
  window.Sentry = window.Sentry || {
    init: function() {}, captureException: function() {}, captureMessage: function() {}
  };
  window.hj = window.hj || function() {};
  window._hjSettings = window._hjSettings || {};

  // Advanced Anti-Adblock: Spoofing DOM dimensions for hidden ad containers
  // Tricks shortener scripts that check if an ad banner has height === 0
  const spoofHeight = function(originalGetter) {
    return function() {
      const val = originalGetter.call(this);
      if (val === 0) {
        const id = (this.id || '').toLowerCase();
        const cls = (typeof this.className === 'string' ? this.className : '').toLowerCase();
        if (id.includes('ad') || cls.includes('ad') || id.includes('banner') || cls.includes('banner')) {
          return 90; // Fake height
        }
      }
      return val;
    };
  };

  const offsetDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  if (offsetDesc && offsetDesc.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get: spoofHeight(offsetDesc.get) });
  }
  
  const clientDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  if (clientDesc && clientDesc.get) {
    Object.defineProperty(Element.prototype, 'clientHeight', { get: spoofHeight(clientDesc.get) });
  }

  // Spoof getComputedStyle 'display' and 'visibility' properties for hidden ads
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function(el, pseudoElt) {
    const style = originalGetComputedStyle.call(this, el, pseudoElt);
    if (el && (style.display === 'none' || style.visibility === 'hidden')) {
        const id = (el.id || '').toLowerCase();
        const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
        if (id.includes('ad') || cls.includes('ad') || id.includes('banner') || cls.includes('banner')) {
            return new Proxy(style, {
                get(target, prop) {
                    if (prop === 'display') return 'block';
                    if (prop === 'visibility') return 'visible';
                    // Optional: mock getPropertyValue
                    if (prop === 'getPropertyValue') {
                       return (p) => {
                          if (p === 'display') return 'block';
                          if (p === 'visibility') return 'visible';
                          return target.getPropertyValue(p);
                       };
                    }
                    if (typeof target[prop] === 'function') {
                        return target[prop].bind(target);
                    }
                    return target[prop];
                }
            });
        }
    }
    return style;
  };

  // Additional generic flags used by link shorteners
  window.adblocker = false;
  window.adblock_detected = false;

  // Revert patches if extension is disabled (data-ghost-disabled set by cosmetic.js)
  const observer = new MutationObserver(() => {
    if (document.documentElement.hasAttribute('data-ghost-disabled')) {
      window.open = originalOpen;
      window.getComputedStyle = originalGetComputedStyle;
      if (offsetDesc) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetDesc);
      if (clientDesc) Object.defineProperty(Element.prototype, 'clientHeight', clientDesc);
      
      delete window.FuckAdBlock;
      delete window.fuckAdBlock;
      delete window.BlockAdBlock;
      delete window.blockAdBlock;
      delete window.ga;
      delete window.GoogleAnalyticsObject;
      delete window.dataLayer;
      delete window.yaCounter;
      delete window.ym;
      delete window.Bugsnag;
      delete window.Sentry;
      delete window.hj;
      delete window._hjSettings;
      
      window.hasAdblock = window._hasAdblock = window.isAdBlockActive = window.adblock = window.adblocker = window.adblock_detected = undefined;
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ghost-disabled'] });
})();
