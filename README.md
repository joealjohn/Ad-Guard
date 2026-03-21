# AdGuard - Manifest V3 Chrome Extension

AdGuard is a highly optimized, completely local, and fully declarative ad-blocking Chrome Extension built exclusively on Google's strict Manifest V3 architecture. 

It bypasses traditional ad blockers' massive RAM consumption by executing native interception exclusively at the Network and DOM layers, ensuring lightning-fast browsing speeds with zero external tracking dependencies.

## Core Features
*   **DeclarativeNetRequest Firewall:** A highly-optimized, 300+ signature dynamic network ruleset that actively blocks tracking CDNs, telemetry arrays, and synthetic ad payloads instantly at the OS level.
*   **Untraceable YouTube Sniper:** A surgical, DOM-level interceptor that continuously scrubs native YouTube JSON payloads and fast-forwards inline ads before they render, entirely circumventing YouTube's aggressive anti-adblock honeypots (MAIN world isolation).
*   **Holographic Dual-Theme UI:** A beautifully engineered floating-pill popup menu built with raw SVGs, perfectly synchronized with your local Chrome storage and fully dark/light mode adaptable.
*   **Surgical Site Control:** The active "Pause on this site" engine allows you to seamlessly whitelist strict websites on-the-fly via dynamic `allowAllRequests` native overrides.
*   **Zero-Dependency Architecture:** Bulletproof local isolation. Absolutely no remote scripts, unsanitized payload paths, or tracking cookies.

## Installation for Developers
1. Clone the repository.
2. Navigate to `chrome://extensions/` in Google Chrome, Edge, or Brave.
3. Toggle on **Developer Mode** in the top right corner.
4. Click **Load Unpacked** and select the strictly isolated `/extension/` directory.

## Security 
Review the [SECURITY\_AUDIT.md](SECURITY_AUDIT.md) for a comprehensive breakdown of the application's XSS mitigation strategies and MV3 isolation boundaries.
