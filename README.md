<div align="center">
  <img src="extension/icons/icon128.png" alt="AdGuard Logo" width="120" />
  <h1>AdGuard Pro</h1>
  <p><strong>The ultimate, undetectable Chrome extension designed specifically to bypass modern anti-adblock restrictions with zero player crashes.</strong></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square&logo=googlechrome" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-green?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Manifest-V3-orange?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/License-MIT-red?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/Status-100%25%20Crash--Proof-success?style=flat-square" alt="Status" />
  </p>
</div>

---

## ✨ Key Features

### 👻 Ghost Mode (Ultra-Stable YouTube Bypass)
Unlike legacy adblockers that recklessly intercept backend API requests or mutate playtime timestamps (which YouTube actively detects and punishes with permanent black screens), Ghost Mode uses **Native Timeline Fast-Forwarding**. 
- The exact millisecond an unskippable video ad appears, the extension enforces a `16.0x` native playback rate.
- The ad plays out naturally at blinding speed while completely muted, finishing a 15-second ad in under `0.9` seconds.
- Because the ad officially "completes" according to the browser's native event listeners, YouTube's state machine transitions flawlessly back to your main video. **Zero buffering freezes. Zero black screens.**

### 🗡️ Deep Cosmetic Sweeps
A lightweight, global CSS injector is initialized at `document_start`, wiping out structural UI ads before the DOM even begins rendering on your screen.
- Scans `ytd-rich-item-renderer` and sidebar recommendation grids.
- Actively hunts for the legally mandated *Sponsored* tags (`.badge-style-type-ad`) to destroy promoted products and "Sparkles" tiles instantly.

### 🛑 Network-Level Engine
Powered by Manifest V3's lightning-fast `declarativeNetRequest` API, the core engine blocks over 3,000 known tracking domains, analytics beacons, and third-party advertising hosts directly at the browser's networking layer, preventing them from ever utilizing your bandwidth.

### 📱 Premium Popup UI
A beautiful, glassmorphic Control Center built with vanilla HTML/CSS. Features dynamic particle animations, real-time statistics of trackers destroyed, and an instant global kill-switch.

---

## 🛠️ Architecture

* **`manifest.json`** — Manifest V3 compliant base utilizing `declarativeNetRequest` for optimal performance.
* **`rules.json`** — 3000+ domain-accurate networking filters.
* **`youtube.js`** — The pure DOM-scrubbing script injected specifically for modern YouTube player configurations.
* **`cosmetic.js`** — Removes empty ad-spaces and popups gracefully across the remainder of the web.

## 🚀 Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle the **Developer mode** switch in the top right corner.
4. Click **Load unpacked** and select the `/extension` directory.
5. Pin the extension to your toolbar and enjoy a flawless viewing experience.
