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
      /* Cosmetic Ad Hiding */
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

      /* Ghost Mode Blackout Shield: Hides the 16x fast-forward flicker */
      .html5-video-player.ad-showing::after {
        content: "Skipping Ad...";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #000 !important;
        color: #fff !important;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        font-family: 'Roboto', Arial, sans-serif;
        z-index: 999999 !important;
        pointer-events: none !important;
        letter-spacing: 1.5px;
      }
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
        // Pure fast-forward methodology. 
        // We DO NOT mutate video.currentTime! Jumping the timestamp forces YouTube's internal 
        // state machine to lose track of the ad, meaning it fails to transition back 
        // to the main video when the ad ends (causing the permanent black screen).
        // By setting playbackRate = 16, the ad naturally breezes through all events in ~1 second,
        // guaranteeing a flawless transition back to your video.
        video.muted = true;
        try { video.playbackRate = 16; } catch {}
        
        // Force playback in case Chrome battery-optimizes the technically invisible playback
        if (video.paused) {
          video.play().catch(() => {});
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
