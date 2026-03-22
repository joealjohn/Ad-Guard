/**
 * YouTube Ad Handler — Ghost Mode v4
 * Strategy: Auto-dismiss anti-adblock popups + click skip buttons.
 * Ads are blocked at the network level by rules.json.
 * This script only handles the anti-adblock popup if YouTube detects the blocking.
 */

(function() {
  'use strict';

  let enabled = true;
  let adsSkipped = 0;
  let popupJustDismissed = false;

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
  // Auto-dismiss anti-adblock popup
  // ==========================================
  function dismissAntiAdblockPopup() {
    // Remove ONLY the enforcement dialog
    const popups = document.querySelectorAll('ytd-enforcement-message-view-model');
    if (popups.length > 0) {
      popups.forEach(el => el.remove());
      popupJustDismissed = true;
    }

    // Remove the dark overlay backdrop
    const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop');
    if (backdrops.length > 0) {
      backdrops.forEach(el => el.remove());
    }

    // Remove enforcement paper dialogs
    const dialogs = document.querySelectorAll('tp-yt-paper-dialog');
    dialogs.forEach(el => {
      if (el.querySelector('ytd-enforcement-message-view-model') ||
          el.textContent.includes('Ad blockers violate')) {
        el.remove();
        popupJustDismissed = true;
      }
    });

    // Fix body scroll lock
    if (document.body && document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }

    // Resume video ONLY right after we dismissed a popup — NOT continuously
    if (popupJustDismissed) {
      const video = document.querySelector('video');
      if (video && video.paused && !video.ended) {
        try { video.play(); } catch {}
      }
      // Hide error screen if present
      const errorScreen = document.querySelector('.ytp-error');
      if (errorScreen) {
        errorScreen.style.display = 'none';
      }
      popupJustDismissed = false;
    }
  }

  // ==========================================
  // Click any visible skip button (for any ads that still load)
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
        return;
      }
    }
  }

  function reportBlocked() {
    adsSkipped++;
    try {
      chrome.runtime.sendMessage({ type: 'AD_BLOCKED' }).catch(() => {});
    } catch {}
  }

  // ==========================================
  // Main loop
  // ==========================================
  function mainLoop() {
    if (!enabled) return;
    try {
      dismissAntiAdblockPopup();
      clickSkipButton();
    } catch {}
  }

  // MutationObserver for instant popup removal
  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          const tag = node.tagName?.toLowerCase();
          if (tag === 'ytd-enforcement-message-view-model' ||
              tag === 'tp-yt-iron-overlay-backdrop') {
            node.remove();
            // Resume video ONCE after popup removal
            const video = document.querySelector('video');
            if (video && video.paused) {
              try { video.play(); } catch {}
            }
          }
        }
      }
    }
  });

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
