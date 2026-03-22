/**
 * YouTube Ad Skipper — Ghost Mode v2
 * Dual-strategy: (1) Auto-dismiss anti-adblock popups, (2) Fast-forward video ads.
 * Zero fingerprints. No custom attributes, no console, no CSS injection.
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

  // ==========================================
  // STRATEGY 1: Auto-dismiss anti-adblock popup
  // ==========================================
  function dismissAntiAdblockPopup() {
    // Remove the enforcement message popup
    const enforcementPopups = document.querySelectorAll(
      'ytd-enforcement-message-view-model, ' +
      'yt-playability-error-supported-renderers'
    );
    enforcementPopups.forEach(el => el.remove());

    // Remove the dark overlay backdrop
    const backdrops = document.querySelectorAll(
      'tp-yt-iron-overlay-backdrop, ' +
      'tp-yt-paper-dialog'
    );
    backdrops.forEach(el => {
      if (el.style.display !== 'none') {
        el.remove();
      }
    });

    // Remove body overflow restrictions that prevent scrolling
    if (document.body) {
      document.body.style.overflow = '';
    }

    // If the video was paused by the popup, resume it
    const video = document.querySelector('video');
    if (video && video.paused && !video.ended) {
      try { video.play(); } catch {}
    }
  }

  // ==========================================
  // STRATEGY 2: Fast-forward video ads
  // ==========================================
  function skipVideoAds() {
    const video = document.querySelector('video');
    if (!video) return;

    const player = document.querySelector('.html5-video-player');
    if (!player) return;

    // Use multiple signals to confirm ad is playing
    const adShowing = player.classList.contains('ad-showing');
    const adContainer = document.querySelector('.video-ads');
    const hasAdChildren = adContainer && adContainer.children.length > 0;

    const isAd = adShowing || hasAdChildren;

    if (isAd) {
      video.muted = true;

      // Fast-forward to end of ad
      if (video.duration && video.duration > 0.5 && video.currentTime < video.duration - 0.5) {
        video.currentTime = video.duration - 0.1;
      }
      try { video.playbackRate = 16; } catch {}

      if (!lastAdState) {
        reportBlocked();
        lastAdState = true;
      }

      clickSkipButton();
    } else {
      if (lastAdState) {
        video.muted = false;
        try { video.playbackRate = 1; } catch {}
        lastAdState = false;
      }
    }
  }

  // ==========================================
  // Click any visible skip button
  // ==========================================
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

  function reportBlocked() {
    adsSkipped++;
    try {
      chrome.runtime.sendMessage({ type: 'AD_BLOCKED' }).catch(() => {});
    } catch {}
  }

  // ==========================================
  // Main loop — runs both strategies every 150ms
  // ==========================================
  function mainLoop() {
    if (!enabled) return;
    try {
      dismissAntiAdblockPopup();
      skipVideoAds();
      clickSkipButton();
    } catch {}
  }

  // Also watch for dynamically inserted popups via MutationObserver
  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          const tag = node.tagName?.toLowerCase();
          if (tag === 'ytd-enforcement-message-view-model' ||
              tag === 'tp-yt-iron-overlay-backdrop' ||
              tag === 'yt-playability-error-supported-renderers') {
            node.remove();
            // Resume video after popup removal
            const video = document.querySelector('video');
            if (video && video.paused) {
              try { video.play(); } catch {}
            }
          }
        }
      }
    }
  });

  // Start observer when DOM is ready
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // === INIT ===
  setInterval(mainLoop, 150);

})();
