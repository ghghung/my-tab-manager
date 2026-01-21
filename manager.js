document.addEventListener('DOMContentLoaded', () => {
    // --- CHỨC NĂNG: CHỐNG MỞ TRÙNG NEW TAB (FIXED V3 - EDGE/BRAVE SUPPORT) ---
    const preventDuplicateManagerTab = () => {
        chrome.tabs.getCurrent((currentTab) => {
            if (!currentTab) return;

            chrome.tabs.query({ currentWindow: true }, (tabs) => {
                const extensionId = chrome.runtime.id;
                
                const existingTab = tabs.find(t => {
                    // 1. Không phải chính tab hiện tại
                    if (t.id === currentTab.id) return false;

                    // Lấy URL thực tế hoặc URL đang chờ tải
                    const url = (t.url || t.pendingUrl || "").toLowerCase();

                    // 2. Các điều kiện để coi là Tab Manager cũ:
                    // - Chứa ID tiện ích VÀ manager.html (Chuẩn Chrome)
                    const isStandardUrl = url.includes(extensionId) && url.includes("manager.html");
                    
                    // - HOẶC chứa "://newtab" (Edge, Brave, Cốc Cốc, hoặc Chrome lúc mới bật)
                    //   Lưu ý: Vì tiện ích này thay thế New Tab, nên mọi tab có url là "newtab"
                    //   đều được coi là giao diện của tiện ích này.
                    const isGenericNewTab = url.includes("://newtab");

                    return isStandardUrl || isGenericNewTab;
                });

                if (existingTab) {
                    // Chuyển hướng sang tab cũ
                    chrome.tabs.update(existingTab.id, { active: true });
                    // Đóng tab thừa
                    chrome.tabs.remove(currentTab.id);
                }
            });
        });
    };
    
    preventDuplicateManagerTab();
    // ------------------------------------------
    // --- KHỞI TẠO DATABASE (Thêm vào đầu file) ---
    // Khởi tạo DB trùng tên với cái trong db.js/background.js
    const db = new Dexie('TabScreenshotDB');
    
    // Nâng cấp lên version 2 để thêm bảng 'wallpaper'
    // Lưu ý: Phải khai báo lại cả bảng screenshots cũ
    db.version(2).stores({
        screenshots: 'tabId,imageData',
        wallpaper: 'id' // Bảng mới để lưu hình nền
    });
    // DOM Elements
    const homeBtn = document.getElementById('home-btn');
    const searchInput = document.getElementById('search-input');
    const homeContainer = document.getElementById('home-container');
    const collectionViewContainer = document.getElementById('collection-view-container');
    const webSearchForm = document.getElementById('web-search-form');
    const webSearchInput = document.getElementById('web-search-input');
    const webSearchSuggestionsContainer = document.getElementById('web-search-suggestions-container');
    const shortcutsGrid = document.getElementById('shortcuts-grid');
    const collectionsList = document.getElementById('collections-list');
    const addCollectionBtn = document.getElementById('add-collection-btn');
    const currentCollectionNameEl = document.getElementById('current-collection-name');
    const sectionsContainer = document.getElementById('sections-container');
    const openTabsList = document.getElementById('open-tabs-list');
    const refreshTabsBtn = document.getElementById('refresh-tabs-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file-input');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const homeTitle = document.getElementById('home-title');
    const titleEditor = document.getElementById('home-title-editor');
    const titleTextInput = document.getElementById('title-text-input');
    const titleFontSelect = document.getElementById('title-font-select');
    const titleSizeInput = document.getElementById('title-size-input');
    const titleBoldBtn = document.getElementById('title-bold-btn');
    const titleItalicBtn = document.getElementById('title-italic-btn');
    const titleColorDark = document.getElementById('title-color-dark');
    const titleColorLight = document.getElementById('title-color-light');
    const saveTitleBtn = document.getElementById('save-title-btn');
    const webSearchAiBtn = document.getElementById('web-search-ai-btn');
    const webSearchNormalBtn = document.getElementById('web-search-normal-btn');
    const vhbSettingsBtn = document.getElementById('vhb-settings-btn');
    const vhbSettingsModalOverlay = document.getElementById('vhb-settings-modal-overlay');
    const closeVhbModalBtn = document.getElementById('close-vhb-modal-btn');
    const vhbEnabledToggle = document.getElementById('vhb-enabled-toggle');
    const vhbEmojiInput = document.getElementById('vhb-emoji-input');
    const vhbSizeSlider = document.getElementById('vhb-size-slider');
    const vhbSizeValue = document.getElementById('vhb-size-value');
    const vhbOpacitySlider = document.getElementById('vhb-opacity-slider');
    const vhbOpacityValue = document.getElementById('vhb-opacity-value');
    const saveVhbSettingsBtn = document.getElementById('save-vhb-settings-btn');
    const headerSearchSuggestionsContainer = document.getElementById('header-search-suggestions-container');
    const localSearchInput = document.getElementById('local-search-input');
    const localSearchBtn = document.getElementById('local-search-btn');
    const ctxOpenNew = document.getElementById('ctx-open-new');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const spacesPanel = document.getElementById('spaces-panel');   
    const ctxOpenApp = document.getElementById('ctx-open-app');

    
    // App State
    let appData = { 
        collections: [], 
        shortcuts: [], // Dùng cho Desktop
        dockShortcuts: [], // Dùng cho Dock
        settings: { 
            theme: 'dark', 
            homeTitle: {}, 
            syncUrl: '', 
            currentInterface: 'simple', // 'simple' hoặc 'modern'
            sidebarCollapsed: false
        } 
    };
    const modernContainer = document.getElementById('modern-container');
    const desktopArea = document.getElementById('desktop-area');
        desktopArea.addEventListener('dblclick', (e) => {
            // Chỉ kích hoạt khi click vào chính vùng nền (desktopArea)
            // Nếu click vào icon (.desktop-icon) thì e.target sẽ là icon, lệnh này sẽ bỏ qua
            if (e.target === desktopArea) {
                toggleSpotlight();
            }
        });

    const macosDock = document.getElementById('macos-dock');
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    const wallpaperInput = document.getElementById('wallpaper-input');
    const contextMenu = document.getElementById('context-menu');
    const ctxRename = document.getElementById('ctx-rename');
    const ctxDelete = document.getElementById('ctx-delete');

    let contextTargetId = null; // ID của item đang được chuột phải
    let contextTargetType = null; // 'desktop' hoặc 'dock'
    
    let syncDebounceTimeout = null;
    let activeCollectionId = null;
    let viewMode = 'home';
    let draggedItem = null;
    let draggedCollectionId = null;
    let draggedSectionInfo = null;
    let debounceTimeout = null;
    let highlightedSuggestionIndex = -1;
    let originalUserQuery = '';
    

    // --- DATA HANDLING ---
    const saveData = (triggerSync = true) => {
        chrome.storage.local.set({
            collections: appData.collections,
            shortcuts: appData.shortcuts,
            dockShortcuts: appData.dockShortcuts,
            settings: appData.settings
        });

        // Auto-sync logic
        if (triggerSync && appData.settings && appData.settings.syncUrl) {
            clearTimeout(syncDebounceTimeout);
            // Đợi 2 giây sau khi người dùng ngừng thao tác mới đẩy lên Cloud
            syncDebounceTimeout = setTimeout(() => {
                pushDataToCloud();
            }, 2000);
        }
    };

    const loadData = () => new Promise(resolve => {
        chrome.storage.local.get(['collections', 'shortcuts', 'dockShortcuts', 'settings'], (result) => {
            appData.collections = result.collections || [];
            appData.shortcuts = result.shortcuts || [];
            appData.settings = result.settings || {};
            appData.dockShortcuts = result.dockShortcuts || []; 
            
            appData.settings = result.settings || {};

            const defaultSettings = {
                theme: 'dark',
                virtualHomeButton: {
                    enabled: true,
                    emoji: '✈️',
                    size: 60,
                    opacity: 0.5
                },

                homeTitle: {
                    text: 'Hello, how are you today?',
                    fontFamily: 'Moirai One',
                    fontSize: 48,
                    fontWeight: '300',
                    fontStyle: 'normal',
                    colorDark: '#cccccc',
                    colorLight: '#333333'
                }
            };
            appData.settings.homeTitle = { ...defaultSettings.homeTitle, ...(appData.settings.homeTitle || {}) };
            appData.settings = { ...defaultSettings, ...appData.settings };
            
            resolve();
        });
    });

    vhbSettingsBtn.addEventListener('click', () => {
        const vhbSettings = appData.settings.virtualHomeButton;
        vhbEnabledToggle.checked = vhbSettings.enabled;
        vhbEmojiInput.value = vhbSettings.emoji;
        vhbSizeSlider.value = vhbSettings.size;
        vhbSizeValue.textContent = `${vhbSettings.size}px`;
        vhbOpacitySlider.value = vhbSettings.opacity;
        vhbOpacityValue.textContent = `${Math.round(vhbSettings.opacity * 100)}%`;
        vhbSettingsModalOverlay.style.display = 'flex';
    });

    const closeVhbModal = () => vhbSettingsModalOverlay.style.display = 'none';
    closeVhbModalBtn.addEventListener('click', closeVhbModal);
    vhbSettingsModalOverlay.addEventListener('click', (e) => { if (e.target === vhbSettingsModalOverlay) closeVhbModal(); });
    vhbSizeSlider.addEventListener('input', () => vhbSizeValue.textContent = `${vhbSizeSlider.value}px`);
    vhbOpacitySlider.addEventListener('input', () => vhbOpacityValue.textContent = `${Math.round(vhbOpacitySlider.value * 100)}%`);

    saveVhbSettingsBtn.addEventListener('click', () => {
        appData.settings.virtualHomeButton = {
            enabled: vhbEnabledToggle.checked,
            emoji: vhbEmojiInput.value,
            size: parseInt(vhbSizeSlider.value, 10),
            opacity: parseFloat(vhbOpacitySlider.value)
        };
        saveData();
        closeVhbModal();
    });

    addCollectionBtn.addEventListener('click', () => {
        const n = prompt('Name for new Collection:');
        if (n) {
            const c = { id: generateId(), name: n, sections: [] };
            appData.collections.push(c);
            activeCollectionId = c.id;
            viewMode = 'collection';
            saveData();
            renderView();
        }
    });

    const addSectionBtn = document.getElementById('add-section-btn');
    addSectionBtn.addEventListener('click', () => {
        // Chỉ hoạt động khi đang ở trong một collection
        if (viewMode === 'collection' && activeCollectionId) {
            addSection(activeCollectionId);
        }
    });
    
    const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // --- HÀM HỖ TRỢ LẤY ICON THÔNG MINH (ĐÃ CẬP NHẬT LOCALHOST) ---
    const getSmartIconUrl = (urlStr, savedFavIcon) => {
        try {
            const url = new URL(urlStr);
            const hostname = url.hostname;

            // 1. KIỂM TRA LOCALHOST / IP NỘI BỘ
            // Google API không thể truy cập các địa chỉ này, nên phải dùng icon gốc
            if (hostname === 'localhost' || 
                hostname === '127.0.0.1' || 
                hostname.startsWith('192.168.') || 
                hostname.startsWith('10.') ||
                hostname.endsWith('.local')) {
                
                // Ưu tiên dùng icon đã lưu khi kéo tab vào. 
                // Nếu không có, thử đoán đường dẫn favicon mặc định của server đó.
                return savedFavIcon || `${url.origin}/favicon.ico`;
            }

            // 2. NGOẠI LỆ GOOGLE (Giữ nguyên)
            if (hostname.includes('google.com')) {
                return savedFavIcon || `https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=64`;
            }
            
            // 3. CÁC TRANG WEB PUBLIC KHÁC (Dùng API cho nét)
            return `https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=64`;

        } catch (e) {
            // Nếu URL lỗi, trả về icon mặc định của App
            return 'icons/icon16.png';
        }
    };

    // --- VIEW MANAGEMENT ---
    // --- CẬP NHẬT HÀM RENDER VIEW ---
    const renderView = () => {
        // 1. Ẩn tất cả các container trước
        homeContainer.style.display = 'none';
        if (typeof modernContainer !== 'undefined') modernContainer.style.display = 'none';
        collectionViewContainer.style.display = 'none';

        // 2. Logic hiển thị theo View Mode
        if (viewMode === 'home') {
            // Lấy chế độ giao diện (mặc định là simple)
            const interfaceMode = (appData.settings && appData.settings.currentInterface) ? appData.settings.currentInterface : 'simple';
            
            if (interfaceMode === 'simple') {
                // --- GIAO DIỆN ĐƠN GIẢN ---
                homeContainer.style.display = 'flex';
                // Ẩn thanh search header vì đã có search to ở giữa
                searchInput.parentElement.style.visibility = 'hidden'; 
                renderShortcuts(); 
            } else {
                // --- GIAO DIỆN HIỆN ĐẠI ---
                if (typeof modernContainer !== 'undefined') {
                    modernContainer.style.display = 'flex';
                    
                    // MỚI: Hiện thanh search header để người dùng tìm kiếm web
                    searchInput.parentElement.style.visibility = 'visible'; 
                    
                    loadWallpaper(); 
                    renderModernView();
                }
            }
        } else {
            // --- GIAO DIỆN COLLECTION ---
            collectionViewContainer.style.display = 'flex';
            // Hiện thanh search header
            searchInput.parentElement.style.visibility = 'visible';
            renderActiveCollection();
        }
        
        // Luôn render danh sách collection bên trái
        renderCollections();
    };

    // Sự kiện nút chuyển đổi
    viewToggleBtn.addEventListener('click', () => {
        if (viewMode !== 'home') {
            viewMode = 'home';
        }
        // Đảo trạng thái
        const current = appData.settings.currentInterface || 'simple';
        appData.settings.currentInterface = (current === 'simple') ? 'modern' : 'simple';
        saveData();
        renderView();
    });

    // --- LOGIC HÌNH NỀN (ĐÃ TỐI ƯU CACHE ĐỂ CHỐNG NHÁY) ---

    // 1. Biến toàn cục để lưu link ảnh tạm thời
    let cachedWallpaperUrl = null;

    const loadWallpaper = async (forceReload = false) => {
        // NẾU KHÔNG CẦN RELOAD VÀ ĐÃ CÓ CACHE -> DÙNG NGAY (Ngăn chặn nháy đen)
        if (!forceReload && cachedWallpaperUrl) {
            modernContainer.style.backgroundImage = `url(${cachedWallpaperUrl})`;
            return; 
        }

        try {
            // Lấy ảnh từ Database
            const record = await db.wallpaper.get('current');
            
            if (record && record.blob) {
                // Nếu đã có cache cũ, giải phóng nó để tránh tràn RAM
                if (cachedWallpaperUrl) {
                    URL.revokeObjectURL(cachedWallpaperUrl);
                }

                // Tạo URL mới và lưu vào cache
                cachedWallpaperUrl = URL.createObjectURL(record.blob);
                modernContainer.style.backgroundImage = `url(${cachedWallpaperUrl})`;
            } else {
                // Hình nền mặc định
                modernContainer.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }
        } catch (err) {
            console.error("Lỗi tải hình nền:", err);
        }
    };

    wallpaperInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Lưu vào Database
                await db.wallpaper.put({ 
                    id: 'current', 
                    blob: file 
                });
                
                // Tải lại và ép buộc làm mới cache (forceReload = true)
                loadWallpaper(true);
                
            } catch (err) {
                alert("Lỗi khi lưu hình nền: " + err.message);
            }
        }
    });

    const initWebSearch = (inputElement, suggestionsContainer) => {
        let debounceTimeout = null;
        let highlightedSuggestionIndex = -1;
        let originalUserQuery = '';

        const clearSuggestions = () => {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
        };

        const renderSuggestions = (suggestions) => {
            clearSuggestions();
            if (suggestions.length === 0) return;
            suggestionsContainer.style.display = 'block';
            const ul = document.createElement('ul');
            ul.className = 'suggestions-list';
            suggestions.forEach((suggestion, index) => {
                const li = document.createElement('li');
                li.className = 'suggestion-item';
                li.textContent = suggestion;
                li.addEventListener('click', () => {
                    inputElement.value = suggestion;
                    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`;
                    chrome.tabs.update({ url: targetUrl });
                    clearSuggestions();
                });
                li.addEventListener('mouseover', () => {
                    const currentHighlighted = suggestionsContainer.querySelector('.suggestion-item.highlighted');
                    if (currentHighlighted) currentHighlighted.classList.remove('highlighted');
                    li.classList.add('highlighted');
                    highlightedSuggestionIndex = index;
                });
                ul.appendChild(li);
            });
            suggestionsContainer.appendChild(ul);
        };
        
        const fetchSearchSuggestions = async (query) => {
            if (!query) { clearSuggestions(); return; }
            const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data && data[1] && Array.isArray(data[1])) renderSuggestions(data[1]);
            } catch (error) { console.error("Lỗi khi lấy gợi ý tìm kiếm:", error); clearSuggestions(); }
        };

        inputElement.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            highlightedSuggestionIndex = -1;
            originalUserQuery = inputElement.value.trim();
            debounceTimeout = setTimeout(() => { fetchSearchSuggestions(inputElement.value.trim()); }, 150);
        });

        inputElement.addEventListener('keydown', (e) => {
            const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = inputElement.value.trim();
                if (!query) return;
                const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                chrome.tabs.update({ url: targetUrl });
                return;
            }

            if (suggestions.length === 0) return;
            let newIndex = highlightedSuggestionIndex;
            if (e.key === 'ArrowDown') {
                e.preventDefault(); newIndex = (highlightedSuggestionIndex + 1) % suggestions.length;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); newIndex = (highlightedSuggestionIndex - 1 + suggestions.length) % suggestions.length;
            } else if (e.key === 'Escape') {
                clearSuggestions(); inputElement.value = originalUserQuery; return;
            }
            if (highlightedSuggestionIndex !== -1) suggestions[highlightedSuggestionIndex].classList.remove('highlighted');
            highlightedSuggestionIndex = newIndex;
            if (highlightedSuggestionIndex > -1) {
                suggestions[highlightedSuggestionIndex].classList.add('highlighted');
                inputElement.value = suggestions[highlightedSuggestionIndex].textContent;
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!inputElement.parentElement.contains(e.target)) {
                clearSuggestions();
            }
        });
    };

    homeBtn.addEventListener('click', () => {
        viewMode = 'home';
        activeCollectionId = null;
        renderView();
    });
    
    // --- HOME VIEW LOGIC ---
    const applyHomeTitleStyles = (styles) => {
        homeTitle.textContent = styles.text;
        homeTitle.style.fontFamily = `'${styles.fontFamily}', sans-serif`;
        homeTitle.style.fontSize = `${styles.fontSize}px`;
        homeTitle.style.fontWeight = styles.fontWeight;
        homeTitle.style.fontStyle = styles.fontStyle;
        document.documentElement.style.setProperty('--title-color-dark', styles.colorDark);
        document.documentElement.style.setProperty('--title-color-light', styles.colorLight);
    };

    const populateTitleEditor = () => {
        const styles = appData.settings.homeTitle;
        titleTextInput.value = styles.text;
        titleFontSelect.value = styles.fontFamily;
        titleSizeInput.value = styles.fontSize;
        titleColorDark.value = styles.colorDark;
        titleColorLight.value = styles.colorLight;
        titleBoldBtn.classList.toggle('toggle-active', styles.fontWeight === 'bold');
        titleItalicBtn.classList.toggle('toggle-active', styles.fontStyle === 'italic');
    };

    const livePreviewTitle = () => {
        const currentStyles = {
            text: titleTextInput.value,
            fontFamily: titleFontSelect.value,
            fontSize: titleSizeInput.value,
            fontWeight: titleBoldBtn.classList.contains('toggle-active') ? 'bold' : '300',
            fontStyle: titleItalicBtn.classList.contains('toggle-active') ? 'italic' : 'normal',
            colorDark: titleColorDark.value,
            colorLight: titleColorLight.value,
        };
        applyHomeTitleStyles(currentStyles);
    };

    homeTitle.addEventListener('click', () => {
        populateTitleEditor();
        titleEditor.style.display = 'flex';
    });

    saveTitleBtn.addEventListener('click', () => {
        appData.settings.homeTitle = {
            text: titleTextInput.value,
            fontFamily: titleFontSelect.value,
            fontSize: titleSizeInput.value,
            fontWeight: titleBoldBtn.classList.contains('toggle-active') ? 'bold' : '300',
            fontStyle: titleItalicBtn.classList.contains('toggle-active') ? 'italic' : 'normal',
            colorDark: titleColorDark.value,
            colorLight: titleColorLight.value,
        };
        saveData();
        titleEditor.style.display = 'none';
    });
    
    [titleTextInput, titleFontSelect, titleSizeInput, titleColorDark, titleColorLight].forEach(el => {
        el.addEventListener('input', livePreviewTitle);
    });
    [titleBoldBtn, titleItalicBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('toggle-active');
            livePreviewTitle();
        });
    });

    const renderShortcuts = () => {
        shortcutsGrid.innerHTML = '';
        appData.shortcuts.forEach(shortcut => {
            const shortcutEl = document.createElement('a');
            shortcutEl.href = shortcut.url;
            shortcutEl.className = 'shortcut-item';
            shortcutEl.setAttribute('draggable', true); // Làm cho shortcut có thể kéo
            shortcutEl.dataset.shortcutId = shortcut.id; // Lưu ID để nhận dạng

            shortcutEl.innerHTML = `
                <div class="shortcut-icon-wrapper">
                    <img src="${shortcut.favIconUrl}" class="shortcut-icon" onerror="this.src='icons/icon16.png'">
                </div>
                <span class="shortcut-name">${shortcut.name}</span>
                <button class="delete-shortcut-btn" data-id="${shortcut.id}">&times;</button>
            `;

            // Gắn các sự kiện kéo thả
            shortcutEl.addEventListener('dragstart', handleShortcutDragStart);
            shortcutEl.addEventListener('dragover', handleShortcutDragOver);
            shortcutEl.addEventListener('dragleave', handleShortcutDragLeave);
            shortcutEl.addEventListener('drop', handleShortcutDrop);
            shortcutEl.addEventListener('dragend', handleShortcutDragEnd);

            shortcutsGrid.appendChild(shortcutEl);
            
        });
        
        // Nút "Add" không thể kéo thả
        const addBtn = document.createElement('div');
        addBtn.className = 'shortcut-item add-shortcut-btn';
        addBtn.innerHTML = `
            <div class="shortcut-icon-wrapper"><span class="shortcut-add-icon">✚</span></div>
            <span class="shortcut-name"></span>
        `;
        addBtn.addEventListener('click', handleAddShortcut);
        shortcutsGrid.appendChild(addBtn);
    };
    // --- BẮT ĐẦU: CÁC HÀM XỬ LÝ KÉO THẢ SHORTCUT ---

    const handleShortcutDragStart = (e) => {
        draggedShortcutId = e.target.closest('.shortcut-item').dataset.shortcutId;
        // Thêm hiệu ứng mờ sau một khoảng trễ nhỏ để trình duyệt kịp tạo ảnh kéo
        setTimeout(() => {
            e.target.closest('.shortcut-item').classList.add('dragging');
        }, 0);
    };

    const handleShortcutDragOver = (e) => {
        e.preventDefault(); // Rất quan trọng, cho phép thả
        const target = e.target.closest('.shortcut-item');
        // Ngăn việc tự thả vào chính nó hoặc vào nút "Add"
        if (target && target.dataset.shortcutId && target.dataset.shortcutId !== draggedShortcutId) {
            target.classList.add('drag-over-indicator');
        }
    };

    const handleShortcutDragLeave = (e) => {
        e.target.closest('.shortcut-item').classList.remove('drag-over-indicator');
    };

    const handleShortcutDrop = (e) => {
        e.preventDefault();
        const dropTarget = e.target.closest('.shortcut-item');
        if (!dropTarget || !dropTarget.dataset.shortcutId) return;

        const droppedOnId = dropTarget.dataset.shortcutId;

        // Tìm vị trí của shortcut được kéo và shortcut bị thả vào
        const draggedIndex = appData.shortcuts.findIndex(s => s.id === draggedShortcutId);
        const targetIndex = appData.shortcuts.findIndex(s => s.id === droppedOnId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Sắp xếp lại mảng dữ liệu
        // 1. Xóa shortcut ra khỏi vị trí cũ
        const [draggedItem] = appData.shortcuts.splice(draggedIndex, 1);
        // 2. Chèn nó vào vị trí mới
        appData.shortcuts.splice(targetIndex, 0, draggedItem);

        // Lưu và vẽ lại giao diện
        saveData();
        renderShortcuts();
    };

    const handleShortcutDragEnd = (e) => {
        // Dọn dẹp tất cả các class hiệu ứng
        document.querySelectorAll('.shortcut-item').forEach(item => {
            item.classList.remove('dragging', 'drag-over-indicator');
        });
        draggedShortcutId = null; // Reset biến
    };

    // --- KẾT THÚC: CÁC HÀM XỬ LÝ KÉO THẢ SHORTCUT ---
    const handleAddShortcut = () => {
        const name = prompt("Shortcut name:");
        if (!name) return;
        let url = prompt("URL (for example: https://www.anhtalaghung.com):");
        if (!url) return;
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        try {
            const validUrl = new URL(url);
            const favIconUrl = `https://s2.googleusercontent.com/s2/favicons?domain_url=${validUrl.hostname}&sz=64`;
            appData.shortcuts.push({ id: generateId(), name, url: validUrl.href, favIconUrl });
            saveData();
            renderShortcuts();
        } catch (_) { alert("URL không hợp lệ."); }
    };
    shortcutsGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-shortcut-btn')) {
            e.preventDefault();
            const shortcutId = e.target.dataset.id;
            appData.shortcuts = appData.shortcuts.filter(s => s.id !== shortcutId);
            saveData();
            renderShortcuts();
        }
    });
    webSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = webSearchInput.value.trim();
        if (!query) return;
        let isUrl = false;
        try { new URL(query); isUrl = true; } catch (_) { if (query.includes('.') && !query.includes(' ')) isUrl = true; }
        const targetUrl = isUrl ? ((query.startsWith('http://') || query.startsWith('https://')) ? query : `http://${query}`) : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.update({ url: targetUrl });
    });
    const clearSuggestions = () => { webSearchSuggestionsContainer.innerHTML = ''; webSearchSuggestionsContainer.style.display = 'none'; };
    const renderSuggestions = (suggestions) => {
        clearSuggestions();
        if (suggestions.length === 0) return;
        webSearchSuggestionsContainer.style.display = 'block';
        const ul = document.createElement('ul');
        ul.className = 'suggestions-list';
        suggestions.forEach((suggestion, index) => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.textContent = suggestion;
            li.addEventListener('click', () => { webSearchInput.value = suggestion; webSearchForm.requestSubmit(); clearSuggestions(); });
            li.addEventListener('mouseover', () => {
                const currentHighlighted = document.querySelector('.suggestion-item.highlighted');
                if (currentHighlighted) currentHighlighted.classList.remove('highlighted');
                li.classList.add('highlighted');
                highlightedSuggestionIndex = index;
            });
            ul.appendChild(li);
        });
        webSearchSuggestionsContainer.appendChild(ul);
    };
    const fetchSearchSuggestions = async (query) => {
        if (!query) { clearSuggestions(); return; }
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && data[1] && Array.isArray(data[1])) renderSuggestions(data[1]);
        } catch (error) { console.error("Lỗi khi lấy gợi ý tìm kiếm:", error); clearSuggestions(); }
    };
    webSearchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        highlightedSuggestionIndex = -1;
        originalUserQuery = webSearchInput.value.trim();
        debounceTimeout = setTimeout(() => { fetchSearchSuggestions(webSearchInput.value.trim()); }, 150);
    });
    webSearchInput.addEventListener('keydown', (e) => {
        const suggestions = document.querySelectorAll('.suggestion-item');
        if (suggestions.length === 0) return;
        let newIndex = highlightedSuggestionIndex;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            newIndex = (highlightedSuggestionIndex + 1) % suggestions.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            newIndex = (highlightedSuggestionIndex - 1 + suggestions.length) % suggestions.length;
        } else if (e.key === 'Escape') {
            clearSuggestions();
            webSearchInput.value = originalUserQuery;
            return;
        }
        if (highlightedSuggestionIndex !== -1) suggestions[highlightedSuggestionIndex].classList.remove('highlighted');
        highlightedSuggestionIndex = newIndex;
        if (highlightedSuggestionIndex > -1) {
            suggestions[highlightedSuggestionIndex].classList.add('highlighted');
            webSearchInput.value = suggestions[highlightedSuggestionIndex].textContent;
        }
    });
    document.addEventListener('click', (e) => { if (!webSearchForm.contains(e.target)) clearSuggestions(); });

    const autoResizeTextarea = () => {
    webSearchInput.style.height = 'auto'; // Reset chiều cao để tính toán lại
    webSearchInput.style.height = webSearchInput.scrollHeight + 'px'; // Đặt chiều cao bằng chiều cao nội dung
};

// Lắng nghe sự kiện nhập liệu để gọi hàm resize
webSearchInput.addEventListener('input', autoResizeTextarea);

// Xử lý sự kiện nhấn phím Enter để gửi form thay vì xuống dòng
webSearchInput.addEventListener('keydown', (e) => {
    // Nếu nhấn Enter và không nhấn kèm Shift
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Ngăn hành động mặc định (xuống dòng)
        webSearchForm.requestSubmit(); // Gửi form
    }
});

    webSearchAiBtn.addEventListener('click', () => {
        const query = webSearchInput.value.trim();

        // --- BẮT ĐẦU THAY ĐỔI ---
        let targetUrl;

        if (query) {
            // Nếu có nội dung, tạo URL tìm kiếm như cũ
            targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=50`;
        } else {
            // Nếu không có nội dung, điều hướng đến trang chủ Google với AI mode
            targetUrl = `https://www.google.com/?udm=50`;
        }
        // --- KẾT THÚC THAY ĐỔI ---
        
        // Cập nhật tab hiện tại để thực hiện tìm kiếm/điều hướng
        chrome.tabs.update({ url: targetUrl });
    });

    webSearchNormalBtn.addEventListener('click', () => {
        const query = webSearchInput.value.trim();
        if (!query) return;

        // Tạo URL tìm kiếm thông thường (không có &udm=14)
        const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        // Cập nhật tab hiện tại
        chrome.tabs.update({ url: targetUrl });
    });


    // --- COLLECTION VIEW LOGIC ---
    // PHIÊN BẢN MỚI
// PHIÊN BẢN MỚI
const renderOpenTabs = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, activeTabs => {
        const currentTabId = activeTabs.length > 0 ? activeTabs[0].id : null;
        chrome.tabs.query({}, tabs => {
            openTabsList.innerHTML = '';
            const filteredTabs = tabs.filter(tab => tab.id !== currentTabId);
            filteredTabs.forEach(tab => {
                const li = document.createElement('li');
                li.setAttribute('draggable', true);
                const tabInfo = { type: 'new-tab', url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl || '' };
                li.dataset.tabInfo = JSON.stringify(tabInfo);
                li.addEventListener('dragstart', handleDragStart);
                li.addEventListener('click', () => {
                    chrome.tabs.update(tab.id, { active: true });
                    chrome.windows.update(tab.windowId, { focused: true });
                });

                // --- BẮT ĐẦU LOGIC ICON MỚI (HỖ TRỢ EMOJI) ---
                let iconElement; // Biến để chứa hoặc <img> hoặc <span>

                // KIỂM TRA: Nếu là tab nội bộ của trình duyệt
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('extension://')) {
                    // Tạo một thẻ SPAN để chứa emoji
                    iconElement = document.createElement('span');
                    iconElement.className = 'open-tab-emoji-icon'; // Gán class để CSS
                    // Lấy emoji từ cài đặt và gán vào
                    iconElement.textContent = appData.settings.virtualHomeButton.emoji;
                } else {
                    // Nếu là tab web thông thường, giữ nguyên logic tạo IMG cũ
                    iconElement = document.createElement('img');
                    iconElement.src = tab.favIconUrl || '';

                    iconElement.onerror = () => {
                        try {
                            const url = new URL(tab.url);
                            const googleApiUrl = `https://s2.googleusercontent.com/s2/favicons?domain_url=${url.hostname}&sz=64`;
                            
                            const testImage = new Image();
                            testImage.src = googleApiUrl;
                            
                            testImage.onload = () => { iconElement.src = googleApiUrl; };
                            testImage.onerror = () => { iconElement.src = 'icons/icon16.png'; };

                        } catch (e) {
                            iconElement.src = 'icons/icon16.png';
                        }
                    };
                }
                // --- KẾT THÚC LOGIC ICON MỚI ---
                
                // --- KẾT THÚC PHẦN NÂNG CẤP ---
                
                const titleSpan = document.createElement('span');
                titleSpan.className = 'open-tab-title';
                titleSpan.textContent = tab.title;
                const closeBtn = document.createElement('button');
                closeBtn.className = 'close-tab-btn';
                closeBtn.innerHTML = '&times;';
                closeBtn.title = 'Đóng tab';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    chrome.tabs.remove(tab.id);
                });
                li.appendChild(iconElement);
                li.appendChild(titleSpan);
                li.appendChild(closeBtn);
                openTabsList.appendChild(li);
            });
        });
    });
};
    const renderCollections = () => {
        collectionsList.innerHTML = '';
        appData.collections.forEach(collection => {
            const li = document.createElement('li');
            li.dataset.id = collection.id;
            li.setAttribute('draggable', true);
            if (viewMode === 'collection' && collection.id === activeCollectionId) li.classList.add('active');
            li.addEventListener('click', () => { viewMode = 'collection'; activeCollectionId = collection.id; renderView(); });
            li.addEventListener('dragstart', handleCollectionDragStart);
            li.addEventListener('dragover', handleCollectionDragOver);
            li.addEventListener('dragleave', handleCollectionDragLeave);
            li.addEventListener('drop', handleCollectionDrop);
            li.addEventListener('dragend', handleCollectionDragEnd);
            const collectionName = document.createElement('span');
            collectionName.className = 'collection-name';
            collectionName.textContent = collection.name;
            const initialChar = (collection.name && collection.name.length > 0) ? collection.name.charAt(0).toUpperCase() : "?";
            collectionName.dataset.initial = initialChar;
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'collection-actions';
            const renameBtn = document.createElement('button');
            renameBtn.className = 'collection-action-btn rename-btn';
            renameBtn.innerHTML = '𝐚';
            renameBtn.title = 'Rename';
            renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameCollection(collection.id); });
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'collection-action-btn delete-btn';
            deleteBtn.innerHTML = '⊘';
            deleteBtn.title = 'Delete';
            deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCollection(collection.id); });
            actionsContainer.appendChild(renameBtn);
            actionsContainer.appendChild(deleteBtn);
            li.appendChild(collectionName);
            li.appendChild(actionsContainer);
            collectionsList.appendChild(li);
        });
    };
    const renderActiveCollection = () => {
        const collection = appData.collections.find(c => c.id === activeCollectionId);
        if (!collection) { viewMode = 'home'; renderView(); return; }
        currentCollectionNameEl.textContent = collection.name;
        sectionsContainer.innerHTML = '';
        (collection.sections || []).forEach((section, index) => {
            const isFirst = index === 0;
            const sectionEl = createSectionElement(section, isFirst);
            sectionsContainer.appendChild(sectionEl);
        });
    };

    const createSectionElement = (section, isFirst) => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section';
        sectionEl.dataset.collectionId = activeCollectionId;
        sectionEl.dataset.sectionId = section.id;

        // VÙNG THẢ SẼ LÀ TOÀN BỘ ĐỀ MỤC (để dễ thả vào)
        sectionEl.addEventListener('dragover', handleSectionDragOver);
        sectionEl.addEventListener('dragleave', handleSectionDragLeave);
        sectionEl.addEventListener('drop', handleSectionDrop);

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        
        // CHỈ PHẦN HEADER MỚI CÓ THỂ BẮT ĐẦU KÉO
        sectionHeader.setAttribute('draggable', true);
        sectionHeader.addEventListener('dragstart', handleSectionDragStart);
        sectionHeader.addEventListener('dragend', handleSectionDragEnd);

        const title = document.createElement('h4');
        title.textContent = section.name;

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'section-header-actions';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'rename-section-btn action-button';
        renameBtn.innerHTML = '🟢';
        renameBtn.addEventListener('click', () => renameSection(activeCollectionId, section.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-section-btn delete-button';
        deleteBtn.innerHTML = '⭕';
        deleteBtn.addEventListener('click', () => deleteSection(activeCollectionId, section.id));

        actionsContainer.appendChild(renameBtn);
        actionsContainer.appendChild(deleteBtn);

        sectionHeader.appendChild(title);
        sectionHeader.appendChild(actionsContainer);
        sectionEl.appendChild(sectionHeader);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'cards-container';
        (section.cards || []).forEach(card => cardsContainer.appendChild(createCardElement(card, section.id)));
        sectionEl.appendChild(cardsContainer);
        cardsContainer.addEventListener('dragover', handleDragOver);
        cardsContainer.addEventListener('dragleave', handleDragLeave);
        cardsContainer.addEventListener('drop', handleDrop);
        
        return sectionEl;
    };
    
    // THAY THẾ TOÀN BỘ HÀM CŨ BẰNG HÀM NÀY

    const createCardElement = (card, sectionId) => {
        // 1. Tạo các phần tử chính của card
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.setAttribute('draggable', true);
        const cardInfo = { type: 'existing-card', cardId: card.id, sectionId: sectionId, collectionId: activeCollectionId };
        cardEl.dataset.cardInfo = JSON.stringify(cardInfo);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'clear';
        deleteBtn.innerHTML = '&times;';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'card-title';
        titleSpan.textContent = card.title;

        const noteDiv = document.createElement('div');
        noteDiv.className = 'card-note';
        noteDiv.setAttribute('contenteditable', true);
        noteDiv.setAttribute('placeholder', 'Thêm ghi chú...');
        noteDiv.textContent = card.note || '';

    // 2. --- LOGIC LẤY ICON MỚI (ĐÃ CẬP NHẬT CHO GOOGLE) ---
        const iconImg = document.createElement('img');
        
        // Dùng hàm thông minh để quyết định nguồn ảnh
        // Lưu ý: card object cần có thuộc tính favIconUrl được lưu từ trước
        // Nếu card cũ không có favIconUrl thì nó sẽ tự fallback về API
        const smartSrc = getSmartIconUrl(card.url, card.favIconUrl); 
        
        iconImg.src = smartSrc;
        
        iconImg.onerror = () => {
            iconImg.src = 'icons/icon16.png';
        };
        // --- KẾT THÚC LOGIC ---
        // --- KẾT THÚC LOGIC LẤY ICON MỚI ---

        // 3. Gắn các sự kiện lại
        cardEl.addEventListener('dragstart', handleDragStart);
        deleteBtn.addEventListener('click', e => { e.stopPropagation(); deleteCard(activeCollectionId, sectionId, card.id); });
        noteDiv.addEventListener('focusout', e => updateCardNote(activeCollectionId, sectionId, card.id, e.target.textContent));
        cardEl.addEventListener('click', e => { if (!e.target.closest('.delete-btn, .card-note')) chrome.tabs.create({ url: card.url, active: true }); });

        // 4. Xây dựng cấu trúc HTML của card
        cardHeader.appendChild(iconImg);
        cardHeader.appendChild(titleSpan);
        cardEl.appendChild(deleteBtn);
        cardEl.appendChild(cardHeader);
        cardEl.appendChild(noteDiv);

        return cardEl;
    };
    const handleDragStart = (e) => {
        e.stopPropagation();

        const info = e.target.dataset.tabInfo || e.target.dataset.cardInfo;
        if (info) {
            e.dataTransfer.setData('text/plain', info);
        }
        if (e.target.dataset.cardInfo) {
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    };

    const handleDragOver = (e) => { e.preventDefault(); const c = e.target.closest('.cards-container'); if (c) c.classList.add('drag-over'); };
    const handleDragLeave = (e) => { const c = e.target.closest('.cards-container'); if (c) c.classList.remove('drag-over'); };
    // PHIÊN BẢN MỚI ĐÃ SỬA LỖI
const handleDrop = (e) => {
    e.preventDefault();
    const dropZone = e.target.closest('.cards-container');
    if (!dropZone) return;
    dropZone.classList.remove('drag-over');

    const dataString = e.dataTransfer.getData('text/plain');
    if (!dataString) return;

    try {
        draggedItem = JSON.parse(dataString);
        if (draggedItem.type !== 'new-tab' && draggedItem.type !== 'existing-card') {
            return;
        }
    } catch (error) {
        console.log("Đã bỏ qua một lần thả không hợp lệ (không phải JSON).");
        return;
    }

    if (!draggedItem) return;

    const targetSectionEl = dropZone.closest('.section');
    const targetCollectionId = targetSectionEl.dataset.collectionId;
    const targetSectionId = targetSectionEl.dataset.sectionId;
    const targetCollection = appData.collections.find(c => c.id === targetCollectionId);
    const targetSection = targetCollection.sections.find(s => s.id === targetSectionId);
    
    if (draggedItem.type === 'new-tab') {
        targetSection.cards.push({ 
            id: generateId(), 
            url: draggedItem.url, 
            title: draggedItem.title, 
            favIconUrl: draggedItem.favIconUrl, // <-- PHẢI CÓ DÒNG NÀY
            note: '' 
        });
    } else if (draggedItem.type === 'existing-card') {
        const { cardId, sectionId: sourceSectionId, collectionId: sourceCollectionId } = draggedItem;
        const sourceCollection = appData.collections.find(c => c.id === sourceCollectionId);
        const sourceSection = sourceCollection.sections.find(s => s.id === sourceSectionId);
        const cardIndex = sourceSection.cards.findIndex(c => c.id === cardId);
        if (cardIndex > -1) {
            const [cardToMove] = sourceSection.cards.splice(cardIndex, 1);
            targetSection.cards.push(cardToMove);
        }
    }
    saveData();
    renderActiveCollection();
};
// --- Kéo thả SECTION ---
const handleSectionDragStart = (e) => {
    // Ngăn sự kiện nổi bọt lên các phần tử cha
    e.stopPropagation(); 
    
    const sectionEl = e.target.closest('.section');
    draggedSectionInfo = {
        sectionId: sectionEl.dataset.sectionId,
        collectionId: sectionEl.dataset.collectionId
    };
    // Thêm hiệu ứng mờ
    setTimeout(() => sectionEl.classList.add('dragging'), 0);
};

const handleSectionDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const targetSection = e.target.closest('.section');
    if (targetSection) {
        targetSection.classList.add('drag-over-indicator');
    }
};

const handleSectionDragLeave = (e) => {
    e.stopPropagation();
    const targetSection = e.target.closest('.section');
    if (targetSection) {
        targetSection.classList.remove('drag-over-indicator');
    }
};

const handleSectionDragEnd = (e) => {
    e.stopPropagation();
    // Dọn dẹp tất cả các hiệu ứng
    document.querySelectorAll('.section.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.section.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
    draggedSectionInfo = null;
};

const handleSectionDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const dropTarget = e.target.closest('.section');
    if (!dropTarget || !draggedSectionInfo) return;

    dropTarget.classList.remove('drag-over-indicator');
    
    const droppedOnSectionId = dropTarget.dataset.sectionId;
    const draggedSectionId = draggedSectionInfo.sectionId;

    if (draggedSectionId === droppedOnSectionId) return; // Không làm gì nếu thả vào chính nó

    const collection = appData.collections.find(c => c.id === draggedSectionInfo.collectionId);
    if (!collection) return;

    const draggedIndex = collection.sections.findIndex(s => s.id === draggedSectionId);
    const targetIndex = collection.sections.findIndex(s => s.id === droppedOnSectionId);

    // Sắp xếp lại mảng
    const [dragged] = collection.sections.splice(draggedIndex, 1);
    collection.sections.splice(targetIndex, 0, dragged);

    saveData();
    renderActiveCollection(); // Vẽ lại chỉ khu vực collection hiện tại
};
    document.addEventListener('dragend', () => { const draggingEl = document.querySelector('.dragging'); if (draggingEl) draggingEl.classList.remove('dragging'); draggedItem = null; });
    const handleCollectionDragStart = (e) => { draggedCollectionId = e.target.dataset.id; e.target.style.opacity = '0.5'; };
    const handleCollectionDragOver = (e) => { e.preventDefault(); const targetLi = e.target.closest('li'); if (targetLi) targetLi.classList.add('drag-over-indicator'); };
    const handleCollectionDragLeave = (e) => { e.target.closest('li').classList.remove('drag-over-indicator'); };
    const handleCollectionDragEnd = (e) => { e.target.style.opacity = '1'; document.querySelectorAll('.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator')); };
    const handleCollectionDrop = (e) => { e.preventDefault(); const dropTarget = e.target.closest('li'); dropTarget.classList.remove('drag-over-indicator'); const droppedOnCollectionId = dropTarget.dataset.id; if (draggedCollectionId === droppedOnCollectionId) return; const draggedIndex = appData.collections.findIndex(c => c.id === draggedCollectionId); const targetIndex = appData.collections.findIndex(c => c.id === droppedOnCollectionId); const [dragged] = appData.collections.splice(draggedIndex, 1); appData.collections.splice(targetIndex, 0, dragged); saveData(); renderCollections(); };
    const renameCollection = (id) => { const c = appData.collections.find(c => c.id === id); const n = prompt('Rename:', c.name); if (n && n !== c.name) { c.name = n; saveData(); renderCollections(); } };
    const deleteCollection = (id) => { if (confirm('Delete Collection?')) { appData.collections = appData.collections.filter(c => c.id !== id); if (activeCollectionId === id) { activeCollectionId = null; viewMode = 'home'; } saveData(); renderView(); } };
    const addSection = (cId) => {
        const n = prompt('List name:');
        if (n) {
            const c = appData.collections.find(c => c.id === cId);
            if (c) { // Thêm kiểm tra để đảm bảo collection tồn tại
                if (!c.sections) { // Nếu collection chưa có mảng sections, tạo mới
                    c.sections = [];
                }
                c.sections.push({ id: generateId(), name: n, cards: [] });
                saveData();
                renderActiveCollection();
            } else {
                console.error("Could not find collection with ID:", cId);
            }
        }
    };
    const renameSection = (cId, sId) => { const s = appData.collections.find(c=>c.id===cId).sections.find(s=>s.id===sId); const n = prompt('Rename:', s.name); if (n && n !== s.name) { s.name = n; saveData(); renderActiveCollection(); } };
    const deleteSection = (cId, sId) => { if (confirm('Clear list?')) { const c = appData.collections.find(c=>c.id===cId); c.sections = c.sections.filter(s => s.id !== sId); saveData(); renderActiveCollection(); } };
    const deleteCard = (cId, sId, cardId) => { const s = appData.collections.find(c=>c.id===cId).sections.find(s=>s.id===sId); s.cards = s.cards.filter(c => c.id !== cardId); saveData(); renderActiveCollection(); };
    const updateCardNote = (cId, sId, cardId, note) => {
         const collection = appData.collections.find(c => c.id === cId);
        if (!collection) {
            console.warn(`updateCardNote: Không tìm thấy collection với ID: ${cId}`);
            return;
        }
        const section = (collection.sections || []).find(s => s.id === sId);
        if (!section) {
            console.warn(`updateCardNote: Không tìm thấy section với ID: ${sId}`);
            return;
        }
        const card = (section.cards || []).find(c => c.id === cardId);
        if (!card) {
            console.warn(`updateCardNote: Không tìm thấy card với ID: ${cardId}`);
            return;
        }
        if (card.note !== note) {
            card.note = note;
            saveData();
        }
    };
    const applyTheme = () => { if (appData.settings.theme === 'light') { document.body.classList.add('light-mode'); themeToggleBtn.innerHTML = '☾'; } else { document.body.classList.remove('light-mode'); themeToggleBtn.innerHTML = '☼'; } };
    themeToggleBtn.addEventListener('click', () => { appData.settings.theme = (appData.settings.theme === 'dark') ? 'light' : 'dark'; applyTheme(); saveData(); });
    exportBtn.addEventListener('click', () => { const d = JSON.stringify(appData, null, 2); const b = new Blob([d], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'tab-manager-backup.json'; a.click(); URL.revokeObjectURL(u); });
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (importedData && importedData.collections && importedData.shortcuts && importedData.settings) {
                    if (confirm('Old data will be lost, continue?')) {
                        appData = importedData;
                        activeCollectionId = null;
                        viewMode = 'home';
                        saveData();
                        applyTheme();
                        applyHomeTitleStyles(appData.settings.homeTitle);
                        renderView();
                    }
                } else {
                    alert('Invalid file');
                }
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    refreshTabsBtn.addEventListener('click', renderOpenTabs);
    chrome.tabs.onCreated.addListener(renderOpenTabs);
    chrome.tabs.onRemoved.addListener(renderOpenTabs);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.url || changeInfo.title || changeInfo.status) { renderOpenTabs(); } });
        // Lắng nghe sự thay đổi trong chrome.storage từ các tab khác
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        let needsFullRender = false;
        if (changes.collections) { appData.collections = changes.collections.newValue; needsFullRender = true; }
        if (changes.shortcuts) { appData.shortcuts = changes.shortcuts.newValue; needsFullRender = true; }
        if (changes.settings) { appData.settings = changes.settings.newValue; needsFullRender = true; }
        if (needsFullRender) {
            console.log('Phát hiện thay đổi dữ liệu từ tab khác. Đang cập nhật...');
            applyTheme();
            applyHomeTitleStyles(appData.settings.homeTitle);
            renderView();
        }
    });

    localSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.card').forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            const note = card.querySelector('.card-note').textContent.toLowerCase();
            // Nếu có searchTerm, ẩn/hiện card. Nếu không, hiện tất cả.
            card.style.display = (title.includes(searchTerm) || note.includes(searchTerm)) ? "" : "none";
        });
    });

    // Khi click vào nút kính lúp, focus vào ô input để nó hiện ra
    localSearchBtn.addEventListener('click', () => {
        localSearchInput.focus();
    });

    // --- BẮT ĐẦU: LOGIC CLOUD SYNC ---
    // Các phần tử DOM cho Sync
    const cloudSyncBtn = document.getElementById('cloud-sync-btn');
    const syncModalOverlay = document.getElementById('sync-settings-modal-overlay');
    const closeSyncModalBtn = document.getElementById('close-sync-modal-btn');
    const syncUrlInput = document.getElementById('sync-url-input');
    const saveSyncSettingsBtn = document.getElementById('save-sync-settings-btn');
    const manualPullBtn = document.getElementById('manual-pull-btn');
    const manualPushBtn = document.getElementById('manual-push-btn');
    const syncStatus = document.getElementById('sync-status');

    // Mở/Đóng Modal
    cloudSyncBtn.addEventListener('click', () => {
        syncUrlInput.value = appData.settings.syncUrl || '';
        syncModalOverlay.style.display = 'flex';
        syncStatus.textContent = '';
    });
    const closeSyncModal = () => syncModalOverlay.style.display = 'none';
    closeSyncModalBtn.addEventListener('click', closeSyncModal);
    syncModalOverlay.addEventListener('click', (e) => { if (e.target === syncModalOverlay) closeSyncModal(); });

    // Hàm Push (Đẩy dữ liệu lên Cloud)
    const pushDataToCloud = async () => {
        const url = appData.settings.syncUrl;
        if (!url) return;

        try {
            if (syncStatus.style.display !== 'none') syncStatus.textContent = 'Syncing...';
            
            // Chuẩn bị dữ liệu (loại bỏ cài đặt syncUrl để tránh lộ hoặc vòng lặp)
            const dataToSync = JSON.parse(JSON.stringify(appData));
            
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(dataToSync)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('Auto-sync: Pushed successfully at ' + result.time);
                if (syncStatus.style.display !== 'none') syncStatus.textContent = '✅ Pushed successfully';
            } else {
                console.error('Auto-sync Error:', result.message);
                if (syncStatus.style.display !== 'none') syncStatus.textContent = '❌ Error pushing';
            }
        } catch (e) {
            console.error('Auto-sync Network Error:', e);
            if (syncStatus.style.display !== 'none') syncStatus.textContent = '❌ Network Error';
        }
    };

    // Hàm Pull (Lấy dữ liệu từ Cloud)
    const pullDataFromCloud = async () => {
        const url = appData.settings.syncUrl;
        if (!url) return;

        try {
            syncStatus.textContent = 'Downloading...';
            const response = await fetch(url);
            const cloudData = await response.json();

            // Kiểm tra tính hợp lệ cơ bản
            if (cloudData && cloudData.collections) {
                // Hợp nhất dữ liệu: Giữ lại syncUrl hiện tại
                const currentSyncUrl = appData.settings.syncUrl;
                appData = cloudData;
                
                // Đảm bảo cấu trúc settings tồn tại
                if (!appData.settings) appData.settings = {};
                appData.settings.syncUrl = currentSyncUrl; // Khôi phục URL

                saveData(false); // Lưu vào local nhưng KHÔNG kích hoạt auto-sync ngược lại
                
                // Refresh giao diện
                applyTheme();
                applyHomeTitleStyles(appData.settings.homeTitle);
                renderView();
                
                syncStatus.textContent = '✅ Pulled & Updated';
                console.log('Auto-sync: Pulled successfully');
            } else {
                syncStatus.textContent = '⚠️ Cloud data empty or invalid';
            }
        } catch (e) {
            console.error('Auto-sync Pull Error:', e);
            syncStatus.textContent = '❌ Pull Error';
        }
    };

    // --- RENDER GIAO DIỆN MODERN ---

    const renderModernView = () => {
        renderDesktop();
        renderDock();
    };

    const renderDesktop = () => {
        desktopArea.innerHTML = '';
        
        // --- SỬA LỖI 1: Xử lý Drop cho Container cha (Desktop Area) ---

        appData.shortcuts.forEach(shortcut => {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            icon.setAttribute('draggable', true);
            icon.dataset.id = shortcut.id;
            icon.dataset.type = 'desktop'; 
            
            const iconSrc = getSmartIconUrl(shortcut.url, shortcut.favIconUrl);
            icon.innerHTML = `
                <img src="${iconSrc}" class="desktop-icon-img" onerror="this.src='icons/icon16.png'">
                <span class="desktop-icon-name">${shortcut.name}</span>
            `;

            icon.addEventListener('dblclick', () => {
                // CŨ: chrome.windows.create(...) -> Popup
                // MỚI: Mở tab mới và chuyển tới đó ngay
                chrome.tabs.create({ url: shortcut.url, active: true });
            });

            icon.addEventListener('contextmenu', (e) => handleContextMenu(e, shortcut.id, 'desktop'));

            icon.addEventListener('dragstart', (e) => handleModernDragStart(e, shortcut.id, 'desktop'));
            
            icon.addEventListener('dragover', (e) => e.preventDefault());
            
            // --- SỬA LỖI 1: Ngăn nổi bọt sự kiện Drop ---
            icon.addEventListener('drop', (e) => {
                e.stopPropagation(); // QUAN TRỌNG: Ngăn sự kiện chạy tiếp lên cha (desktopArea)
                handleModernDrop(e, shortcut.id, 'desktop');
            });

            icon.addEventListener('auxclick', (e) => {
                if (e.button === 1) { // 1 là mã của nút chuột giữa
                    e.preventDefault(); // Ngăn hành động mặc định (như cuộn trang)
                    // Mở tab mới trong nền (không focus ngay)
                    chrome.tabs.create({ url: shortcut.url, active: true });
                }
            });

            desktopArea.appendChild(icon);
        });

        const addBtn = document.createElement('div');
        addBtn.className = 'desktop-icon desktop-add-btn';
        addBtn.innerHTML = `
            <div class="desktop-icon-img">+</div>
            <span class="desktop-icon-name">Add</span>
        `;
        addBtn.addEventListener('click', handleAddShortcut);
        desktopArea.appendChild(addBtn);
    };

    const renderDock = () => {
        macosDock.innerHTML = '';
        
        if (!appData.dockShortcuts) appData.dockShortcuts = [];

        // --- SỬA LỖI 1: Gắn sự kiện Thả cho toàn bộ thanh Dock ---
        // Điều này cho phép thả vào khoảng trống trong dock

        appData.dockShortcuts.forEach(shortcut => {
            const item = document.createElement('div');
            item.className = 'dock-item';
            item.setAttribute('draggable', true);
            item.dataset.id = shortcut.id;
            item.dataset.title = shortcut.name; 
            
            const iconSrc = getSmartIconUrl(shortcut.url, shortcut.favIconUrl);
            item.innerHTML = `<img src="${iconSrc}" onerror="this.src='icons/icon16.png'">`;

            item.addEventListener('click', () => {
                // CŨ: chrome.tabs.update(...) -> Chuyển hướng tab hiện tại
                // MỚI: Mở tab mới và chuyển tới đó ngay (để giữ lại trang Manager)
                chrome.tabs.create({ url: shortcut.url, active: true });
            });
            item.addEventListener('contextmenu', (e) => handleContextMenu(e, shortcut.id, 'dock'));
            
            item.addEventListener('dragstart', (e) => handleModernDragStart(e, shortcut.id, 'dock'));
            item.addEventListener('dragover', (e) => e.preventDefault());
            
            // Sự kiện thả lên một icon cụ thể (để sắp xếp)
            item.addEventListener('drop', (e) => {
                e.stopPropagation(); // Ngăn nổi bọt lên cha macosDock
                handleModernDrop(e, shortcut.id, 'dock');
            });

            item.addEventListener('auxclick', (e) => {
                if (e.button === 1) { // 1 là mã của nút chuột giữa
                    e.preventDefault();
                    chrome.tabs.create({ url: shortcut.url, active: true });
                }
            });

            macosDock.appendChild(item);
        });

        // ... (Phần vách ngăn và nút đổi hình nền giữ nguyên) ...
        const sep = document.createElement('div');
        sep.className = 'dock-separator';
        macosDock.appendChild(sep);

        const wpBtn = document.createElement('div');
        wpBtn.className = 'dock-item';
        wpBtn.dataset.title = 'Change Wallpaper';
        wpBtn.innerHTML = `<div style="font-size: 30px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">🎨</div>`;
        wpBtn.addEventListener('click', () => wallpaperInput.click());
        macosDock.appendChild(wpBtn);

        const searchBtn = document.createElement('div');
        searchBtn.className = 'dock-item';
        searchBtn.dataset.title = 'Search'; // Tooltip khi hover
        
        // Dùng Emoji kính lúp, căn giữa đẹp mắt
        searchBtn.innerHTML = `<div style="font-size: 24px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">🔍</div>`;
        
        // Sự kiện click để bật/tắt Spotlight
        searchBtn.addEventListener('click', toggleSpotlight);
        
        macosDock.appendChild(searchBtn);
    };

    // --- LOGIC CONTEXT MENU ---
    const handleContextMenu = (e, id, type) => {
        e.preventDefault();
        contextTargetId = id;
        contextTargetType = type;

        // Hiển thị/Ẩn mục Rename tùy vào type
        if (type === 'dock') {
            ctxRename.style.display = 'none';
            ctxOpenNew.style.display = 'none';
        } else {
            ctxRename.style.display = 'block';
        }

        // Định vị menu
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.display = 'flex';
    };

    ctxOpenNew.addEventListener('click', () => {
        let list = (contextTargetType === 'desktop') ? appData.shortcuts : appData.dockShortcuts;
        const item = list.find(s => s.id === contextTargetId);
        
        if (item) {
            // Mở trong tab mới nhưng không focus, giúp người dùng mở nhiều tab liên tục
            chrome.tabs.create({ url: item.url, active: true });
        }
        contextMenu.style.display = 'none';
    });

    ctxOpenApp.addEventListener('click', () => {
        let list = (contextTargetType === 'desktop') ? appData.shortcuts : appData.dockShortcuts;
        const item = list.find(s => s.id === contextTargetId);
        
        if (item) {
            // Mở dưới dạng cửa sổ ứng dụng (Popup)
            chrome.windows.create({
                url: item.url,
                type: "popup",
                focused: true,
                state: "normal"
            });
        }
        contextMenu.style.display = 'none';
    });

    // Xử lý Rename
    ctxRename.addEventListener('click', () => {
        if (contextTargetType === 'desktop') {
            const item = appData.shortcuts.find(s => s.id === contextTargetId);
            if (item) {
                const newName = prompt('Rename shortcut:', item.name);
                if (newName) {
                    item.name = newName;
                    saveData();
                    renderModernView();
                }
            }
        }
        contextMenu.style.display = 'none';
    });

    // Xử lý Delete
    ctxDelete.addEventListener('click', () => {
        // Xóa ngay lập tức không cần hỏi
        if (contextTargetType === 'desktop') {
            appData.shortcuts = appData.shortcuts.filter(s => s.id !== contextTargetId);
        } else if (contextTargetType === 'dock') {
            appData.dockShortcuts = appData.dockShortcuts.filter(s => s.id !== contextTargetId);
        }
        saveData();
        renderModernView();
        contextMenu.style.display = 'none';
    });

    // Đóng menu khi click ra ngoài
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });

    // --- LOGIC KÉO THẢ MODERN ---

    const handleModernDragStart = (e, id, type) => {
        // Lưu thông tin vào dataTransfer để dùng khi drop
        const dragData = {
            type: type === 'desktop' ? 'modern-desktop' : 'modern-dock',
            id: id
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        e.target.style.opacity = '0.5';
    };

    const handleModernDrop = (e, targetId, targetArea) => {
        e.preventDefault();
        
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;

        let dragData;
        try {
            dragData = JSON.parse(rawData);
        } catch(err) { return; }

        // --- TRƯỜNG HỢP 1: KÉO TAB MỚI (New Tab) ---
        if (dragData.type === 'new-tab') {
            const newShortcut = {
                id: generateId(),
                name: dragData.title,
                url: dragData.url,
                favIconUrl: dragData.favIconUrl || 'icons/icon16.png' // <-- PHẢI CÓ
            };

            if (targetArea === 'desktop') {
                appData.shortcuts.push(newShortcut);
            } else if (targetArea === 'dock') {
                if (targetId) {
                    const targetIndex = appData.dockShortcuts.findIndex(s => s.id === targetId);
                    // Chèn vào trước icon được thả vào
                    if (targetIndex !== -1) appData.dockShortcuts.splice(targetIndex, 0, newShortcut);
                    else appData.dockShortcuts.push(newShortcut);
                } else {
                    appData.dockShortcuts.push(newShortcut);
                }
            }
            
            saveData();
            renderModernView();
            return;
        }

        // --- TRƯỜNG HỢP 2: KÉO THẢ NỘI BỘ (Sắp xếp / Copy) ---
        
        let sourceList, targetList;
        
        // Xác định nguồn
        if (dragData.type === 'modern-desktop') sourceList = appData.shortcuts;
        else if (dragData.type === 'modern-dock') sourceList = appData.dockShortcuts;
        else return;

        // Xác định đích
        if (targetArea === 'desktop') targetList = appData.shortcuts;
        else if (targetArea === 'dock') targetList = appData.dockShortcuts;

        // Tìm phần tử đang kéo
        const draggedItemIndex = sourceList.findIndex(s => s.id === dragData.id);
        if (draggedItemIndex === -1) return;
        const draggedItem = sourceList[draggedItemIndex];

        // A. COPY TỪ DESKTOP -> DOCK
        if (dragData.type === 'modern-desktop' && targetArea === 'dock') {
            const exists = targetList.some(s => s.url === draggedItem.url);
            if (!exists) {
                const copyItem = { ...draggedItem, id: generateId() };
                if (targetId) {
                    const targetIndex = targetList.findIndex(s => s.id === targetId);
                    targetList.splice(targetIndex, 0, copyItem);
                } else {
                    targetList.push(copyItem);
                }
                saveData();
                renderModernView();
            }
            return;
        }

        // B. SẮP XẾP TRONG CÙNG DANH SÁCH (SỬA LỖI SẮP XẾP)
        if (sourceList === targetList) {
            // Nếu thả vào chính nó -> Bỏ qua
            if (targetId === dragData.id) return;

            // Nếu thả vào vùng trống (không có targetId) -> Đưa xuống cuối cùng
            if (!targetId) {
                sourceList.splice(draggedItemIndex, 1); // Xóa vị trí cũ
                sourceList.push(draggedItem);           // Thêm xuống cuối
                saveData();
                renderModernView();
                return;
            }

            // Logic sắp xếp chuẩn:
            // 1. Lấy vị trí của đích (trước khi mảng bị thay đổi)
            let targetIndex = targetList.findIndex(s => s.id === targetId);
            
            // 2. Nếu kéo từ trên xuống (index nhỏ -> lớn), vị trí đích thực tế sẽ bị giảm đi 1 sau khi xóa
            //    Nhưng logic splice chèn vào "trước" vị trí chỉ định, nên ta cần xử lý kỹ.
            
            // Cách đơn giản nhất và ít lỗi nhất:
            // Xóa phần tử cũ ra khỏi mảng
            sourceList.splice(draggedItemIndex, 1);

            // Tìm lại vị trí đích trong mảng MỚI (đã mất phần tử kéo)
            const newTargetIndex = targetList.findIndex(s => s.id === targetId);

            // Chèn vào trước vị trí đích mới tìm thấy
            if (newTargetIndex !== -1) {
                targetList.splice(newTargetIndex, 0, draggedItem);
            } else {
                targetList.push(draggedItem);
            }
            
            saveData();
            renderModernView();
            return;
        }
    };

    // Lưu cài đặt Sync
    saveSyncSettingsBtn.addEventListener('click', () => {
        const url = syncUrlInput.value.trim();
        appData.settings.syncUrl = url;
        saveData(false); // Lưu settings
        closeSyncModal();
        
        if (url) {
            // Nếu mới nhập URL, thử tải dữ liệu về
            pullDataFromCloud();
        }
    });

    manualPushBtn.addEventListener('click', pushDataToCloud);
    manualPullBtn.addEventListener('click', pullDataFromCloud);

    // --- KẾT THÚC: LOGIC CLOUD SYNC ---

    const setupModernDragDrop = () => {
        // 1. Cho Desktop Area
        desktopArea.addEventListener('dragover', (e) => e.preventDefault());
        desktopArea.addEventListener('drop', (e) => {
            // Chỉ nhận khi thả vào vùng trống
            if (e.target === desktopArea) {
                handleModernDrop(e, null, 'desktop');
            }
        });

        // 2. Cho Thanh Dock
        macosDock.addEventListener('dragover', (e) => e.preventDefault());
        macosDock.addEventListener('drop', (e) => {
            // Chỉ nhận khi thả vào vùng trống của thanh dock
            if (e.target === macosDock) {
                handleModernDrop(e, null, 'dock');
            }
        });
    };

    // Gọi hàm này 1 lần duy nhất
    setupModernDragDrop();

    // --- LOGIC THU GỌN SIDEBAR ---
    
    const applySidebarState = () => {
        const isCollapsed = appData.settings.sidebarCollapsed;
        
        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
            spacesPanel.classList.add('collapsed');
            toggleSidebarBtn.textContent = '▶'; // Đổi icon thành mở rộng
            toggleSidebarBtn.title = "Expand Sidebar";
        } else {
            document.body.classList.remove('sidebar-collapsed');
            spacesPanel.classList.remove('collapsed');
            toggleSidebarBtn.textContent = '◁'; // Đổi icon thành thu gọn
            toggleSidebarBtn.title = "Collapse Sidebar";
        }
    };

    toggleSidebarBtn.addEventListener('click', () => {
        // Đảo ngược trạng thái
        appData.settings.sidebarCollapsed = !appData.settings.sidebarCollapsed;
        applySidebarState();
        saveData(); // Lưu lại thiết lập
    });

    // --- LOGIC MACOS SPOTLIGHT ---

    const spotlightOverlay = document.getElementById('spotlight-overlay');
    const spotlightInput = document.getElementById('spotlight-input');
    const spotlightResults = document.getElementById('spotlight-results');
    const spotlightBar = document.getElementById('spotlight-bar');
    
    let spotlightSelectedIndex = 0;
    let spotlightData = []; // Mảng chứa kết quả hiển thị

    // 1. Hàm bật/tắt Spotlight
    const toggleSpotlight = () => {
        // Chỉ hoạt động ở chế độ Modern
        const interfaceMode = appData.settings.currentInterface || 'simple';
        if (viewMode !== 'home' || interfaceMode !== 'modern') return;

        if (spotlightOverlay.style.display === 'none') {
            spotlightOverlay.style.display = 'flex';
            spotlightInput.value = '';
            spotlightResults.style.display = 'none';
            spotlightBar.classList.remove('has-results');
            spotlightInput.focus();
        } else {
            spotlightOverlay.style.display = 'none';
        }
    };

    // 2. Lắng nghe phím tắt (Alt+Space hoặc Cmd+Space)
    let lastSpacePressTime = 0;

    // 2. Lắng nghe phím tắt (Nhấn Space 2 lần)
    document.addEventListener('keydown', (e) => {
        // A. Xử lý đóng Spotlight bằng ESC (Giữ nguyên)
        if (e.key === 'Escape' && spotlightOverlay.style.display === 'flex') {
            toggleSpotlight();
            return;
        }

        // B. Xử lý Double Space
        if (e.code === 'Space') {
            // Quan trọng: Không kích hoạt nếu đang gõ chữ trong ô input nào đó
            // (Trừ ô spotlight input thì cho phép để người dùng gõ dấu cách)
            const activeTag = document.activeElement.tagName;
            const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable;
            
            // Nếu đang focus vào input (mà không phải là spotlight input), thì bỏ qua logic này
            if (isInput && document.activeElement !== spotlightInput) return;

            const now = Date.now();
            // Nếu khoảng cách giữa 2 lần nhấn < 300ms (0.3 giây)
            if (now - lastSpacePressTime < 300) {
                e.preventDefault(); // Ngăn cuộn trang
                toggleSpotlight();
                lastSpacePressTime = 0; // Reset để tránh kích hoạt lần 3
            } else {
                lastSpacePressTime = now; // Ghi nhận lần nhấn đầu tiên
            }
        }
        
        // ... (Phần điều hướng mũi tên cho Spotlight đã có ở bên dưới, giữ nguyên) ...
    });

    // Đóng khi click ra ngoài vùng trắng
    spotlightOverlay.addEventListener('click', (e) => {
        if (e.target === spotlightOverlay) toggleSpotlight();
    });

    // 3. Hàm tìm kiếm tổng hợp (Đã cập nhật: Tab đang mở + Tăng giới hạn)
    const performSpotlightSearch = async (query) => {
        if (!query) {
            spotlightResults.style.display = 'none';
            spotlightBar.classList.remove('has-results');
            return;
        }

        const lowerQuery = query.toLowerCase();
        
        // A. TÌM TRONG TAB ĐANG MỞ (Open Tabs)
        const openTabs = await chrome.tabs.query({});
        const matchedTabs = openTabs.filter(tab => 
            (tab.title && tab.title.toLowerCase().includes(lowerQuery)) || 
            (tab.url && tab.url.toLowerCase().includes(lowerQuery))
        ).map(tab => ({
            id: tab.id,
            windowId: tab.windowId,
            name: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
            type: 'Open Tab',
            source: 'internal_tab' // Đánh dấu là tab đang mở
        }));

        // B. TÌM TRONG DỮ LIỆU ĐÃ LƯU (Shortcuts, Dock, Cards)
        const storageResults = [];
        
        // 1. Desktop
        appData.shortcuts.forEach(s => {
            if (s.name.toLowerCase().includes(lowerQuery) || s.url.toLowerCase().includes(lowerQuery)) {
                storageResults.push({ ...s, type: 'App', source: 'internal_storage' });
            }
        });

        // 2. Dock
        if (appData.dockShortcuts) {
            appData.dockShortcuts.forEach(s => {
                if (!storageResults.some(r => r.url === s.url)) {
                    if (s.name.toLowerCase().includes(lowerQuery) || s.url.toLowerCase().includes(lowerQuery)) {
                        storageResults.push({ ...s, type: 'Dock', source: 'internal_storage' });
                    }
                }
            });
        }

        // 3. Saved Cards
        appData.collections.forEach(col => {
            col.sections.forEach(sec => {
                sec.cards.forEach(card => {
                    if (card.title.toLowerCase().includes(lowerQuery) || card.note.toLowerCase().includes(lowerQuery)) {
                        storageResults.push({ 
                            name: card.title, 
                            url: card.url, 
                            favIconUrl: card.favIconUrl,
                            type: 'Saved', 
                            source: 'internal_storage' 
                        });
                    }
                });
            });
        });

        // Lấy tối đa 5 kết quả đã lưu (Thay vì 3 như trước)
        const topStorage = storageResults.slice(0, 5);

        // C. TÌM KIẾM GOOGLE SUGGESTIONS
        const googleSuggestions = [];
        try {
            const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();
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
        } catch (err) {}

        // D. GỘP KẾT QUẢ: Open Tabs (Đầu tiên) -> Saved Items (5 cái) -> Google
        spotlightData = [...matchedTabs, ...topStorage, ...googleSuggestions];
        renderSpotlightResults();
    };

    // 4. Render kết quả
    const renderSpotlightResults = () => {
        spotlightResults.innerHTML = '';
        
        if (spotlightData.length === 0) {
            spotlightResults.style.display = 'none';
            spotlightBar.classList.remove('has-results');
            return;
        }

        spotlightResults.style.display = 'block';
        spotlightBar.classList.add('has-results');
        spotlightSelectedIndex = 0; 

        spotlightData.forEach((item, index) => {
            // --- LOGIC CHÈN GẠCH NGANG ---
            // Nếu không phải dòng đầu tiên
            // VÀ dòng này là Google (external)
            // VÀ dòng trước đó là Nội bộ (internal)
            const isCurrentInternal = item.source === 'internal_tab' || item.source === 'internal_storage';
            const prevItem = spotlightData[index - 1];
            
            if (index > 0 && item.source === 'external' && 
               (prevItem.source === 'internal_tab' || prevItem.source === 'internal_storage')) {
                const separator = document.createElement('div');
                separator.className = 'spotlight-separator';
                spotlightResults.appendChild(separator);
            }
            // -----------------------------

            const div = document.createElement('div');
            div.className = `spotlight-item ${index === 0 ? 'selected' : ''}`;
            // Lưu ý: data-index vẫn phải khớp với chỉ số trong mảng spotlightData
            // Bất kể có separator hay không
            div.dataset.index = index;
            
            let iconHtml = '';
            
            // KIỂM TRA CẢ 2 LOẠI DỮ LIỆU NỘI BỘ MỚI
            if (item.source === 'internal_tab' || item.source === 'internal_storage') {
                const iconUrl = chrome.runtime.getURL('icons/icon16.png');
                // Sử dụng hàm thông minh để lấy icon (tab đang mở cũng có url và favIconUrl)
                const iconSrc = getSmartIconUrl(item.url, item.favIconUrl);
                iconHtml = `<img src="${iconSrc}" onerror="this.src='${iconUrl}'">`;
            } else {
                iconHtml = '🔍︎'; // Google Search không hiện icon
            }

            div.innerHTML = `
                <div class="spotlight-item-icon">${iconHtml}</div>
                <div class="spotlight-item-text">${item.name}</div>
                <div class="spotlight-item-type">${item.type}</div>
            `;

            div.addEventListener('click', () => executeSpotlightItem(item));
            div.addEventListener('mouseenter', () => {
                updateSpotlightSelection(index);
            });

            spotlightResults.appendChild(div);
        });
    };

    // 5. Điều hướng bằng bàn phím
    const updateSpotlightSelection = (index) => {
        const items = document.querySelectorAll('.spotlight-item');
        items.forEach(i => i.classList.remove('selected'));
        if (items[index]) {
            items[index].classList.add('selected');
            items[index].scrollIntoView({ block: 'nearest' });
            spotlightSelectedIndex = index;
        }
    };

    spotlightInput.addEventListener('keydown', (e) => {
        if (spotlightData.length === 0) {
            if (e.key === 'Enter') {
                // Nếu không có kết quả, Enter = Tìm Google nội dung đang nhập
                const query = spotlightInput.value.trim();
                if (query) {
                    chrome.tabs.update({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
                    toggleSpotlight();
                }
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (spotlightSelectedIndex + 1) % spotlightData.length;
            updateSpotlightSelection(nextIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (spotlightSelectedIndex - 1 + spotlightData.length) % spotlightData.length;
            updateSpotlightSelection(prevIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeSpotlightItem(spotlightData[spotlightSelectedIndex]);
        }
    });

    // Debounce input
    spotlightInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        const query = spotlightInput.value.trim();
        debounceTimeout = setTimeout(() => { performSpotlightSearch(query); }, 150);
    });

    // 6. Thực thi item
    const executeSpotlightItem = (item) => {
        if (item.source === 'internal_tab') {
            // Nếu là tab đang mở -> Chuyển tới tab đó
            chrome.tabs.update(item.id, { active: true });
            chrome.windows.update(item.windowId, { focused: true });
        } else {
            // Nếu là cái khác -> Mở tab mới
            chrome.tabs.create({ url: item.url, active: true });
        }
        toggleSpotlight();
    };

    // --- INITIALIZATION ---
    const init = async () => { 
        await loadData(); 
        
        // Đảm bảo mảng dock tồn tại
        if (!appData.dockShortcuts) appData.dockShortcuts = [];
        
        applyTheme(); 
        applyHomeTitleStyles(appData.settings.homeTitle);
        applySidebarState(); 
        renderOpenTabs(); 
        
        // Render đúng giao diện
        renderView(); 
        
        initWebSearch(webSearchInput, webSearchSuggestionsContainer); 
        initWebSearch(searchInput, headerSearchSuggestionsContainer);
        
        if (appData.settings && appData.settings.syncUrl) {
            console.log('Checking for cloud updates...');
            pullDataFromCloud();
        }
    };

    init();
});