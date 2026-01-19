importScripts('db.js');
// --- CÁC HÀM TÁI SỬ DỤNG ---

// Mở hoặc focus vào tab quản lý
function openOrFocusManagerTab() {
    const managerUrl = chrome.runtime.getURL('manager.html');
    chrome.tabs.query({ url: managerUrl }, (tabs) => {
        if (tabs.length > 0) {
            const tabId = tabs[0].id;
            chrome.tabs.update(tabId, { active: true });
            chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
            chrome.tabs.create({ url: managerUrl });
        }
    });
}

// Kiểm tra tab hiện tại để ẩn/hiện nút home
function checkTabAndToggleButton(tabId) {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab || !tab.url) {
            return;
        }
        const managerUrl = chrome.runtime.getURL('manager.html');
        const action = (tab.url === managerUrl) ? 'hideHomeButton' : 'showHomeButton';
        chrome.tabs.sendMessage(tabId, { action }).catch(err => {});
    });
}

// Cập nhật danh sách tab gần đây vào storage
async function updateRecentTabs(tabId) {
    const result = await chrome.storage.session.get(['recentTabIds']);
    let currentIds = result.recentTabIds || [];
    currentIds = currentIds.filter(id => id !== tabId);
    currentIds.unshift(tabId);
    if (currentIds.length > 15) {
        currentIds.length = 15;
    }
    await chrome.storage.session.set({ recentTabIds: currentIds });
}


// --- ĐĂNG KÝ CÁC EVENT LISTENER (ĐÃ KẾT HỢP) ---

// 1. Sự kiện click vào icon của tiện ích
chrome.action.onClicked.addListener(openOrFocusManagerTab);

// 2. Sự kiện khi người dùng chuyển tab (onActivated)
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Thực hiện cả hai tác vụ cần thiết
    checkTabAndToggleButton(activeInfo.tabId);
    updateRecentTabs(activeInfo.tabId);
});

// 3. Sự kiện khi một tab được cập nhật (onUpdated)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        checkTabAndToggleButton(tabId);
    }
});

// 4. Lắng nghe tất cả tin nhắn từ content script (onMessage)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Xử lý hành động 'goHome'
    if (request.action === 'goHome') {
        openOrFocusManagerTab();
        return; // Không cần phản hồi, kết thúc sớm
    }

    // Xử lý hành động 'switchToTab'
    if (request.action === 'switchToTab' && request.tabId) {
        chrome.tabs.update(request.tabId, { active: true });
        chrome.windows.update(request.windowId, { focused: true });
        return; // Không cần phản hồi
    }

    // Xử lý hành động 'getRecentTabs' (cần phản hồi bất đồng bộ)
    if (request.action === 'getRecentTabs') {
        const getTabsDetails = async () => {
            const result = await chrome.storage.session.get(['recentTabIds']);
            const recentTabIds = result.recentTabIds || [];
            const tabs = [];
            for (const tabId of recentTabIds) {
                try {
                    const tab = await chrome.tabs.get(tabId);
                    if (!tab || tab.url.startsWith('chrome-extension://')) continue;

                    let finalIconUrl = null; // Mặc định là null

                    // Chỉ xử lý icon cho các trang web http/https
                    if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
                        try {
                            const url = new URL(tab.url);
                            const hostname = url.hostname;

                            // --- BẮT ĐẦU PHẦN CẢI TIẾN ---

                            // KIỂM TRA NGOẠI LỆ: Nếu là tên miền của Google
                            if (hostname.includes('google.com')) {
                                // Ưu tiên 1: Lấy icon cụ thể từ Chrome, vì nó chính xác hơn cho các sản phẩm Google (Sheets, Docs, v.v.)
                                finalIconUrl = tab.favIconUrl;
                            } else {
                                // Mặc định cho tất cả các trang web khác: Dùng API Google để đảm bảo độ tin cậy
                                finalIconUrl = `https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=64`;
                            }

                            // --- KẾT THÚC PHẦN CẢI TIẾN ---

                        } catch (e) {
                            // Nếu URL không hợp lệ, finalIconUrl sẽ vẫn là null
                            console.warn('Không thể phân tích URL để lấy favicon:', tab.url);
                        }
                    }
                    // Đối với các tab hệ thống (chrome://), finalIconUrl sẽ vẫn là null, hiển thị emoji là đúng.

                    tabs.push({
                        id: tab.id,
                        windowId: tab.windowId,
                        favIconUrl: finalIconUrl
                    });

                } catch (e) { /* Bỏ qua nếu tab đã đóng */ }
            }
            sendResponse(tabs);
        };
        
        getTabsDetails();
        return true; // Quan trọng: Báo hiệu rằng sendResponse sẽ được gọi sau
    }
});