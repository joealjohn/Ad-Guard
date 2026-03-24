<div align="center">
  <img src="extension/icons/icon128.png" width="128" alt="GHOST Logo">
  <h1>GHOST Ad Blocker</h1>
  <p><strong>A hyper-aggressive, stealth-focused Ad, Tracker, and Anti-Adblock eliminator for Manifest V3.</strong></p>
</div>

---

## ⚡ Overview
**GHOST** is not just another ad blocker. Built exclusively on Chrome's modern **Manifest V3** architecture, GHOST combines lightning-fast network interception with advanced DOM manipulation to completely eradicate ads across the web, specifically targeting YouTube and hostile ad-blocker-blocking websites.

## 🚀 Key Features
- 🛡️ **Network-Level Eradication:** Utilizes `declarativeNetRequest` to silently drop connections to over 140+ major ad syndicates, telemetry trackers (Google Analytics, Hotjar), and OEM beacons before they even load.
- 🎯 **YouTube Ad Skipper Engine:** A dedicated content script that intercepts and brutally skips YouTube pre-roll, mid-roll, and overlay ads instantly, automatically clicking skip buttons and forwarding video players to bypass enforcement.
- 🥷 **Anti-Adblock Spoofing:** Defeats "Please Disable Your Adblocker" overlays (commonly found on download and link-shortener sites) by directly injecting native JavaScript stubs (spoofing `window.ga`, `document.offsetHeight`, etc.) to trick the site into thinking ads successfully rendered.
- 🧹 **Aggressive Whitespace Collapse:** Uses proactive `MutationObservers` to hunt down and completely collapse floating video players, sticky widgets, and the gaping white spaces left behind by deleted ads.
- 🚫 **Popup Neutralizer:** Natively intercepts `window.open` mechanisms to block malicious pop-unders and deceptive new-tab spawns.
- 📺 **Manual Picture-in-Picture:** Native built-in toggle to instantly pop out your YouTube videos into floating PiP windows.

## 🛠️ Installation
1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/joealjohn/Ad-GHOST.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click on the **Load unpacked** button.
5. Select the `extension` folder from this downloaded repository.
6. Pin **GHOST** to your toolbar and enjoy a unified, ad-free web!

## ⚙️ How it Works
Unlike traditional ad blockers that inject thousands of heavy CSS rules slowing down your browser, GHOST prioritizes **stealth**:
*   Instead of blindly hiding ad-blocker honeypots, GHOST overrides `getComputedStyle` and `clientHeight` to lie to trackers, feeding them artificially generated dimensions so they unlock the site's content.
*   YouTube logic is heavily refined to outmaneuver Google's anti-adblock TOS scripts by manipulating the player's internal state machine directly.

## 🖌️ Aesthetics
Includes a sleek, dark-mode native Glassmorphic popup UI giving you instant access to pause enforcement on specific domains and toggle YouTube Picture-in-Picture.

---
<div align="center">
  <i>Developed for a seamless, private, and unstoppable browsing experience.</i>
</div>
