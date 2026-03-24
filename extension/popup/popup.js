const toggleSwitch = document.getElementById('toggleSwitch');
const toggleTrack = document.getElementById('toggleTrack');
const toggleThumb = document.getElementById('toggleThumb');
const currentSite = document.getElementById('currentSite');
const pauseSiteBtn = document.getElementById('pauseSiteBtn');
const connectionLabel = document.getElementById('connectionLabel');
const protectionMsg = document.getElementById('protectionMsg');
const appHeading = document.getElementById('appHeading');
const themeToggle = document.getElementById('themeToggle');

// YouTube Specifics
const ytArea = document.getElementById('ytArea');
const pipBtn = document.getElementById('pipBtn');

let isEnabled = true;
let currentDomain = '';
let isPaused = false;
let isDark = true;

const iconSun = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>`;
const iconMoon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/><path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L13.863.1z"/></svg>`;
const iconPause = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>`;
const iconPlay = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>`;

// Initialize
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome')) {
    try {
      const url = new URL(tabs[0].url);
      currentDomain = url.hostname;
      currentSite.textContent = currentDomain || 'Unknown Site';
    } catch {
      currentSite.textContent = 'Invalid URL';
    }
  } else {
    currentSite.textContent = 'System Page';
  }

  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
    if (state) {
      isEnabled = state.enabled;
      updateMainToggle(isEnabled);
    }
  });

  chrome.storage.local.get(['pausedSites', 'theme', 'autoPip'], (data) => {
    isDark = data.theme !== 'light';
    applyTheme();

    const pausedSites = data.pausedSites || [];
    isPaused = pausedSites.includes(currentDomain);
    updatePauseBtn(isPaused);
  });

  // Reveal PiP Area only for YouTube
  if (currentDomain && currentDomain.includes('youtube.com')) {
    if (ytArea) ytArea.style.display = 'block';
  }
});

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  applyTheme();
  chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
});

function applyTheme() {
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.innerHTML = iconSun;
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = iconMoon;
  }
}

// Main Toggle
toggleSwitch.addEventListener('click', () => {
  isEnabled = !isEnabled;
  updateMainToggle(isEnabled);
  chrome.runtime.sendMessage({ type: 'TOGGLE' }, (state) => {
    if (state) {
      isEnabled = state.enabled;
      updateMainToggle(isEnabled);
    }
  });
});

// Pause Button — works on ANY site
pauseSiteBtn.addEventListener('click', () => {
  if (!currentDomain) return;
  
  pauseSiteBtn.style.opacity = '0.5';
  pauseSiteBtn.style.pointerEvents = 'none';

  chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_PAUSE', domain: currentDomain }, (response) => {
    if (chrome.runtime.lastError) {
      pauseSiteBtn.style.opacity = '1';
      pauseSiteBtn.style.pointerEvents = '';
      return;
    }
    if (response) {
      isPaused = response.pausedSites.includes(currentDomain);
      updatePauseBtn(isPaused);
      
      setTimeout(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        });
      }, 300);
    }
  });
});

// YouTube PiP Integrations

if (pipBtn) {
  pipBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        func: () => {
          function findLargestPlayingVideo() {
            const videos = Array.from(document.querySelectorAll('video'))
              .filter(video => video.readyState != 0)
              .filter(video => video.disablePictureInPicture == false)
              .sort((v1, v2) => {
                const v1Rect = v1.getClientRects()[0]||{width:0,height:0};
                const v2Rect = v2.getClientRects()[0]||{width:0,height:0};
                return ((v2Rect.width * v2Rect.height) - (v1Rect.width * v1Rect.height));
              });
            return videos.length > 0 ? videos[0] : null;
          }
          async function requestPictureInPicture(video) {
            await video.requestPictureInPicture();
            video.setAttribute('__pip__', true);
            video.addEventListener('leavepictureinpicture', event => {
              video.removeAttribute('__pip__');
            }, { once: true });
            new ResizeObserver((entries, observer) => {
              const observedVideo = entries[0].target;
              if (!document.querySelector('[__pip__]')) {
                observer.unobserve(observedVideo);
                return;
              }
              const nextVideo = findLargestPlayingVideo();
              if (nextVideo && !nextVideo.hasAttribute('__pip__')) {
                observer.unobserve(observedVideo);
                requestPictureInPicture(nextVideo);
              }
            }).observe(video);
          }
          (async () => {
            const video = findLargestPlayingVideo();
            if (!video) return;
            if (video.hasAttribute('__pip__') || document.pictureInPictureElement) {
              document.exitPictureInPicture();
            } else {
              await requestPictureInPicture(video);
            }
          })();
        }
      });
    });
  });
}

function updateMainToggle(active) {
  if (active) {
    toggleTrack.classList.add('active');
    toggleThumb.classList.add('active');
    appHeading.classList.add('active');
    protectionMsg.classList.add('active');
    connectionLabel.textContent = 'Enabled';
    protectionMsg.innerHTML = 'Your browser is <strong>protected</strong>';
  } else {
    toggleTrack.classList.remove('active');
    toggleThumb.classList.remove('active');
    appHeading.classList.remove('active');
    protectionMsg.classList.remove('active');
    connectionLabel.textContent = 'Disabled';
    protectionMsg.innerHTML = 'Your browser is <strong>not protected</strong>';
  }
}

function updatePauseBtn(paused) {
  if (paused) {
    pauseSiteBtn.classList.add('paused');
    pauseSiteBtn.innerHTML = `${iconPlay}<span>Resume on this site</span>`;
  } else {
    pauseSiteBtn.classList.remove('paused');
    pauseSiteBtn.innerHTML = `${iconPause}<span>Pause on this site</span>`;
  }
  pauseSiteBtn.style.opacity = '1';
  pauseSiteBtn.style.pointerEvents = '';
}
