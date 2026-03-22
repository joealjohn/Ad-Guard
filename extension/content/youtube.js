/**
 * YouTube Ad Handler — Ghost Mode Ultimate Stable
 * No JSON interception. No network blocking. No popups.
 * Pure, sub-frame DOM scrubbing for 100% crash-proof ad skipping.
 */

(function() {
  'use strict';

  let enabled = true;

  // Listen for state changes
  try {
    chrome.storage.local.get(['state', 'pausedSites'], (data) => {
      if (chrome.runtime.lastError) return;
      const state = data.state;
      const pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(location.hostname);
      if (state) enabled = state.enabled;
      if (!enabled || isPaused) enabled = false;
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
      }
    });
  } catch {}

  function skipAds() {
    if (!enabled) return;

    // 1. Remove anti-adblock popups
    const popups = document.querySelectorAll('ytd-enforcement-message-view-model, tp-yt-iron-overlay-backdrop');
    if (popups.length > 0) {
      popups.forEach(el => el.remove());
      // Fix body scroll lock
      if (document.body && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      // Hide fatal error screen if it triggers
      const errorScreen = document.querySelector('.ytp-error');
      if (errorScreen) errorScreen.style.display = 'none';

      // Resume main video
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (video.paused && video.readyState > 0) {
          try { video.play(); } catch {}
        }
      });
    }

    // 2. Ultra-fast ad skip
    const isAd = document.querySelector('.ad-showing');
    if (isAd) {
      // ONLY target the main video player, not hidden tracking videos
      const video = document.querySelector('.html5-main-video');
      if (video && !isNaN(video.duration)) {
        video.muted = true;
        video.playbackRate = 16;
        
        // CRITICAL BUGFIX: Never scrub to exact 'video.duration'.
        // Doing so often causes YouTube's MSE buffer to hang indefinitely
        // waiting for non-existent chunk data, resulting in a black screen.
        // Leaving a 0.1s buffer allows native 'ended' events to fire smoothly.
        if (video.currentTime < video.duration - 0.5) {
          video.currentTime = video.duration - 0.1;
        }
      }

      // Spam click any skip buttons
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
