/**
 * Ghost Ad Blocker — Cosmetic Filtering Content Script
 * Hides ad elements on regular websites and blocks pop-unders.
 * Does NOT run aggressive selectors on YouTube (YouTube has its own content script).
 */

(function() {
  'use strict';

  let enabled = true;

  try {
    chrome.storage.local.get(['state', 'pausedSites'], (data) => {
      if (chrome.runtime.lastError) {
         init();
         return;
      }
      const state = data.state;
      const pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(location.hostname);
      
      if (state) enabled = state.enabled;
      
      if (!enabled || isPaused) {
        enabled = false;
        document.documentElement.setAttribute('data-ghost-disabled', 'true');
      } else {
        document.documentElement.removeAttribute('data-ghost-disabled');
        init();
      }
    });
  } catch {
    init();
  }

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
        if (!location.hostname.includes('youtube.com')) {
          toggleCosmeticCSS(enabled);
        }
      }
    });
  } catch {}

  function init() {
    // Skip YouTube — it has its own dedicated content script
    if (location.hostname.includes('youtube.com')) return;

    toggleCosmeticCSS(enabled);
    if (enabled) {
      removeAdIframes();
    }
  }

  /**
   * CSS to hide common ad containers (non-YouTube sites only)
   */
  function toggleCosmeticCSS(enable) {
    let style = document.getElementById('ghost-cosmetic');
    if (!enable) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = 'ghost-cosmetic';
      style.textContent = `
      /* Generic eXtreme Testing & Invasive Ads */
      .interstitial, .interstitial-ad, .overlay-ad,
      .push-ad, .in-page-push, .push-notification-ad,
      .native-ad, .sponsored-post, .promoted-post,
      .banner-ad, .ad-banner, .advertisement,
      .ad-container, .ad-slot, .ad-wrapper, .ad-box,
      .popunder, .popunder-ad, .pop-under,
      .static-ad, .dynamic-ad, .adBanner, .ad_widget,
      .text-ad, .ad-left, .ad-right, .ad-top, .ad-bottom,
      .ad-header, .ad-footer, .banner_ad, .sponsorPost,
      #myAdblockMessage, .adblock-notice, #adblock-notice,
      .fuckadblock, .anti-adblock, .adblock-overlay, .ab-message,
      div[id*="GoogleActiveViewElement"],
      iframe[name*="doubleclick"],
      a[href*="/ad.php"], a[href*="/click.php?ad="],
      [class*="ad-container"], [class*="ad-wrapper"],
      [class*="ad-slot"], [id*="ad-wrapper"], [id*="ad-slot"] {
        display: none !important;
        position: absolute !important;
        left: -10000px !important;
        top: -10000px !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        z-index: -9999 !important;
      }

      /* Google Ads */
      ins.adsbygoogle,
      .adsbygoogle,
      [id^="google_ads_"],
      [id^="div-gpt-ad"],
      [data-ad-slot],
      [data-ad-client] {
        display: none !important;
        position: absolute !important;
        left: -10000px !important;
        top: -10000px !important;
        width: 1px !important;
        height: 1px !important;
      }

      /* Ad iframes */
      iframe[src*="doubleclick.net"],
      iframe[src*="googlesyndication.com"],
      iframe[src*="googleadservices.com"],
      iframe[src*="amazon-adsystem.com"],
      iframe[src*="taboola.com"],
      iframe[src*="outbrain.com"] {
        display: none !important;
      }

      /* Taboola / Outbrain widgets */
      .trc_rbox,
      .OUTBRAIN,
      [id^="taboola-"],
      [class*="taboola-"],
      [class*="outbrain-widget"] {
        display: none !important;
      }

      /* Tabloid Specific (Daily Mail, etc) - Empty Spaces & Floating Videos */
      .mpu_ad, .puff_advert, .mpu-container, .ad-content,
      .vjs-flyout-container, .vjs-flyout-placeholder, 
      .mol-video-player, .fiv-video, .mol-ads-cmp,
      .video-ad-container, .floating-video-ad, .sticky-video-ad {
        display: none !important;
        height: 0px !important;
        padding: 0px !important;
        margin: 0px !important;
      }
    `;
      document.head?.appendChild(style);
    }
  }

  /**
   * Remove known ad iframes from the DOM proactively
   */
  function removeAdIframes() {
    const adDomains = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'amazon-adsystem.com', 'taboola.com', 'outbrain.com',
      'adnxs.com', 'criteo.com', 'pubmatic.com', 'popads', 'popcash',
      'clickadu', 'adsterra', 'exoclick', 'juicyads', 'pornhubnetwork',
      'traffichunt', 'propellerads', 'mgid.com', 'revcontent.com'
    ];

    function sweep() {
      document.querySelectorAll('iframe').forEach(iframe => {
        const src = iframe.src || iframe.dataset.src || '';
        if (adDomains.some(d => src.includes(d))) {
          iframe.style.setProperty('display', 'none', 'important');
          iframe.remove();
          try { chrome.runtime.sendMessage({ type: 'AD_BLOCKED' }).catch(() => {}); } catch {}
        }
      });
    }

    // Initial sweep
    sweep();

    // Watch for dynamically added iframes by trackers
    const observer = new MutationObserver((mutations) => {
      let shouldSweep = false;
      for (const m of mutations) {
        if (m.addedNodes.length) {
          shouldSweep = true;
          break;
        }
      }
      if (shouldSweep) sweep();
    });
    
    // Defer observation slightly to let page load first
    setTimeout(() => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }, 1000);
  }
})();
