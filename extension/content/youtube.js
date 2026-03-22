/**
 * YouTube Ad Handler — Ghost Mode v5 (Virtual Environment)
 * Strategy: Visually/audibly firewall the ad into a "virtual environment"
 * (black screen + muted), instantly fast-forward it by scrubbing the timeline,
 * then restore the actual video. This prevents YouTube from detecting
 * blocked network tracking pings while entirely hiding the ad from the user.
 */

(function() {
  'use strict';

  let enabled = true;
  let adsSkipped = 0;
  let adShieldActive = false;

  // Check initial state
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

  // Listen for state changes
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
        if (!enabled) removeAdShield();
      }
    });
  } catch {}

  // ==========================================
  // Virtual Environment Shield UI
  // ==========================================
  function injectAdShield() {
    let shield = document.getElementById('adguard-virtual-shield');
    if (!shield) {
      shield = document.createElement('div');
      shield.id = 'adguard-virtual-shield';
      shield.style.cssText = `
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background: black;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-family: -apple-system, sans-serif;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.1s;
        pointer-events: none;
      `;
      // Optional: Add a subtle loading spinner or branding
      shield.innerHTML = `<span style="opacity: 0.5;">AdGuard Blocking...</span>`;
      
      const playerContainer = document.querySelector('.html5-video-player');
      if (playerContainer) {
        playerContainer.appendChild(shield);
      } else {
        return null;
      }
    }
    return shield;
  }

  function activateAdShield(video) {
    if (!adShieldActive) {
      adShieldActive = true;
      video.muted = true; // Instantly kill ad audio
      
      const shield = injectAdShield();
      if (shield) {
        shield.style.opacity = '1'; // Visually black out the ad
      }
      
      // Fast-forward the ad in the background
      if (video.duration && video.duration > 0.5) {
        video.currentTime = video.duration - 0.1;
      }
      try { video.playbackRate = 16; } catch {}
      
      reportBlocked();
    } else {
      // Keep forcing the scrub if the ad is struggling to skip
      if (video.duration && video.duration > 0.5 && video.currentTime < video.duration - 0.5) {
        video.currentTime = video.duration - 0.1;
      }
    }
    
    clickSkipButton();
  }

  function removeAdShield(video) {
    if (adShieldActive) {
      adShieldActive = false;
      
      // Restore audio and playback rate for the real video
      if (video) {
        video.muted = false;
        try { video.playbackRate = 1; } catch {}
      }
      
      const shield = document.getElementById('adguard-virtual-shield');
      if (shield) {
        shield.style.opacity = '0';
      }
    }
  }

  // ==========================================
  // Detect Ads & Anti-Adblock Popups
  // ==========================================
  function handleAds() {
    if (!enabled) return;

    // 1. Check for video ads
    const video = document.querySelector('video');
    const player = document.querySelector('.html5-video-player');
    
    if (video && player) {
      const adShowing = player.classList.contains('ad-showing');
      const adContainer = document.querySelector('.video-ads');
      const hasAdChildren = adContainer && adContainer.children.length > 0;
      const isAdContent = window.location.href.includes('adformat=');

      if (adShowing || hasAdChildren || isAdContent) {
        activateAdShield(video);
      } else {
        removeAdShield(video);
      }
    }

    // 2. Clear known anti-adblock popups if they appear anyway
    const popups = document.querySelectorAll('ytd-enforcement-message-view-model, tp-yt-iron-overlay-backdrop');
    if (popups.length > 0) {
      popups.forEach(el => el.remove());
      if (document.body && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
    }
  }

  // ==========================================
  // Click skip buttons
  // ==========================================
  function clickSkipButton() {
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
      if (btn) {
        btn.click();
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

  // Run heavily on interval to guarantee exact-millisecond interception
  setInterval(handleAds, 50);

})();
