(() => {
    // 1. TẠO HTML (Thêm div #ext-spotlight-recent)
    const overlay = document.createElement('div');
    overlay.id = 'ext-spotlight-overlay';
    overlay.innerHTML = `
        <div id="ext-spotlight-bar">
            <input type="text" id="ext-spotlight-input" placeholder="Spotlight Search" autocomplete="off">
        </div>
        <!-- Hộp chứa Tab gần đây -->
        <div id="ext-spotlight-recent"></div>
        <!-- Hộp chứa Kết quả tìm kiếm -->
        <div id="ext-spotlight-results"></div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('ext-spotlight-input');
    const resultsContainer = document.getElementById('ext-spotlight-results');
    const recentContainer = document.getElementById('ext-spotlight-recent'); // MỚI
    recentContainer.addEventListener('mouseleave', () => {
        // 1. Tìm tất cả item đang có class 'selected' và xóa nó đi
        const items = recentContainer.querySelectorAll('.ext-recent-item');
        items.forEach(el => el.classList.remove('selected'));
        
        // 2. Reset index về -1 (nghĩa là không chọn cái nào)
        // Để khi nhấn mũi tên xuống sẽ bắt đầu lại từ đầu
        selectedIndex = -1; 
    });
    const searchBar = document.getElementById('ext-spotlight-bar');

    let spotlightData = [];
    let recentTabsData = []; // Dữ liệu tab gần đây
    let selectedIndex = 0;
    let debounceTimeout = null;
    let lastSpacePressTime = 0;
    let isShowingRecent = false; // Trạng thái đang hiện Recent hay Result

    // Hàm lấy icon thông minh (Giữ nguyên)
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

    // --- LOGIC TAB GẦN ĐÂY ---
    const showRecentTabs = () => {
        chrome.runtime.sendMessage({ action: 'getRecentTabs' }, (tabs) => {
            if (tabs && tabs.length > 0) {
                
                recentTabsData = tabs; 

                renderRecentTabs();
            } else {
                recentContainer.style.display = 'none';
            }
        });
    };

    const renderRecentTabs = () => {
        recentContainer.innerHTML = '';
        if (recentTabsData.length === 0) return;

        recentContainer.style.display = 'block';
        resultsContainer.style.display = 'none'; // Ẩn kết quả tìm kiếm
        searchBar.classList.remove('has-results');
        isShowingRecent = true;
        selectedIndex = -1; // Reset chọn dòng đầu

        recentTabsData.forEach((tab, index) => {
            const div = document.createElement('div');
            div.className = 'ext-recent-item'; 
            
            // Icon
            const iconUrl = chrome.runtime.getURL('icons/icon16.png');
            // getRecentTabs trả về favIconUrl đã xử lý (hoặc fallbackIconUrl trong logic cũ)
            // Ta dùng lại logic getSmartIconUrl để chắc chắn
            const smartIcon = getSmartIconUrl(tab.url, tab.favIconUrl);
            const iconHtml = `<img src="${smartIcon}" onerror="this.src='${iconUrl}'">`;

            div.innerHTML = `
                <div class="ext-recent-icon">${iconHtml}</div>
                <div class="ext-recent-text">${tab.title || 'Untitled'}</div>
            `;

            div.addEventListener('mouseenter', () => {
                document.querySelectorAll('.ext-recent-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedIndex = index;
            });

            div.addEventListener('click', () => {
                // Chuyển tab
                chrome.runtime.sendMessage({ 
                    action: 'switchToTab', 
                    tabId: tab.id, 
                    windowId: tab.windowId 
                });
                toggleSpotlight();
            });

            recentContainer.appendChild(div);
        });
    };

    // -------------------------

    const toggleSpotlight = () => {
        if (overlay.style.display === 'none' || overlay.style.display === '') {
            overlay.style.display = 'flex';
            input.value = '';
            
            // MẶC ĐỊNH KHI MỞ: Hiện Recent Tabs
            showRecentTabs();
            
            input.focus();
        } else {
            overlay.style.display = 'none';
        }
    };

    // EVENTS (Giữ nguyên logic kích hoạt)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
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
        if (e.key === 'Escape' && overlay.style.display === 'flex') {
            toggleSpotlight();
        }
    });

    document.addEventListener('dblclick', (e) => {
        const target = e.target;

        // 1. CÁC LỚP BẢO VỆ CƠ BẢN (Giữ nguyên để đảm bảo an toàn logic)
        // Bỏ qua Input, Ảnh, Video, SVG...
        if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'IMG', 'VIDEO', 'CANVAS', 'SVG', 'PATH', 'RECT', 'CIRCLE', 'POLYGON'].includes(target.tagName) || target.isContentEditable) {
            return;
        }

        // Bỏ qua Link, Nút, và các thành phần ứng dụng (Google Sheets...)
        if (target.closest('a') || 
            target.closest('button') || 
            target.closest('[role="button"]') ||
            target.closest('[role="gridcell"]') || // Sheet
            target.closest('.waffle-grid-container')) { // Sheet class
            return;
        }

        // Bỏ qua khi đang bôi đen văn bản
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            return;
        }

        // 2. KIỂM TRA CON TRỎ CHUỘT (THAY ĐỔI QUAN TRỌNG)
        // Lấy kiểu con trỏ hiện tại tại vị trí click
        const computedStyle = window.getComputedStyle(target);
        const cursor = computedStyle.cursor;
        
        // --- LOGIC MỚI: CHỈ CHẤP NHẬN MŨI TÊN ---
        // 'default': Là hình mũi tên chuẩn.
        // 'auto': Thường là hình mũi tên khi ở vùng trống (nhưng biến thành chữ I khi vào văn bản).
        // Tuy nhiên, vì ta đã chặn các thẻ Input và Text ở trên, nên 'auto' ở đây an toàn.
        
        if (cursor !== 'default' && cursor !== 'auto') {
            // Nếu con trỏ là 'text' (chữ I), 'pointer' (bàn tay), 'cell' (dấu cộng)... 
            // hay BẤT CỨ CÁI GÌ KHÁC mũi tên -> Dừng lại ngay.
            return;
        }
        // ----------------------------------------

        toggleSpotlight();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggleSpotlight();
    });

    // LOGIC TÌM KIẾM (Cập nhật để ẩn Recent khi tìm)
    const performSearch = async (query) => {
        // NẾU Ô NHẬP TRỐNG -> Hiện lại Recent Tabs
        if (!query) {
            showRecentTabs();
            return;
        }

        // NẾU CÓ CHỮ -> Ẩn Recent, Hiện Result
        recentContainer.style.display = 'none';
        isShowingRecent = false;

        const lowerQuery = query.toLowerCase();
        let internalResults = [];

        const bgData = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'getSpotlightData' }, resolve);
        });

        // ... (Logic lọc dữ liệu bgData giữ nguyên) ...
        // (Tôi rút gọn đoạn này cho đỡ dài, logic filter y hệt code cũ)
        if (bgData) {
             const matchedTabs = bgData.filter(item => item.source === 'internal_tab' && ((item.name && item.name.toLowerCase().includes(lowerQuery)) || (item.url && item.url.toLowerCase().includes(lowerQuery))));
             const matchedStorage = bgData.filter(item => item.source === 'internal_storage' && ((item.name && item.name.toLowerCase().includes(lowerQuery)) || (item.url && item.url.toLowerCase().includes(lowerQuery)))).slice(0, 5);
             internalResults = [...matchedTabs, ...matchedStorage];
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

        spotlightData = [...internalResults, ...googleSuggestions];
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
        selectedIndex = 0;

        spotlightData.forEach((item, index) => {
            // ... (Logic render item, gạch ngang, icon giữ nguyên) ...
            // Copy logic render từ code cũ vào đây
            const isPrevInternal = index > 0 && (spotlightData[index - 1].source === 'internal_tab' || spotlightData[index - 1].source === 'internal_storage');
            if (index > 0 && item.source === 'external' && isPrevInternal) {
                const sep = document.createElement('div');
                sep.className = 'ext-spotlight-separator';
                resultsContainer.appendChild(sep);
            }

            const div = document.createElement('div');
            div.className = `ext-spotlight-item ${index === 0 ? 'selected' : ''}`;
            
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

            div.addEventListener('mouseenter', () => {
                document.querySelectorAll('.ext-spotlight-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedIndex = index;
            });

            div.addEventListener('click', () => {
                if (item.source === 'internal_tab') {
                    chrome.runtime.sendMessage({ 
                        action: 'switchToTab', 
                        tabId: item.id, 
                        windowId: item.windowId 
                    });
                } else {
                    // CŨ: chrome.runtime.sendMessage({ action: 'switchToTab', tabId: null }); window.open(...)
                    
                    // MỚI: Gửi URL về background để mở
                    chrome.runtime.sendMessage({ 
                        action: 'switchToTab', 
                        url: item.url 
                    }); 
                }
                toggleSpotlight();
            });

            resultsContainer.appendChild(div);
        });
    };

    // INPUT EVENT
    input.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        const q = input.value.trim();
        // NẾU RỖNG -> Hiện ngay Recent Tabs, không cần debounce
        if (q === '') {
            performSearch('');
        } else {
            debounceTimeout = setTimeout(() => performSearch(q), 150);
        }
    });

    // NAVIGATION EVENT
    input.addEventListener('keydown', (e) => {
        // Xác định danh sách đang hiển thị để điều hướng
        let currentListClass = isShowingRecent ? '.ext-recent-item' : '.ext-spotlight-item';
        let currentDataLength = isShowingRecent ? recentTabsData.length : spotlightData.length;

        if (currentDataLength === 0 && !isShowingRecent) {
            if(e.key === 'Enter') {
                const q = input.value.trim();
                if(q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
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
            
            if (isShowingRecent) {
                // --- SỬA ĐỔI 3: KIỂM TRA NẾU CHƯA CHỌN GÌ THÌ KHÔNG LÀM GÌ ---
                if (selectedIndex === -1) return; 
                // -----------------------------------------------------------

                const tab = recentTabsData[selectedIndex];
                chrome.runtime.sendMessage({ action: 'switchToTab', tabId: tab.id, windowId: tab.windowId });
            } else {
                // Xử lý Search Result
                const item = spotlightData[selectedIndex];
                if (item.source === 'internal_tab') {
                    chrome.runtime.sendMessage({ action: 'switchToTab', tabId: item.id, windowId: item.windowId });
                } else {
                    // MỚI: Gửi URL về background
                    chrome.runtime.sendMessage({ 
                        action: 'switchToTab', 
                        url: item.url 
                    });
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

})();