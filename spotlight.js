(() => {
    // Biến lưu cài đặt
    let settings = {
        enableExternal: true,
        enableDblClick: true,
        enableDblSpace: true,
        icon1: '⚝',
        link1: '',
        icon2: '❉',
        link2: 'https://www.google.com/search?udm=50',
        iconManager: '🦄'
    };

    // 1. LẤY CÀI ĐẶT TỪ STORAGE
    chrome.storage.local.get(['settings'], (result) => {
        if (result.settings && result.settings.spotlight) {
            settings = { ...settings, ...result.settings.spotlight };
        }
        
        // Nếu tắt chức năng thì không làm gì cả
        if (!settings.enableExternal) return;

        initSpotlight();
    });

    const initSpotlight = () => {
        const overlay = document.createElement('div');
        overlay.id = 'ext-spotlight-overlay';
        
        // SỬ DỤNG ICON TỪ SETTINGS (Template String)
        overlay.innerHTML = `
            <div id="ext-spotlight-wrapper">
                <div id="ext-spotlight-bar">
                    <input type="text" id="ext-spotlight-input" placeholder="Spotlight Search" autocomplete="off">
                </div>
                
                <div id="ext-spotlight-actions">
                    <div class="ext-action-btn" id="btn-custom-1" title="Quick Link 1">${settings.icon1}</div>
                    <div class="ext-action-btn" id="btn-custom-2" title="Quick Link 2">${settings.icon2}</div>
                    <div class="ext-action-btn" id="btn-manager" title="My Tab Manager">${settings.iconManager}</div>
                </div>
            </div>

            <div id="ext-spotlight-recent"></div>
            <div id="ext-spotlight-results"></div>
        `;
        document.body.appendChild(overlay);

        // DOM Elements
        const input = document.getElementById('ext-spotlight-input');
        const resultsContainer = document.getElementById('ext-spotlight-results');
        const recentContainer = document.getElementById('ext-spotlight-recent');
        const searchBar = document.getElementById('ext-spotlight-bar');
        const actionsContainer = document.getElementById('ext-spotlight-actions');
        
        // Buttons
        const btn1 = document.getElementById('btn-custom-1');
        const btn2 = document.getElementById('btn-custom-2');
        const btnManager = document.getElementById('btn-manager');

        // Variables
        let spotlightData = [];
        let recentTabsData = [];
        let selectedIndex = -1;
        let debounceTimeout = null;
        let lastSpacePressTime = 0;
        let isShowingRecent = false;

        // --- HÀM HỖ TRỢ ICON (Giữ nguyên) ---
        const getSmartIconUrl = (urlStr, savedFavIcon) => {
            try {
                const url = new URL(urlStr);
                const hostname = url.hostname;
                if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.endsWith('.local')) {
                    return savedFavIcon || `${url.origin}/favicon.ico`;
                }
                if (hostname.includes('google.com')) {
                    return savedFavIcon || `https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=64`;
                }
                return `https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=64`;
            } catch (e) { return ''; }
        };

        // --- LOGIC GIAO DIỆN BIẾN HÌNH ---
        const updateInterfaceState = (query) => {
            if (query && query.trim().length > 0) {
                // Có chữ -> Mở rộng thanh search, ẩn nút
                searchBar.classList.add('expanded');
                actionsContainer.classList.add('hidden');
                
                // Ẩn Recent, chuẩn bị hiện Result
                recentContainer.style.display = 'none';
                isShowingRecent = false;
            } else {
                // Trống -> Thu gọn thanh search, hiện nút
                searchBar.classList.remove('expanded');
                actionsContainer.classList.remove('hidden');
                
                // Ẩn Result, hiện Recent
                resultsContainer.style.display = 'none';
                searchBar.classList.remove('has-results');
                showRecentTabs();
            }
        };

        // --- SỰ KIỆN NÚT BẤM ---
        btn1.addEventListener('click', () => {
            if (settings.link1) {
                window.open(settings.link1, '_blank');
                toggleSpotlight();
            } else {
                alert('Please set Link 1 in My Tab Manager settings.');
            }
        });

        btn2.addEventListener('click', () => {
            if (settings.link2) {
                window.open(settings.link2, '_blank');
                toggleSpotlight();
            }
        });

        btnManager.addEventListener('click', () => {
            // Gửi tin nhắn về background để mở Manager
            chrome.runtime.sendMessage({ action: 'openManager' });
            toggleSpotlight();
        });

        // --- LOGIC RECENT TABS (Cập nhật xử lý sắp xếp như đã làm) ---
        const showRecentTabs = () => {
            chrome.runtime.sendMessage({ action: 'getRecentTabs' }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    recentTabsData = tabs; // Lấy tất cả
                    renderRecentTabs();
                } else {
                    recentContainer.style.display = 'none';
                }
            });
        };

        const createCloseButton = (tabId, parentElement) => {
            const btn = document.createElement('span');
            btn.className = 'ext-close-tab-btn';
            btn.innerHTML = '×'; // Dấu nhân
            btn.title = 'Close Tab';
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // QUAN TRỌNG: Ngăn chặn việc chuyển tab khi nhấn nút đóng
                
                // 1. Gửi lệnh đóng về background
                chrome.runtime.sendMessage({ action: 'closeTab', tabId: tabId });
                
                // 2. Xóa dòng này khỏi giao diện ngay lập tức
                parentElement.remove();
                
                // 3. Cập nhật lại dữ liệu trong mảng (để điều hướng phím không bị lỗi)
                // (Tùy chọn: Nếu muốn hoàn hảo thì cần filter lại mảng recentTabsData/spotlightData)
            });
            
            return btn;
        };

        const renderRecentTabs = () => {
            recentContainer.innerHTML = '';
            // Chỉ hiện Recent khi thanh search đang ở trạng thái thu gọn (trống)
            if (input.value.trim() !== '') return;

            if (recentTabsData.length === 0) return;

            recentContainer.style.display = 'block';
            isShowingRecent = true;
            selectedIndex = -1;

            recentTabsData.forEach((tab, index) => {
                const div = document.createElement('div');
                div.className = 'ext-recent-item';
                
                const iconUrl = chrome.runtime.getURL('icons/icon16.png');
                const smartIcon = getSmartIconUrl(tab.url, tab.favIconUrl);
                const iconHtml = `<img src="${smartIcon}" onerror="this.src='${iconUrl}'">`;

                div.innerHTML = `
                    <div class="ext-recent-icon">${iconHtml}</div>
                    <div class="ext-recent-text">${tab.title || 'Untitled'}</div>
                `;

                const closeBtn = createCloseButton(tab.id, div);
                div.appendChild(closeBtn);

                div.addEventListener('mouseenter', () => {
                    document.querySelectorAll('.ext-recent-item').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    selectedIndex = index;
                });

                div.addEventListener('click', () => {
                    chrome.runtime.sendMessage({ action: 'switchToTab', tabId: tab.id, windowId: tab.windowId });
                    toggleSpotlight();
                });

                recentContainer.appendChild(div);
            });
        };
        
        recentContainer.addEventListener('mouseleave', () => {
            document.querySelectorAll('.ext-recent-item').forEach(el => el.classList.remove('selected'));
            selectedIndex = -1;
        });

        // --- BẬT/TẮT SPOTLIGHT ---
        const toggleSpotlight = () => {
            if (overlay.style.display === 'none' || overlay.style.display === '') {
                overlay.style.display = 'flex';
                input.value = '';
                
                // Reset trạng thái giao diện về mặc định (ngắn + hiện nút)
                updateInterfaceState('');
                
                input.focus();
            } else {
                overlay.style.display = 'none';
            }
        };

        // --- SỰ KIỆN KÍCH HOẠT ---
        document.addEventListener('keydown', (e) => {
            // Double Space
            if (settings.enableDblSpace && e.code === 'Space') {
                const activeTag = document.activeElement.tagName;
                const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable;
                if (isInput && document.activeElement !== input) return;

                const now = Date.now();
                if (now - lastSpacePressTime < 300) {
                    e.preventDefault();
                    toggleSpotlight();
                    lastSpacePressTime = 0;
                } else {
                    lastSpacePressTime = now;
                }
            }
            // ESC
            if (e.key === 'Escape' && overlay.style.display === 'flex') {
                toggleSpotlight();
            }
        });

        // Double Click
        document.addEventListener('dblclick', (e) => {
            if (!settings.enableDblClick) return;

            const target = e.target;
            if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'IMG', 'VIDEO', 'CANVAS', 'SVG', 'PATH', 'RECT', 'CIRCLE', 'POLYGON'].includes(target.tagName) || target.isContentEditable) return;
            if (target.closest('a') || target.closest('button') || target.closest('[role="button"]') || target.closest('[role="gridcell"]') || target.closest('.waffle-grid-container')) return;
            
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) return;

            const computedStyle = window.getComputedStyle(target);
            const cursor = computedStyle.cursor;
            if (cursor !== 'default' && cursor !== 'auto') return;

            toggleSpotlight();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) toggleSpotlight();
        });

        // --- LOGIC SEARCH & RENDER KẾT QUẢ ---
        // (Copy lại phần performSearch và renderResults từ phiên bản trước)
        // Lưu ý: Thêm gọi updateInterfaceState(query) ở đầu performSearch
        
        const performSearch = async (query) => {
            // CẬP NHẬT GIAO DIỆN DỰA TRÊN INPUT
            updateInterfaceState(query);

            if (!query) return;

            const lowerQuery = query.toLowerCase();
            
            // ... (Phần lấy dữ liệu BG, Google Suggestions giữ nguyên như cũ) ...
            const bgData = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'getSpotlightData' }, resolve);
            });

            let matchedTabs = [];
            let matchedStorage = [];

            if (bgData) {
                 matchedTabs = bgData.filter(item => item.source === 'internal_tab' && ((item.name && item.name.toLowerCase().includes(lowerQuery)) || (item.url && item.url.toLowerCase().includes(lowerQuery))));
                 matchedStorage = bgData.filter(item => item.source === 'internal_storage' && ((item.name && item.name.toLowerCase().includes(lowerQuery)) || (item.url && item.url.toLowerCase().includes(lowerQuery)))).slice(0, 5);
            }

            let googleSuggestions = [];
            try {
                const data = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'getGoogleSuggestions', query: query }, resolve);
                });
                if (data && data[1]) {
                    data[1].forEach(sug => {
                        googleSuggestions.push({
                            name: sug,
                            url: `https://www.google.com/search?q=${encodeURIComponent(sug)}`,
                            type: 'Google',
                            source: 'external'
                        });
                    });
                }
            } catch (e) {}

            spotlightData = [...matchedTabs, ...matchedStorage, ...googleSuggestions];
            renderResults();
        };

        const renderResults = () => {
            resultsContainer.innerHTML = '';
            if (spotlightData.length === 0) {
                resultsContainer.style.display = 'none';
                searchBar.classList.remove('has-results');
                return;
            }

            resultsContainer.style.display = 'block';
            searchBar.classList.add('has-results');
            selectedIndex = -1;

            spotlightData.forEach((item, index) => {
                const isPrevInternal = index > 0 && (spotlightData[index - 1].source === 'internal_tab' || spotlightData[index - 1].source === 'internal_storage');
                if (index > 0 && item.source === 'external' && isPrevInternal) {
                    const sep = document.createElement('div');
                    sep.className = 'ext-spotlight-separator';
                    resultsContainer.appendChild(sep);
                }

                const div = document.createElement('div');
                div.className = 'ext-spotlight-item';
                
                let iconHtml = '';
                if (item.source === 'internal_tab' || item.source === 'internal_storage') {
                    const iconUrl = chrome.runtime.getURL('icons/icon16.png');
                    const smartIcon = getSmartIconUrl(item.url, item.favIconUrl);
                    iconHtml = `<img src="${smartIcon}" onerror="this.src='${iconUrl}'">`;
                }

                div.innerHTML = `
                    <div class="ext-spotlight-icon">${iconHtml}</div>
                    <div class="ext-spotlight-text">${item.name}</div>
                    <div class="ext-spotlight-type">${item.type}</div>
                `;

                if (item.source === 'internal_tab') {
                    const closeBtn = createCloseButton(item.id, div);
                    div.appendChild(closeBtn);
                }

                div.addEventListener('mouseenter', () => {
                    document.querySelectorAll('.ext-spotlight-item').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    selectedIndex = index;
                });

                div.addEventListener('click', () => {
                    if (item.source === 'internal_tab') {
                        chrome.runtime.sendMessage({ action: 'switchToTab', tabId: item.id, windowId: item.windowId });
                    } else {
                        chrome.runtime.sendMessage({ action: 'switchToTab', url: item.url }); 
                    }
                    toggleSpotlight();
                });

                resultsContainer.appendChild(div);
            });
        };

        // INPUT EVENT
        input.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            const q = input.value; // Giữ nguyên khoảng trắng nếu muốn
            
            // Cập nhật giao diện ngay lập tức khi gõ/xóa
            updateInterfaceState(q);

            if (q.trim() === '') {
                // Nếu rỗng, không search, chỉ update giao diện
                return;
            }
            debounceTimeout = setTimeout(() => performSearch(q.trim()), 150);
        });

        // NAVIGATION EVENT (Giữ nguyên)
        input.addEventListener('keydown', (e) => {
            let currentListClass = isShowingRecent ? '.ext-recent-item' : '.ext-spotlight-item';
            let currentDataLength = isShowingRecent ? recentTabsData.length : spotlightData.length;

            if (currentDataLength === 0 && !isShowingRecent) {
                if(e.key === 'Enter') {
                    const q = input.value.trim();
                    if(q) {
                        chrome.runtime.sendMessage({ action: 'switchToTab', url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
                    }
                    toggleSpotlight();
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % currentDataLength;
                updateSelection(currentListClass);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + currentDataLength) % currentDataLength;
                updateSelection(currentListClass);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex === -1) {
                     const q = input.value.trim();
                     if(q && !isShowingRecent) { // Chỉ search google khi đang ở chế độ search
                        chrome.runtime.sendMessage({ action: 'switchToTab', url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
                        toggleSpotlight();
                     }
                     return;
                }

                if (isShowingRecent) {
                    const tab = recentTabsData[selectedIndex];
                    chrome.runtime.sendMessage({ action: 'switchToTab', tabId: tab.id, windowId: tab.windowId });
                } else {
                    const item = spotlightData[selectedIndex];
                    if (item.source === 'internal_tab') {
                        chrome.runtime.sendMessage({ action: 'switchToTab', tabId: item.id, windowId: item.windowId });
                    } else {
                        chrome.runtime.sendMessage({ action: 'switchToTab', url: item.url });
                    }
                }
                toggleSpotlight();
            }
        });

        const updateSelection = (selector) => {
            const items = document.querySelectorAll(selector);
            items.forEach((el, i) => {
                if (i === selectedIndex) {
                    el.classList.add('selected');
                    el.scrollIntoView({ block: 'nearest' });
                } else {
                    el.classList.remove('selected');
                }
            });
        };
    };
})();