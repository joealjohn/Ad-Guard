/**
 * Ghost Ad Blocker — Background Service Worker
 * Manages state, stats, and message handling.
 * NO static network rules — YouTube ad blocking is handled by MAIN world interceptor.
 * Non-YouTube ad blocking is handled by cosmetic.js content script.
 */

const DEFAULT_STATE = {
  enabled: true,
  totalBlocked: 0,
  sessionBlocked: 0
};

// ─── Install & Startup ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('state');
  if (!data.state) {
    await chrome.storage.local.set({ state: DEFAULT_STATE });
  }
  updateIcon(data.state?.enabled ?? true);
  await setupDynamicRules(data.state?.enabled ?? true);
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get('state');
  await setupDynamicRules(data.state?.enabled ?? true);
});

// ─── Dynamic Rules (paused sites only) ───────────────────────────────
async function setupDynamicRules(enabled) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  if (!enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeIds,
      addRules: []
    });
    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ['rules']
      });
    } catch {}
    return;
  }

  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ['rules']
    });
  } catch {}

  const rules = [];
  let ruleId = 1000;

  // AdShield EXACT rules.json replica
  const ADSHIELD_RULES = [
    // ALLOW rules (priority 100)
    { id: ruleId++, priority: 100, action: { type: "allow" }, condition: { urlFilter: "||youtube.com/api/stats/", resourceTypes: ["xmlhttprequest", "image", "ping"] } },
    { id: ruleId++, priority: 100, action: { type: "allow" }, condition: { urlFilter: "||youtube.com/youtubei/v1/player", resourceTypes: ["xmlhttprequest"] } },
    { id: ruleId++, priority: 100, action: { type: "allow" }, condition: { urlFilter: "||youtube.com/youtubei/v1/next", resourceTypes: ["xmlhttprequest"] } },
    { id: ruleId++, priority: 100, action: { type: "allow" }, condition: { urlFilter: "||youtube.com/youtubei/", resourceTypes: ["xmlhttprequest"] } },
    { id: ruleId++, priority: 100, action: { type: "allow" }, condition: { urlFilter: "||googlevideo.com/", resourceTypes: ["xmlhttprequest", "media", "other"] } },

    // BLOCK rules (priority 1)
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "doubleclick.net", resourceTypes: ["script"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "/v1/log_event", resourceTypes: ["xmlhttprequest"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "||youtube.com/ptracking?", resourceTypes: ["image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "||google.com/gen_204?", resourceTypes: ["image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "||js/core/", resourceTypes: ["xmlhttprequest", "ping", "script"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "||googleads.g.doubleclick.net/pagead/id", resourceTypes: ["xmlhttprequest", "image", "script"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "||www.youtube.com/youtubei/v1/player/ad_break", resourceTypes: ["xmlhttprequest"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*googleads.g.doubleclick.net*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*/pubads.*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*/pubads_*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*/api/ads/*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*/googleads_*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*innovid.com*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*/pagead/lvz?*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*/pagead/gen_*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*doubleclick.com*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*google.com/pagead/*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*youtube.com/pagead/*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*googlesyndication.com*", resourceTypes: ["xmlhttprequest", "script", "image"] } },
    { id: ruleId++, priority: 1, action: { type: "block" }, condition: { initiatorDomains: ["youtube.com"], urlFilter: "*www.youtube.com/get_midroll_*", resourceTypes: ["xmlhttprequest", "script", "image"] } }
  ];

  rules.push(...ADSHIELD_RULES);

  // Add paused sites allow rules
  const { pausedSites = [] } = await chrome.storage.local.get('pausedSites');
  for (const site of pausedSites) {
    rules.push({
      id: ruleId++,
      priority: 999,
      action: { type: 'allowAllRequests' },
      condition: { requestDomains: [site], resourceTypes: ['main_frame', 'sub_frame'] }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rules
  });
}

// ─── Storage change listener ─────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state) {
    chrome.storage.local.get('state').then(data => {
      setupDynamicRules(data.state?.enabled ?? true);
    });
  }
});

// ─── Message Handler ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    chrome.storage.local.get('state').then(data => {
      sendResponse(data.state || DEFAULT_STATE);
    });
    return true;
  }

  if (msg.type === 'TOGGLE') {
    chrome.storage.local.get('state').then(async (data) => {
      const state = data.state || DEFAULT_STATE;
      state.enabled = !state.enabled;
      await chrome.storage.local.set({ state });

      await setupDynamicRules(state.enabled);
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
    chrome.storage.local.get(['pausedSites', 'state']).then(async (data) => {
      let pausedSites = data.pausedSites || [];
      const isPaused = pausedSites.includes(domain);
      if (isPaused) {
        pausedSites = pausedSites.filter(d => d !== domain);
      } else {
        pausedSites.push(domain);
      }
      await chrome.storage.local.set({ pausedSites });

      const state = data.state || DEFAULT_STATE;
      await setupDynamicRules(state.enabled);

      sendResponse({ pausedSites });
    });
    return true;
  }

  // Enforcement reload support
  if (msg.action === 'clickRefreshPage') {
    if (sender.tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id, allFrames: true },
        func: () => {
          let attempts = 0;
          const interval = setInterval(() => {
            if (attempts >= 20) return clearInterval(interval);
            attempts++;
            const btn = document.querySelector('button[jscontroller]');
            if (btn) {
              clearInterval(interval);
              btn.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, composed: true, pointerType: 'mouse' }));
            }
          }, 250);
        }
      }).then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
    }
    return true;
  }
});

function updateIcon(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#6A37CC' : '#666' });
}
