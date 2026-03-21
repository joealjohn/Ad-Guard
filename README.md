<div align="center">
  <img src="extension/icons/icon128.png" alt="AdGuard Logo" width="128"/>

  # AdGuard 🛡️
  
  **The Ultimate Ghost-Mode Ad Blocker for Manifest V3**
  
  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-success?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
  [![Security](https://img.shields.io/badge/Security-Audited-brightgreen?style=flat-square)](SECURITY_AUDIT.md)

  *Untraceable YouTube Ad Sniping • ⚡ Nano-Second Network Filters • 🌓 Holographic Dual-Theme UI*
</div>

---

## 🚀 Overview

AdGuard represents the absolute pinnacle of modern Chrome Extension development. Forced by Google's aggressive deprecation of standard ad-blockers (Manifest V2), this extension was built entirely from scratch to natively weaponize Chrome's new `DeclarativeNetRequest` engine. 

Instead of hogging massive amounts of RAM parsing millions of text strings like legacy blockers, AdGuard intercepts tracking arrays and synthetic ad payloads **instantly at the OS level**, guaranteeing lighting-fast performance with zero external tracking dependencies.

---

## 🔥 Enterprise-Grade Features

### 🎯 Untraceable YouTube Sniper
YouTube employs highly aggressive, multi-layered honeypots designed to permanently ban accounts running legacy ad blockers. AdGuard bypasses this entirely:
* Operates in complete **MAIN World Isolation**.
* Actively scrubs native JSON tracking payloads before the UI even renders.
* Mutes and fast-forwards heavily encrypted inline `blob` ads in 150 milliseconds natively.

### 🛡️ DeclarativeNetRequest Firewall
A surgical 300+ signature dynamic network ruleset that actively blocks tracking CDNs (Sentry, Bugsnag) and synthetic ad payloads directly at the browser's native network-stack layer.

### 🌓 Holographic Dual-Theme UI
A beautifully engineered floating-pill popup menu built entirely with raw Bootstrap SVGs. Perfect native synchronization with Chrome's local storage engine, supporting instant Dark/Light mode flipping.

### 🚦 Surgical Site Control
The aggressive "Pause on this site" engine allows you to seamlessly whitelist strict origins on-the-fly via dynamic `allowAllRequests` native overrides, immediately defeating extreme honeypot detectors like `oii.la` and Synthetic bypass testers.

---

## ⚙️ Installation Instructions (Developer Mode)

Because this extension operates using highly aggressive DOM isolation frameworks, it is currently built to be loaded locally via Developer Mode.

1. **Clone this repository** to your local machine:
   ```bash
   git clone https://github.com/joealjohn/Ad-Guard.git
   ```
2. Open Google Chrome (or Edge/Brave) and navigate to `chrome://extensions/`.
3. Toggle on **Developer Mode** in the absolute top-right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `extension` folder located inside your cloned directory.
6. **Done!** Pin the AdGuard shield to your toolbar and watch it instantly disintegrate ads.

---

## 🔐 Security & Payload Auditing

This extension utilizes a **Zero-Dependency Architecture**. There are absolutely no remote scripts, unsanitized payload paths, or tracking cookies. 

For a complete breakdown of our XSS mitigation strategies, please review the comprehensive [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

<div align="center">
    <i>Engineered for unparalleled browsing speed.</i>
</div>
