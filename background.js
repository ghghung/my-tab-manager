try {
    importScripts('db.js');
} catch (e) {
    console.warn('Chưa cấu hình db.js hoặc Dexie, chức năng chụp ảnh có thể không hoạt động.');
}

// --- CÁC BIẾN TOÀN CỤC ---
let captureInterval = null;
let activeTabId = null;

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
        if (chrome.runtime.lastError || !tab || !tab.url) return;
        
        const managerUrl = chrome.runtime.getURL('manager.html');
        // So sánh tương đối để hỗ trợ nhiều trường hợp
        const isManager = tab.url.includes('manager.html') && tab.url.includes(chrome.runtime.id);
        
        const action = isManager ? 'hideHomeButton' : 'showHomeButton';
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

// --- LOGIC CHỤP ẢNH XEM TRƯỚC (SCREENSHOT) ---

function startCaptureInterval(tabId) {
    stopCaptureInterval();
    activeTabId = tabId;
    
    // Kiểm tra nếu db chưa sẵn sàng thì bỏ qua
    if (typeof db === 'undefined') return;

    const capture = async () => {
        try {
            // Chỉ chụp khi tab đang active và cửa sổ đang focus
            const tab = await chrome.tabs.get(tabId);
            if (tab.active) {
                const imageDataUrl = await chrome.tabs.captureVisibleTab(null, {
                    format: 'jpeg',
                    quality: 50
                });
                await db.screenshots.put({ tabId: tabId, imageData: imageDataUrl });
            }
        } catch (error) {
            // Lỗi thường gặp: tab đóng, trang bị hạn chế (chrome://)...
            stopCaptureInterval();
        }
    };

    // Chụp ngay lần đầu
    capture();
    // Lặp lại mỗi 10s
    captureInterval = setInterval(capture, 10000);
}

function stopCaptureInterval() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    activeTabId = null;
}

// --- ĐĂNG KÝ CÁC EVENT LISTENER ---

// 1. Click icon tiện ích
chrome.action.onClicked.addListener(openOrFocusManagerTab);

// 2. Chuyển tab (Activated)
chrome.tabs.onActivated.addListener((activeInfo) => {
    checkTabAndToggleButton(activeInfo.tabId);
    updateRecentTabs(activeInfo.tabId);
    startCaptureInterval(activeInfo.tabId);
});

// 3. Cập nhật tab (Updated - ví dụ load xong trang)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        checkTabAndToggleButton(tabId);
    }
});

// 4. Chuyển cửa sổ (Focus Changed)
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        stopCaptureInterval();
    } else {
        chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
            if (tabs.length > 0) startCaptureInterval(tabs[0].id);
        });
    }
});

// 5. LẮNG NGHE TIN NHẮN (MESSAGE HUB)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === 'openManager') {
        openOrFocusManagerTab();
        return;
    }
    
    // A. Điều hướng cơ bản
    if (request.action === 'goHome') {
        openOrFocusManagerTab();
        return;
    }

    if (request.action === 'switchToTab') {
        if (request.tabId) {
            // 1. Chuyển đến tab đang mở (Switch)
            chrome.tabs.update(request.tabId, { active: true });
            chrome.windows.update(request.windowId, { focused: true });
        } else if (request.url) {
            // 2. Mở URL mới (Open new & Focus)
            // Dùng cái này thay cho window.open để đảm bảo focus đúng
            chrome.tabs.create({ url: request.url, active: true });
        } else {
            // 3. Mở tab trống (Default)
            chrome.tabs.create({ active: true });
        }
        return;
    }

    // B. Lấy danh sách tab gần đây (cho Radial Menu)
    if (request.action === 'getRecentTabs') {
        const getAllOpenTabsSorted = async () => {
            // 1. Lấy lịch sử truy cập gần đây từ bộ nhớ
            const sessionData = await chrome.storage.session.get(['recentTabIds']);
            const recentIds = sessionData.recentTabIds || [];

            // 2. Lấy toàn bộ tab đang mở
            const allTabs = await chrome.tabs.query({});
            
            // 3. Tạo Map để tìm tab theo ID cho nhanh
            const tabsMap = new Map();
            allTabs.forEach(tab => tabsMap.set(tab.id, tab));

            const finalSortedTabs = [];
            const addedTabIds = new Set(); // Để tránh trùng lặp

            // --- BƯỚC SẮP XẾP ---
            
            // A. Ưu tiên đưa các tab trong danh sách "Gần đây" vào trước
            for (const tabId of recentIds) {
                if (tabsMap.has(tabId)) {
                    finalSortedTabs.push(tabsMap.get(tabId));
                    addedTabIds.add(tabId);
                }
            }

            // B. Đưa các tab còn lại (chưa bao giờ click vào hoặc bị trôi khỏi lịch sử) vào sau
            allTabs.forEach(tab => {
                if (!addedTabIds.has(tab.id)) {
                    finalSortedTabs.push(tab);
                }
            });

            // --------------------

            // 4. Xử lý dữ liệu đầu ra (Icon, Title...) như cũ
            const processedTabs = [];
            
            for (const tab of finalSortedTabs) {
                if (!tab.url) continue;

                let finalIconUrl = null;

                // Logic Icon thông minh
                if (tab.url.startsWith('http')) {
                    try {
                        const url = new URL(tab.url);
                        if (url.hostname.includes('google.com')) {
                            finalIconUrl = tab.favIconUrl;
                        } else {
                            finalIconUrl = `https://s2.googleusercontent.com/s2/favicons?domain=${url.hostname}&sz=64`;
                        }
                    } catch (e) { }
                }

                processedTabs.push({
                    id: tab.id,
                    windowId: tab.windowId,
                    favIconUrl: finalIconUrl,
                    title: tab.title,
                    url: tab.url,
                    active: tab.active
                });
            }
            
            sendResponse(processedTabs);
        };
        
        getAllOpenTabsSorted();
        return true; 
    }

    // C. Lấy ảnh chụp màn hình (cho Preview)
    if (request.action === 'getTabScreenshot') {
        if (typeof db !== 'undefined') {
            db.screenshots.get(request.tabId).then(result => {
                sendResponse(result ? result.imageData : null);
            }).catch(() => sendResponse(null));
        } else {
            sendResponse(null);
        }
        return true;
    }

    // D. Lấy dữ liệu Shortcut (cho Spotlight Content Script)
    if (request.action === 'getSpotlightData') {
        const getAsyncData = async () => {
            const storageData = await chrome.storage.local.get(['shortcuts', 'dockShortcuts', 'collections']);
            const openTabs = await chrome.tabs.query({}); // Lấy tất cả tab đang mở
            
            const internalResults = [];

            // 1. Open Tabs (Ưu tiên số 1)
            openTabs.forEach(tab => {
                internalResults.push({
                    name: tab.title,
                    url: tab.url,
                    favIconUrl: tab.favIconUrl,
                    id: tab.id,       // Cần ID để switch tab
                    windowId: tab.windowId,
                    type: 'Open Tab', // Loại mới
                    source: 'internal_tab' // Đánh dấu nguồn riêng
                });
            });
            
            // 2. Desktop Shortcuts
            if (storageData.shortcuts) {
                storageData.shortcuts.forEach(s => internalResults.push({ ...s, type: 'App', source: 'internal_storage' }));
            }
            // 3. Dock Shortcuts
            if (storageData.dockShortcuts) {
                storageData.dockShortcuts.forEach(s => {
                    if (!internalResults.some(r => r.url === s.url && r.source === 'internal_storage')) {
                        internalResults.push({ ...s, type: 'Dock', source: 'internal_storage' });
                    }
                });
            }
            // 4. Saved Collections
            if (storageData.collections) {
                storageData.collections.forEach(col => {
                    if (col.sections) {
                        col.sections.forEach(sec => {
                            if (sec.cards) {
                                sec.cards.forEach(card => {
                                    internalResults.push({ 
                                        name: card.title, 
                                        url: card.url, 
                                        favIconUrl: card.favIconUrl,
                                        type: 'Saved', 
                                        source: 'internal_storage' 
                                    });
                                });
                            }
                        });
                    }
                });
            }
            
            sendResponse(internalResults);
        };

        getAsyncData();
        return true; // Báo hiệu bất đồng bộ
    }

    // E. Lấy gợi ý Google (Proxy để tránh CORS)
    if (request.action === 'getGoogleSuggestions') {
        const query = request.query;
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => sendResponse(data))
            .catch(error => sendResponse(null));
            
        return true;
    }
});