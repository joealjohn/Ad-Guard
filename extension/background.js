/**
 * AdGuard — Background Service Worker
 * Manages ad blocking rules, tracks statistics, handles toggle state.
 */

const DEFAULT_STATE = {
  enabled: true,
  totalBlocked: 0,
  sessionBlocked: 0
};

// Initialize state on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('state');
  if (!data.state) {
    await chrome.storage.local.set({ state: DEFAULT_STATE });
  }
  updateIcon(data.state?.enabled ?? true);
  console.log('[AdGuard] Extension installed');
});

// Track blocked requests via declarativeNetRequest
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener(async (info) => {
  const data = await chrome.storage.local.get('state');
  const state = data.state || DEFAULT_STATE;
  state.totalBlocked++;
  state.sessionBlocked++;
  await chrome.storage.local.set({ state });
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    chrome.storage.local.get('state').then(data => {
      sendResponse(data.state || DEFAULT_STATE);
    });
    return true; // async
  }

  if (msg.type === 'TOGGLE') {
    chrome.storage.local.get('state').then(async (data) => {
      const state = data.state || DEFAULT_STATE;
      state.enabled = !state.enabled;
      await chrome.storage.local.set({ state });

      // Enable/disable the static ruleset
      if (state.enabled) {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: ['adblock_rules']
        });
      } else {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          disableRulesetIds: ['adblock_rules']
        });
      }

      updateIcon(state.enabled);

      // Notify all tabs about state change
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED', enabled: state.enabled }).catch(() => {});
      }

      sendResponse(state);
    });
    return true;
  }

  if (msg.type === 'AD_BLOCKED') {
    // Content script reports an ad was blocked/skipped
    chrome.storage.local.get('state').then(async (data) => {
      const state = data.state || DEFAULT_STATE;
      state.totalBlocked++;
      state.sessionBlocked++;
      await chrome.storage.local.set({ state });
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === 'RESET_STATS') {
    chrome.storage.local.get('state').then(async (data) => {
      const state = data.state || DEFAULT_STATE;
      state.sessionBlocked = 0;
      await chrome.storage.local.set({ state });
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === 'TOGGLE_SITE_PAUSE') {
    const domain = msg.domain;
    chrome.storage.local.get(['pausedSites']).then(async (data) => {
      let pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(domain);
      
      if (isPaused) {
        pausedSites = pausedSites.filter(d => d !== domain);
      } else {
        pausedSites.push(domain);
      }
      
      await chrome.storage.local.set({ pausedSites });
      
      const dynamicRules = pausedSites.map((site, index) => ({
        id: 1000 + index,
        priority: 999,
        action: { type: 'allowAllRequests' },
        condition: { requestDomains: [site], resourceTypes: ["main_frame", "sub_frame"] }
      }));
      
      let oldRules = [];
      try { oldRules = await chrome.declarativeNetRequest.getDynamicRules(); } catch(e) {}
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRules.map(r => r.id),
        addRules: dynamicRules
      });

      sendResponse({ pausedSites });
    });
    return true;
  }
});

function updateIcon(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#DC2626' : '#666' });
}
