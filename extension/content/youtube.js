/**
 * YouTube Ad Handler — Ghost Mode Ultimate Stable
 * No JSON interception. No network blocking. No popups.
 * Pure, sub-frame DOM scrubbing for 100% crash-proof ad skipping.
 */

(function() {
  'use strict';

  let enabled = true;

  // Inject CSS to hide all cosmetic/feed ads on YouTube instantly
  function injectCosmeticCSS() {
    if (document.getElementById('adguard-yt-cosmetic')) return;
    const style = document.createElement('style');
    style.id = 'adguard-yt-cosmetic';
    style.textContent = `
      ytd-ad-slot-renderer,
      ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
      ytd-rich-item-renderer:has(.badge-style-type-ad),
      ytd-rich-item-renderer:has(#ad-badge),
      ytd-in-feed-ad-layout-renderer,
      ytd-rich-section-renderer:has(ytd-ad-slot-renderer),
      ytd-compact-promoted-video-renderer,
      ytd-compact-video-renderer:has(.badge-style-type-ad),
      #masthead-ad,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-search-pyv-renderer,
      ytd-action-companion-ad-renderer
      { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // Listen for state changes
  try {
    chrome.storage.local.get(['state', 'pausedSites'], (data) => {
      if (chrome.runtime.lastError) return;
      const state = data.state;
      const pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(location.hostname);
      if (state) enabled = state.enabled;
      if (!enabled || isPaused) enabled = false;
      
      if (enabled) injectCosmeticCSS();
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
        if (enabled) {
          injectCosmeticCSS();
        } else {
          const style = document.getElementById('adguard-yt-cosmetic');
          if (style) style.remove();
        }
      }
    });
  } catch {}

  function skipAds() {
    if (!enabled) return;

    // 1. Remove anti-adblock popups
    const popups = document.querySelectorAll('ytd-enforcement-message-view-model, tp-yt-iron-overlay-backdrop');
    if (popups.length > 0) {
      popups.forEach(el => el.remove());
      if (document.body && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      const errorScreen = document.querySelector('.ytp-error');
      if (errorScreen) errorScreen.style.display = 'none';

      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (video.paused && video.readyState > 0) {
          try { video.play(); } catch {}
        }
      });
    }

    // 2. Ultra-stable Ad Scrubbing (No Buffer Starvation)
    const player = document.querySelector('.html5-video-player');
    if (player && player.classList.contains('ad-showing')) {
      const video = document.querySelector('video');
      if (video && !isNaN(video.duration)) {
        // Single-jump skip mechanism. 
        // We do NOT use playbackRate=16 because it instantly exhausts the buffer on HD ads, causing a black screen freeze.
        // We do NOT blindly set currentTime=duration every 10ms because that causes permanent seeking-lock loops.
        // By checking if we are far from the end, we only command the jump ONCE, allowing the browser to transition flawlessly.
        if (video.currentTime < video.duration - 1) {
          video.currentTime = video.duration - 0.1;
        }
      }

      // Spam click any skip buttons the millisecond they render
      const skipSelectors = [
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        'button.ytp-ad-skip-button',
        '.videoAdUiSkipButton',
        '.ytp-ad-skip-button-slot button'
      ];
      for (const sel of skipSelectors) {
        const btn = document.querySelector(sel);
        if (btn) btn.click();
      }
    }
  }

  // Use MutationObserver for instant reaction to UI changes
  const observer = new MutationObserver(() => {
    if (enabled) skipAds();
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // 10ms interval guarantees sub-frame reaction times for video events
  setInterval(skipAds, 10);

})();
