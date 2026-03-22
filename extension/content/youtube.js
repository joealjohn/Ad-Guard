/**
 * YouTube Ad Skipper — Ghost Mode
 * Zero-fingerprint content script. No custom attributes, no console output,
 * no CSS injection, no prototype pollution. Completely invisible to YouTube's
 * anti-adblock integrity scanner.
 */

(function() {
  'use strict';

  let enabled = true;
  let adsSkipped = 0;
  let lastAdState = false;

  // Check initial state silently
  try {
    chrome.storage.local.get(['state', 'pausedSites'], (data) => {
      if (chrome.runtime.lastError) return;
      const state = data.state;
      const pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(location.hostname);
      if (state) enabled = state.enabled;
      if (!enabled || isPaused) enabled = false;
    });
  } catch {}

  // Listen for state changes silently
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
      }
    });
  } catch {}

  /**
   * Main ad detection and skip loop
   */
  function checkForAds() {
    if (!enabled) return;
    try {
      skipVideoAds();
      clickSkipButton();
    } catch (e) {}
  }

  /**
   * Skip video ads by fast-forwarding to end
   */
  function skipVideoAds() {
    const video = document.querySelector('video');
    if (!video) return;

    const player = document.querySelector('.html5-video-player');
    if (!player) return;

    // Use multiple signals to confirm an ad is truly playing
    const adShowing = player.classList.contains('ad-showing');
    const adContainer = document.querySelector('.video-ads');
    const hasAdChildren = adContainer && adContainer.children.length > 0;

    const isAd = adShowing || hasAdChildren;

    if (isAd) {
      // Mute so user doesn't hear ad audio
      video.muted = true;

      // Fast-forward: scrub timeline to the very end
      if (video.duration && video.duration > 0.5 && video.currentTime < video.duration - 0.5) {
        video.currentTime = video.duration - 0.1;
      }

      // Also set max playback rate as backup
      try { video.playbackRate = 16; } catch {}

      if (!lastAdState) {
        reportBlocked();
        lastAdState = true;
      }

      clickSkipButton();
    } else {
      if (lastAdState) {
        // Ad ended — restore normal playback
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
      '.ytp-ad-skip-button-container button',
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
  setInterval(checkForAds, 150);

})();
