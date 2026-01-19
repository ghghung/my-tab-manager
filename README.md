# My Tab Manager 🚀

A powerful and customizable Chrome Extension that replaces your default New Tab page. It helps you manage open tabs, save shortcuts, and organize your workspace with a beautiful, modern interface inspired by macOS.

## ✨ Key Features

*   **Dual Interface Modes:**
    *   **Simple Mode:** A clean, grid-based layout focused on productivity.
    *   **Modern Mode (macOS Style):** A stunning interface featuring a desktop area and a dynamic Dock with magnification effects.
*   **Virtual Home Button:** A floating button accessible on any webpage.
    *   **Radial Menu:** Right-click to access your 10 most recent tabs in a circular menu.
    *   **Tab Preview:** Hover over bubbles in the radial menu to see a live screenshot preview of the tab.
*   **Smart Drag & Drop:**
    *   Drag tabs from the "Open Tabs" panel directly to your Desktop or Dock to save them.
    *   Reorder shortcuts easily.
*   **Cloud Sync:** Sync your collections and shortcuts across multiple computers using your own Google Drive (via Google Apps Script).
*   **Customization:**
    *   Change wallpapers (supports large images).
    *   Dark/Light mode.
    *   Customizable Home Title (fonts, colors, styles).
*   **Smart Icons:** Automatically fetches high-quality icons for websites, with special handling for Google Apps (Docs, Sheets, Drive) and Localhost addresses.

## 🛠️ Installation (Developer Mode)

Since this extension is not yet on the Chrome Web Store, you need to install it manually:

1.  **Download** this repository (Clone or Download ZIP and extract it).
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the folder containing the extracted files.
6.  Open a new tab to see it in action!

## ☁️ How to Set Up Cloud Sync

To sync your data across devices without a third-party server, we use a free **Google Apps Script** linked to your Google Drive.

### Step 1: Create the Backend Script
1.  Go to [script.google.com](https://script.google.com/) and click **"New Project"**.
2.  Open the file **`code gg script.txt`** included in this repository.
3.  Copy the entire content of `code gg script.txt`.
4.  Paste it into the script editor on Google Apps Script (replace any existing code).
5.  Save the project (Name it "Tab Manager Sync").

### Step 2: Deploy the Web App
1.  Click the blue **Deploy** button (top right) -> **New deployment**.
2.  Click the gear icon next to "Select type" and choose **Web app**.
3.  Configure the settings exactly as follows:
    *   **Description:** `v1` (or anything you like).
    *   **Execute as:** `Me` (your email).
    *   **Who has access:** `Anyone` (Crucial for the extension to access the script).
    *   *Note: This is safe because the script only modifies one specific JSON file in your Drive, and only people with the URL can access it.*
4.  Click **Deploy**.
5.  Grant the necessary permissions when prompted (Advanced -> Go to ... unsafe).
6.  **Copy the Web App URL** (starts with `https://script.google.com/...`).

### Step 3: Connect the Extension
1.  Open a new tab (My Tab Manager).
2.  Click the **Cloud Icon (☁)** in the bottom left corner.
3.  Paste your Web App URL into the input field.
4.  Click **Save & Auto-Sync**.

Your data will now automatically sync to a file named `my-tab-manager-data.json` in your Google Drive!

## 🖱️ Usage Tips

*   **Switching Interfaces:** Click the icon (❀) in the bottom-left footer to toggle between Simple and macOS Modern mode.
*   **Quick Open:**
    *   **Middle Click** on any shortcut to open it in a new background tab.
    *   **Right Click** to access options like "Open in new App" (Popup window), Rename, or Delete.
*   **Virtual Home Button:**
    *   **Left Click:** Go to Tab Manager.
    *   **Right Click:** Open Radial Menu (Recent Tabs).
    *   **Drag:** Move the button anywhere on the screen.

## 📝 License

This project is for personal use and educational purposes. Feel free to fork and customize it!
