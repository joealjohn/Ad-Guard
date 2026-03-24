function injectScript(filePath) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(filePath);
  script.type = 'text/javascript';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

window.addEventListener('message', function (event) {
  if (event.source !== window) return;

  const message = event.data;

  if (message?.source === 'YT_AD_CLEANER' && message.type === 'INCREMENT_COUNTER') {
    const key = message.key || 'adBlockCount';
    const MAX_COUNT = 9999999999999999999;

    try {
      if (!chrome.runtime?.id) return;
      chrome.storage.local.get([key], function (result) {
        if (chrome.runtime.lastError) return;
        let count = result[key] || 0;

        if (count < MAX_COUNT) {
          count++;
          chrome.storage.local.set({ [key]: count }, function () {});
          try {
            chrome.runtime.sendMessage({ type: 'AD_BLOCKED' }).catch(() => {});
          } catch (e) {}
        }
      });
    } catch (e) {}
  }
});

function checkForYtpErrorAndSetFlag() {
  if (document.querySelector('.ytp-error')) {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h in ms
    try {
      if (!chrome.runtime?.id) return;
      chrome.storage.local.set({ ghostDisableFlag: expiresAt }, () => {
        console.log('[Ghost] Disable flag set for 24h due to ytp-error');
      });
    } catch (e) {}
  }
}

// Inject utils.js synchronously at document_start before any page scripts run.
document.addEventListener('DOMContentLoaded', checkForYtpErrorAndSetFlag);
injectScript('content/adshield-utils.js');

// Also inject interceptor.js (Removed - getting detected)
// injectScript('content/interceptor.js');

try {
  if (!chrome.runtime?.id) throw new Error();
  chrome.storage.local.get(['state', 'pausedSites', 'ghostDisableFlag'], function (result) {
    if (chrome.runtime.lastError) return;
    const isEnabled = result.state ? result.state.enabled : true;
  const pausedSites = result.pausedSites || [];
  const isPaused = pausedSites.includes(location.hostname);

  if (isEnabled && !isPaused) {

    isGhostDisabled();
    function isGhostDisabled() {
      const expiresAt = result.ghostDisableFlag;
      const now = Date.now();

      if (expiresAt && now < expiresAt) {
        fallbackVersion();
      } else {
        fallbackVersion();
      }
    }

    function fallbackVersion() {
      var isexecuted = false;
      const E = [
        {selector: '[target-id="engagement-panel-ads"]', action: "hide"},
        {selector: "#offer-module", action: "hide"},
        {selector: "ytd-rich-item-renderer ytd-display-ad-renderer", action: "hideAncestor", ancestorLevel: 2},
        {selector: "ytd-player-legacy-desktop-watch-ads-renderer", action: "hide"},
        {selector: "#player-ads", action: "hide"},
        {selector: ".ytd-player-legacy-desktop-watch-ads-renderer", action: "hide"},
        {selector: ".ytp-ad-image-overlay", action: "hide"},
        {selector: ".ytp-ad-text-overlay", action: "hide"},
        {selector: "ytd-ad-slot-renderer", action: "hide"},
        {selector: "ytd-enforcement-message-view-model", action: "reloadIfButton", single: !0},
        {selector: ".style-scope ytd-item-section-renderer", action: "hideIfChild", filterChild: "#sitelinks-table"},
        {selector: ".ytp-ad-skip-button-modern.ytp-button", action: "click", single: !0},
        {selector: ".ytp-skip-ad-button", action: "click", single: !0},
        {selector: ".ytp-ad-skip-button", action: "click", single: !0},
        {selector: ".ytp-ad-text.ytp-ad-skip-button-text-centered.ytp-ad-skip-button-text", action: "click", single: !0},
        {selector: ".html5-video-player.ad-showing", action: "videoAd", skipButtonSelector: ".ytp-ad-skip-button", single: !0},
        {selector: "#fc-whitelist-iframe", action: "iframeWhitelist", single: !0}
      ];

      function fullClick(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const x = rect.left + (rect.width / 2);
        const y = rect.top + (rect.height / 2);
        const eventOptions = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
        ['mouseover', 'mouseenter', 'mousemove', 'mousedown', 'mouseup', 'click'].forEach(eventType => {
          element.dispatchEvent(new MouseEvent(eventType, eventOptions));
        });
      }

      function incrementAdBlockCount() {
        try {
          if (chrome.runtime?.id) {
            chrome.storage.local.get(['adBlockCount'], function (result) {
              if (chrome.runtime.lastError) return;
              let count = result.adBlockCount || 0;
              count++;
              chrome.storage.local.set({ adBlockCount: count }, function () {});
            });
          }
        } catch (e) {}
      }

      setInterval(() => {
        for (const item of E) {
          try {
            if (item.action === "hide") {
              const elements = document.querySelectorAll(item.selector);
              elements.forEach(el => { if (el.style.display !== "none") el.style.display = "none"; });
            } else if (item.action === "hideAncestor") {
              const elements = document.querySelectorAll(item.selector);
              elements.forEach(el => {
                let ancestor = el;
                for (let i = 0; i < item.ancestorLevel; i++) { if (ancestor && ancestor.parentElement) ancestor = ancestor.parentElement; }
                if (ancestor && ancestor.style.display !== "none") ancestor.style.display = "none";
              });
            } else if (item.action === "hideIfChild") {
              const elements = document.querySelectorAll(item.selector);
              elements.forEach(el => {
                if (el.querySelector(item.filterChild) && el.style.display !== "none") el.style.display = "none";
              });
            } else if (item.action === "click") {
              const el = document.querySelector(item.selector);
              if (el) { fullClick(el); }
            } else if (item.action === "videoAd") {
              const player = document.querySelector(item.selector);
              if (player) {
                const skipBtn = document.querySelector(item.skipButtonSelector);
                if (skipBtn) {
                  fullClick(skipBtn);
                  incrementAdBlockCount();
                } else {
                  const video = player.querySelector("video");
                  if (video) {
                    video.currentTime = isNaN(video.duration) ? 0 : video.duration;
                    incrementAdBlockCount();
                  }
                }
              }
            } else if (item.action === "reloadIfButton") {
              const el = document.querySelector(item.selector);
              if (el && el.querySelector('button')) {
                const RELOAD_LIMIT = 4;
                const TIME_WINDOW_MS = 3 * 60 * 1000;
                const STORAGE_KEY = 'global_page_reload_info';
                const now = Date.now();
                const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { timestamps: [] };
                storedData.timestamps = storedData.timestamps.filter(ts => now - ts < TIME_WINDOW_MS);
                if (storedData.timestamps.length < RELOAD_LIMIT) {
                  storedData.timestamps.push(now);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
                  console.log(`[Ghost] Reloading (${storedData.timestamps.length}/${RELOAD_LIMIT})...`);
                  window.location.reload();
                } else {
                  console.log('[Ghost] Reload limit reached. No more reloads allowed within 3 minutes.');
                }
              }
            } else if (item.action === "iframeWhitelist") {
              const iframe = document.querySelector(item.selector);
              if (iframe && !isexecuted) {
                isexecuted = true;
                setTimeout(function () {
                  try {
                    if (chrome.runtime?.id) {
                      chrome.runtime.sendMessage({ action: "clickRefreshPage" }, (response) => {
                        if (chrome.runtime.lastError) return;
                        if (response && response.success && iframe) iframe.style.visibility = "hidden";
                      });
                    }
                  } catch (e) {}
                }, 1000);
              }
            }
          } catch (e) {}
        }
      }, 250);

      const style = document.createElement('style');
      style.textContent = `
          ytd-ad-slot-renderer {
            display: none !important;
          }
        `;

      function appendStyle() {
        if (document.body) {
          document.body.appendChild(style);
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(style);
          });
        }
      }
      appendStyle();
    }
  }
});
} catch (e) {}
