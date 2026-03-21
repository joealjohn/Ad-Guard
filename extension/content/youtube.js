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
      toggleAdHidingCSS(enabled);
    });
  } catch {}

  // Listen for state changes
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_CHANGED') {
        enabled = msg.enabled;
        if (!enabled) document.documentElement.setAttribute('data-adguard-disabled', 'true');
        else document.documentElement.removeAttribute('data-adguard-disabled');
        toggleAdHidingCSS(enabled);
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
      removeOverlayAds();
      removePromotedContent();
    } catch (e) {
      // Silently handle errors
    }
  }

  /**
   * Skip video ads by fast-forwarding to end
   */
  function skipVideoAds() {
    const player = document.querySelector('.html5-video-player');
    if (!player) return;

    const isAd = player.classList.contains('ad-showing') || 
                 player.classList.contains('ad-interrupting');

    if (isAd) {
      const video = player.querySelector('video');
      if (video) {
        video.muted = true;
        // Rely on network interception and skip button clicking. 
        // Do not touch currentTime or playbackRate programmatically, 
        // as YouTube's 'ad-showing' class severely lingers into the main video!
      }

      const adContainer = player.querySelector('.video-ads');
      if (adContainer) adContainer.style.display = 'none';

      if (!lastAdState) {
        reportBlocked();
        lastAdState = true;
      }

      clickSkipButton();
    } else {
      if (lastAdState) {
        // Ad just ended — restore normal playback
        const video = document.querySelector('.html5-video-player video');
        if (video) {
          video.muted = false;
          try { video.playbackRate = 1; } catch {}
        }
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
   * Remove overlay ads on the video player (NOT the player itself)
   */
  function removeOverlayAds() {
    const selectors = [
      '.ytp-ad-overlay-container',
      '.ytp-ad-overlay-slot',
      '.video-ads .ad-container',
      '.ytp-ad-text-overlay',
      '.ytp-ad-image-overlay',
      'ytd-action-companion-ad-renderer',
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer',
      'ytd-player-legacy-desktop-watch-ads-renderer',
      'ytd-ad-slot-renderer',
      'ytd-in-feed-ad-layout-renderer',
      '#masthead-ad',
      '#player-ads',
      'ytd-banner-promo-renderer',
      'ytd-statement-banner-renderer',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (isVisible(el)) {
          el.style.display = 'none';
          reportBlocked();
        }
      }
    }
  }

  /**
   * Remove promoted / sponsored content in YouTube feed
   */
  function removePromotedContent() {
    // Look for "Ad" or "Sponsored" badge text
    const badges = document.querySelectorAll('ytd-badge-supported-renderer span');
    for (const badge of badges) {
      const text = badge.textContent?.trim().toLowerCase();
      if (text === 'ad' || text === 'sponsored') {
        const parent = badge.closest(
          'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer'
        );
        if (parent) {
          parent.style.display = 'none';
          reportBlocked();
        }
      }
    }

    // Remove search ad results
    const searchAds = document.querySelectorAll(
      'ytd-search-pyv-renderer, ytd-promoted-video-renderer'
    );
    for (const el of searchAds) {
      el.style.display = 'none';
      reportBlocked();
    }
  }

  /**
   * Check if element is visible
   */
  function isVisible(el) {
    return el && (el.offsetParent !== null || el.getClientRects().length > 0);
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

  /**
   * Inject or remove CSS to hide ad-specific containers
   */
  function toggleAdHidingCSS(enable) {
    let style = document.getElementById('adguard-yt-css');
    
    if (!enable) {
      if (style) style.remove();
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = 'adguard-yt-css';
      style.textContent = `
      .html5-video-player.ad-showing .ytp-ad-player-overlay,
      .html5-video-player.ad-showing .ytp-spinner {
        display: none !important;
      }
      
      /* YouTube ad overlays */
      .ytp-ad-overlay-container,
      .ytp-ad-overlay-slot,
      .ytp-ad-text-overlay,
      .ytp-ad-image-overlay,
      .ytp-ad-skip-button-slot { 
        display: none !important; 
      }

      /* YouTube ad renderers */
      ytd-action-companion-ad-renderer,
      ytd-display-ad-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-player-legacy-desktop-watch-ads-renderer,
      ytd-ad-slot-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-search-pyv-renderer,
      ytd-promoted-video-renderer,
      #masthead-ad,
      #player-ads {
        display: none !important;
      }

      /* YouTube merch shelf */
      ytd-merch-shelf-renderer {
        display: none !important;
      }
    `;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  // === INIT ===
  if (!enabled) document.documentElement.setAttribute('data-adguard-disabled', 'true');
  else document.documentElement.removeAttribute('data-adguard-disabled');

  toggleAdHidingCSS(enabled);

  // Run checker on fast interval for instant blocking
  setInterval(checkForAds, 150);

  console.log('[AdGuard] YouTube ad blocker active');
})();
