/**
 * AdGuard — YouTube Ad Blocker Content Script
 * Skips video ads, removes overlay ads, hides ad banners on YouTube.
 * Uses only DOM manipulation (no inline script injection to comply with MV3 CSP).
 */

(function() {
  'use strict';

  let enabled = true;
  let adsSkipped = 0;
  let lastAdState = false;

  // Check initial state
  try {
    chrome.storage.local.get(['state', 'pausedSites'], (data) => {
      if (chrome.runtime.lastError) return;
      const state = data.state;
      const pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(location.hostname);
      
      if (state) enabled = state.enabled;
      
      if (!enabled || isPaused) {
        enabled = false;
        document.documentElement.setAttribute('data-adguard-disabled', 'true');
      } else {
        document.documentElement.removeAttribute('data-adguard-disabled');
      }

    });
  } catch {}

  // Listen for state changes
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
        if (!enabled) document.documentElement.setAttribute('data-adguard-disabled', 'true');
        else document.documentElement.removeAttribute('data-adguard-disabled');

      }
    });
  } catch {}

  /**
   * Main ad detection and removal loop
   */
  function checkForAds() {
    if (!enabled) return;

    try {
      skipVideoAds();
      clickSkipButton();
    } catch (e) {
      // Silently handle errors
    }
  }

  /**
   * Skip video ads by fast-forwarding to end
   */
  function skipVideoAds() {
    const video = document.querySelector('video.video-stream, video.html5-main-video');
    const adContainer = document.querySelector('.video-ads.ytp-ad-module, .video-ads');
    
    if (!video || !adContainer) return;

    // Bulletproof Ad Validation: YouTube physically injects node elements into .video-ads ONLY when an ad is actively playing
    // This entirely avoids the "lingering .ad-showing class" bug while surviving YouTube's A/B class renaming!
    const isAd = adContainer.children.length > 0;

    if (isAd) {
      video.muted = true;
      
      // Fast Human Bypass: Instantly scrub to the exact end of the payload
      if (!isNaN(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.5) {
        video.currentTime = video.duration - 0.1;
        video.playbackRate = 16.0;
      }

      if (!lastAdState) {
        reportBlocked();
        lastAdState = true;
      }

      clickSkipButton();
    } else {
      if (lastAdState) {
        // Ad just ended — restore normal playback settings safely
        video.muted = false;
        try { video.playbackRate = 1; } catch {}
        lastAdState = false;
      }
    }
  }

  /**
   * Click any visible skip button
   */
  function clickSkipButton() {
    const skipSelectors = [
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      'button.ytp-ad-skip-button',
      '.videoAdUiSkipButton',
      '.ytp-ad-skip-button-slot button',
    ];

    for (const sel of skipSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        reportBlocked();
        return true;
      }
    }
    return false;
  }
  /**
   * Report blocked ad to background
   */
  function reportBlocked() {
    adsSkipped++;
    try {
      chrome.runtime.sendMessage({ type: 'AD_BLOCKED' }).catch(() => {});
    } catch {}
  }

  // === INIT ===
  if (!enabled) document.documentElement.setAttribute('data-adguard-disabled', 'true');
  else document.documentElement.removeAttribute('data-adguard-disabled');

  // Run checker on fast interval for instant blocking
  setInterval(checkForAds, 150);

  console.log('[AdGuard] YouTube Fast-Human Ghost Mode active');
})();
