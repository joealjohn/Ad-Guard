<div align="center">
  <img src="extension/icons/icon128.png" alt="Ghost Logo" width="120" />
  <h1>Ghost Ad Blocker</h1>
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

### 👻 Ghost Mode (0.6s Ultra-Fast YouTube Bypass)
Unlike legacy adblockers that recklessly intercept backend API requests (which YouTube actively detects and punishes with permanent black screens), Ghost Mode uses **Precision Timeline Scrubbing**.
- The exact millisecond an unskippable video ad appears, the internal video timestamp is instantly warped to exactly `0.6` seconds before the ad ends, and then naturally accelerated at `16.0x` speed.
- This tight `0.6s` threshold forces the ad to legitimately "complete" according to the browser's native event listeners. YouTube's server-side validation (SSAI) accepts the completion and flawlessly loads your main video. **Zero buffering freezes. Zero black screens.**

### 🗡️ Deep Cosmetic Sweeps
A lightweight, global CSS injector wipes out structural UI ads before the DOM even begins rendering on your screen.
- Destroys `ytd-rich-item-renderer` and sidebar recommendation grids.
- Actively hunts for the legally mandated *Sponsored* tags (`.badge-style-type-ad`) to obliterate promoted products and tiles instantly.
- Global cosmetic fallbacks effectively defeat advanced testing benchmarks (like the eXtreme Adblocker Test).

### 🛑 Network-Level Engine
Powered by Manifest V3's lightning-fast `declarativeNetRequest` API, the core engine blocks thousands of known tracking domains, analytics beacons, and third-party advertising hosts directly at the browser's networking layer, neutralizing them before a single byte of formatting downloads.

### 📱 Premium Purple GUI
A beautiful, glassmorphic Control Center built with vanilla HTML/CSS featuring our dynamic `#4E4BB8` theme. Includes real-time connection status flags ("Enabled"/"Disabled") and a lightning-fast global kill-switch.

---

## 🛠️ Architecture

* **`manifest.json`** — Manifest V3 compliant base utilizing `declarativeNetRequest` for optimal performance.
* **`rules.json`** — Domain-accurate networking filters.
* **`youtube.js`** — The pure DOM-scrubbing script injected specifically to outsmart modern YouTube player configurations.
* **`cosmetic.js`** — Removes empty ad-spaces and popups gracefully across the remainder of the web.

## 🚀 Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle the **Developer mode** switch in the top right corner.
4. Click **Load unpacked** and select the `/extension` directory.
5. Pin the extension to your toolbar and enjoy a flawless viewing experience!
