Here is a comprehensive `README.md` file written in English, tailored to your specific features and instructions.

***

# 🚀 My Tab Manager

**My Tab Manager** is a powerful, aesthetic, and highly customizable browser extension designed to replace your "New Tab" page. It combines the utility of a bookmark manager, the speed of a spotlight search, and the beauty of a modern operating system interface.

<img width="2017" height="1054" alt="Screenshot 2026-01-22 161919" src="https://github.com/user-attachments/assets/b132d920-c9ad-4703-a846-1fad65508261" />


## ✨ Key Features

### 1. Dual Interface Modes
Switch instantly between two distinct visual styles based on your preference:

*   **Simple Mode:** A clean, grid-based layout focused on efficiency. Perfect for users who want quick access to collections and shortcuts without distractions.
*   **Modern Mode (macOS Style):** A stunning interface inspired by macOS.
    *   **Desktop Area:** Pin your favorite shortcuts anywhere.
    *   **The Dock:** A beautiful, animated bottom bar with a magnification effect for your most-used apps.
    *   **Custom Wallpapers:** Upload high-resolution images from your computer to personalize your background (supports large files via IndexedDB).
    *   **Glassmorphism:** Elegant blur and transparency effects throughout the UI.

### 2. 🔍 Universal Spotlight Search
Access your tabs and links from **anywhere**, not just the new tab page.

*   **Smart Activation:** Trigger Spotlight by **Double-tapping Space** or **Double-clicking** on an empty area of any webpage.
*   **Adaptive UI:** When opened, the bar shows customizable **Quick Action Buttons** (with custom Emojis and Links). Start typing, and it expands to a full search bar.
*   **Universal Search:** Simultaneously searches through:
    *   Currently **Open Tabs** (prioritized at the top).
    *   Saved **Shortcuts** and **Collections**.
    *   **Google Search** suggestions.
*   **Recent Tabs:** When empty, it displays a "Focus" style list of your recently active tabs for quick switching.

### 3. drag-and-drop Organization
Managing links has never been this intuitive.
*   **Drag & Drop:** Move tabs from the "Open Tabs" list directly onto your Desktop, Dock, or into specific Collections.
*   **Smart Sorting:** Reorder icons on your Desktop or Dock naturally.
*   **Context Menu:** Right-click any icon to Open in New Tab, Open in App Mode (Popup), Rename, or Delete.

<img width="1929" height="1113" alt="Screenshot 2026-01-19 211635" src="https://github.com/user-attachments/assets/5e03ab7f-92e0-40ef-95a0-6dcd3d4ca465" />


### 4. Virtual Home Button
A floating button that sits unobtrusively on your screen.
*   **Quick Menu:** Right-click to reveal a radial menu of your recent tabs.
*   **Tab Preview:** Hover over the radial menu bubbles to see a real-time **screenshot preview** of that tab.

---

## ☁️ Cloud Sync & Backup Guide

My Tab Manager offers a unique, serverless sync solution using **Google Drive**. This allows you to sync your layout, links, and settings across multiple computers without creating a 3rd party account.

**You need to set up a Google Apps Script to act as your personal cloud backend.**

### Step 1: Create the Google Script
1.  Go to [script.google.com]
2.  Click **"New Project"**.
3.  Open the file named **`code gg script.txt`** included in this extension's folder.
4.  Copy the entire content of that text file.
5.  Paste it into the script editor (replace any existing code).
6.  Name the project (e.g., "Tab Manager Sync").

### Step 2: Deploy the Web App
1.  Click the blue **Deploy** button (top right) > **New deployment**.
2.  Click the gear icon next to "Select type" and choose **Web app**.
3.  Configure the settings exactly as follows:
    *   **Description:** `v1` (or anything you like).
    *   **Execute as:** `Me` (your email).
    *   **Who has access:** `Anyone` (This is required for the extension to reach the script, but only people with the exact link can access your data).
4.  Click **Deploy**.
5.  Authorize the app (Click "Review permissions" -> Choose account -> Advanced -> Go to ... (unsafe) -> Allow).

### Step 3: Connect the Extension
1.  Copy the **Web App URL** provided by Google (starts with `https://script.google.com/...`).
2.  Open **My Tab Manager**.
3.  Click the **Cloud Icon (☁)** in the sidebar footer.
4.  Paste the URL into the input field.
5.  Click **Save & Auto-Sync**.

Your data (Collections, Shortcuts, Settings) will now automatically sync to a file named `my-tab-manager-data.json` in your Google Drive!
<img width="2015" height="1142" alt="Screenshot 2026-01-22 162012" src="https://github.com/user-attachments/assets/9fbe1379-2a78-4868-9bad-ce6de9fd7bf0" />

---

## 📦 Installation (Developer Mode)

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the folder containing this extension.

## 🛠 Technologies
*   HTML5 / CSS3 (CSS Grid, Flexbox, Glassmorphism)
*   Vanilla JavaScript (ES6+)
*   Dexie.js (IndexedDB wrapper for handling large wallpapers/screenshots)
*   Chrome Extension API (Manifest V3)

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgments & Third-Party Libraries

This extension uses the following open-source libraries:

*   **Dexie.js** - A Minimalistic Wrapper for IndexedDB. Licensed under the Apache-2.0 License.
*   **Google Fonts** - Used for interface typography.

---

