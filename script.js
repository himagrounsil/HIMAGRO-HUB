// Konfigurasi Apps Script URL
// GANTI URL INI DENGAN URL APPS SCRIPT ANDA SETELAH DEPLOY
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw06g2lUUc2x1TeaBwub63rX9GLqDofcQxhJDgAWmXIF0tbzO1D527QAe2uSRi4pcsrkw/exec';

// Data cache
let prokerData = [];
let kontenData = [];
let scData = [];
let filteredProker = [];
let filteredKonten = [];
let masterDivisi = [];
let masterPIC = [];
let masterRapat = [];

// State management
let currentMode = 'staff'; // 'staff' or 'sc'
let currentUser = null; // { username, password }
let pendingChanges = {}; // { prokerId: { field: value } }
let currentSection = 'proker'; // 'proker' or 'konten'
let currentProkerView = 'monthly'; // 'monthly', 'all', 'calendar'
let currentKontenView = 'monthly'; // 'monthly', 'all', 'calendar'
let currentProkerMonth = null;
let currentKontenMonth = null;
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let currentKontenCalendarMonth = new Date().getMonth();
let currentKontenCalendarYear = new Date().getFullYear();

// Polling intervals for SC indicator
let presenceInterval = null;
let activeScInterval = null;
let autoSyncInterval = null;
let lastProkerDataHash = ''; // To detect changes without toast spam

// ==================== SC PRESENCE POLLING ====================

function startSCPolling() {
    if (presenceInterval) return;

    // Ping immediately
    updatePresencePing();
    fetchActiveSCs();

    // SC-specific intervals (Presence & Active list)
    presenceInterval = setInterval(updatePresencePing, 60000); // Ping presence every 1 min
    activeScInterval = setInterval(fetchActiveSCs, 30000);     // Active icons list every 30 sec
}

function stopSCPolling() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
    if (activeScInterval) {
        clearInterval(activeScInterval);
        activeScInterval = null;
    }
}

async function updatePresencePing() {
    if (currentMode !== 'sc' || !currentUser) return;
    try {
        await fetch(`${APPS_SCRIPT_URL}?action=updatePresence&scId=${encodeURIComponent(currentUser.scId)}&nama=${encodeURIComponent(currentUser.nama)}`);
    } catch (e) {
        console.error('Presence ping failed:', e);
    }
}

async function fetchActiveSCs() {
    // Both Staff and SC can see active indicator if we want, but user said "hanya pada mode sc"
    if (currentMode !== 'sc') return;

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getActiveSCs`);
        const result = await response.json();

        if (result.success) {
            const activeNames = result.data || [];
            updateActiveIndicatorUI(activeNames);
        }
    } catch (e) {
        console.error('Fetch active SCs failed:', e);
    }
}

function updateActiveIndicatorUI(names) {
    const indicator = document.getElementById('sc-active-indicator');
    const countSpan = document.getElementById('sc-active-count');
    const namesList = document.getElementById('sc-active-names');

    if (!indicator || !countSpan || !namesList) return;

    const count = names.length;
    countSpan.textContent = `${count} SC Aktif`;

    // Update tooltip list
    namesList.innerHTML = names.length > 0
        ? names.map(name => `<li>${escapeHtml(name)}</li>`).join('')
        : '<li>Tidak ada SC lain online</li>';
}

// ==================== CALENDAR DAY DETAILS ====================

function showCalendarDayDetails(dateString, type) {
    const date = new Date(dateString);
    const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][date.getDay()];
    const monthName = formatMonthName(date.getMonth());
    const formattedDate = `${dayName}, ${date.getDate()} ${monthName} ${date.getFullYear()}`;

    document.getElementById('calendar-day-title').textContent = formattedDate;

    const listContainer = document.getElementById('calendar-day-list');
    let items = [];

    if (type === 'proker') {
        items = prokerData.filter(p => p.dateObj && isSameDay(p.dateObj, date) && p.isActive !== false);
    } else {
        items = kontenData.filter(k => k.dateObj && isSameDay(k.dateObj, date));
    }

    if (items.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Tidak ada ${type} pada tanggal ini</div>`;
    } else {
        listContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${items.map(item => `
                    <div class="month-item" style="margin-bottom: 0; cursor: default; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-color);">
                        <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(item.nama)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            ${type === 'proker' ? (item.divisiId || '-') : (item.status || '-')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    document.getElementById('calendar-day-modal').classList.add('show');
}

function closeCalendarDayModal() {
    document.getElementById('calendar-day-modal').classList.remove('show');
}

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', async function () {
    initDarkMode();
    updateModeDisplay();

    // Load hanya master data dan proker data saat pertama kali (lazy loading untuk konten)
    await Promise.all([
        loadMasterData(),
        loadProkerData()
    ]);

    populateMonthFilters();
    switchSection('proker'); // Default show Proker
    hideLoading(); // Pastikan loading di-hide setelah semua data loaded

    startGlobalSync(); // Start background sync for all users
});

// ==================== GLOBAL BACKGROUND SYNC ====================

function startGlobalSync() {
    if (autoSyncInterval) return;

    console.log('Starting global background sync...');
    autoSyncInterval = setInterval(async () => {
        // Only sync if tab is visible to save resources (optional but good)
        if (document.hidden) return;

        // Background sync Proker
        await loadProkerData({ silent: true, force: true });

        // Background sync Master data (PIC, Divisi, etc)
        await loadMasterData({ silent: true });
    }, 20000); // Poll every 20 seconds
}

// ==================== MASTER DATA ====================

async function loadMasterData(options = {}) {
    const silent = options.silent || false;
    try {
        // Load Master Divisi
        const divisiResponse = await fetch(`${APPS_SCRIPT_URL}?action=getMasterDivisi&_=${Date.now()}`);
        if (!divisiResponse.ok) {
            throw new Error(`HTTP error! status: ${divisiResponse.status}`);
        }
        const divisiResult = await divisiResponse.json();
        if (divisiResult.success) {
            const oldDivisiHash = JSON.stringify(masterDivisi);
            masterDivisi = divisiResult.data || [];
            if (JSON.stringify(masterDivisi) !== oldDivisiHash) {
                populateDivisiDropdown();
            }
        }

        // Load Master PIC
        const picResponse = await fetch(`${APPS_SCRIPT_URL}?action=getMasterPIC&_=${Date.now()}`);
        if (!picResponse.ok) {
            throw new Error(`HTTP error! status: ${picResponse.status}`);
        }
        const picResult = await picResponse.json();
        if (picResult.success) {
            const oldPicHash = JSON.stringify(masterPIC);
            masterPIC = picResult.data || [];
            if (JSON.stringify(masterPIC) !== oldPicHash) {
                populatePICDropdown();
            }
        }

        // Load Master Rapat
        const rapatResponse = await fetch(`${APPS_SCRIPT_URL}?action=getMasterRapat&_=${Date.now()}`);
        if (!rapatResponse.ok) {
            throw new Error(`HTTP error! status: ${rapatResponse.status}`);
        }
        const rapatResult = await rapatResponse.json();
        if (rapatResult.success) {
            masterRapat = rapatResult.data || [];
        }

    } catch (error) {
        if (!silent) console.error('Error loading master data:', error);
        masterDivisi = masterDivisi || [];
        masterPIC = masterPIC || [];
        masterRapat = masterRapat || [];
    }
}

function populateDivisiDropdown() {
    const select = document.getElementById('proker-divisi-id');
    if (!select) return;

    // Clear existing options except first
    select.innerHTML = '<option value="">Pilih Divisi</option>';

    if (!masterDivisi || masterDivisi.length === 0) {
        console.warn('Master Divisi kosong, pastikan data sudah di-load');
        return;
    }

    masterDivisi.forEach(divisi => {
        const option = document.createElement('option');
        option.value = divisi.divisiId;
        // Tampilkan nama divisi, jika tidak ada nama tampilkan ID saja
        option.textContent = divisi.namaDivisi ? `${divisi.namaDivisi} (${divisi.divisiId})` : divisi.divisiId;
        select.appendChild(option);
    });
}

function populatePICDropdown() {
    const select = document.getElementById('proker-pic-id');
    if (!select) return;

    // Clear existing options except first
    select.innerHTML = '<option value="">Pilih PIC</option>';

    if (!masterPIC || masterPIC.length === 0) {
        console.warn('Master PIC kosong, pastikan data sudah di-load');
        return;
    }

    // Filter PIC yang memiliki nama saja (sesuai permintaan user)
    const activePICs = masterPIC.filter(pic => pic.namaPic && pic.namaPic.trim() !== '');

    activePICs.forEach(pic => {
        const option = document.createElement('option');
        option.value = pic.picId;
        option.textContent = `${pic.namaPic} (${pic.picId})`;
        select.appendChild(option);
    });
}

// ==================== DARK MODE ====================

function initDarkMode() {
    // Cek tema yang tersimpan, jika tidak ada (null/undefined) gunakan 'dark'
    let savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
        savedTheme = 'dark';
        localStorage.setItem('theme', 'dark');
    }
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeDisplay(savedTheme);
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeDisplay(newTheme);
}

function updateDarkModeDisplay(theme) {
    const icon = document.getElementById('dark-mode-icon');
    const btn = icon.parentElement;
    if (theme === 'dark') {
        icon.textContent = '☀️';
        btn.title = 'Switch to Light Mode';
    } else {
        icon.textContent = '🌙';
        btn.title = 'Switch to Dark Mode';
    }
}

// ==================== REFRESH & CACHE ====================

async function refreshData() {
    showLoading();

    // Clear cache
    localStorage.removeItem('prokerDataCache');
    localStorage.removeItem('prokerDataCache_time');
    localStorage.removeItem('kontenDataCache');
    localStorage.removeItem('kontenDataCache_time');
    sessionStorage.clear();

    prokerData = [];
    kontenData = [];
    scData = [];

    try {
        // Reload semua data secara parallel
        await Promise.all([
            loadMasterData(),
            loadProkerData(),
            loadKontenData()
        ]);
        showToast('Data berhasil di-refresh!', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error saat refresh data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function clearCache() {
    localStorage.removeItem('prokerDataCache');
    localStorage.removeItem('prokerDataCache_time');
    localStorage.removeItem('kontenDataCache');
    localStorage.removeItem('kontenDataCache_time');
    localStorage.removeItem('theme'); // Reset tema ke default (dark)
    sessionStorage.clear();
    location.reload(); // Reload halaman untuk reset semua state termasuk tema
}

// ==================== MODE MANAGEMENT ====================

function showLoginModal() {
    const saved = localStorage.getItem('sc_creds');
    if (saved) {
        try {
            const creds = JSON.parse(saved);
            document.getElementById('login-username').value = creds.u || '';
            document.getElementById('login-password').value = atob(creds.p || '');
            document.getElementById('login-remember').checked = true;
        } catch (e) { }
    }
    document.getElementById('login-modal').classList.add('show');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('show');
    // Don't reset if we want to keep auto-filled values next time, 
    // but clearing once closed is safer for privacy if not "remembered".
    if (!document.getElementById('login-remember').checked) {
        document.getElementById('login-form').reset();
    }
}

async function loginSC(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;

    if (!username || !password) {
        showToast('Username dan password harus diisi!', 'error');
        return;
    }

    if (remember) {
        localStorage.setItem('sc_creds', JSON.stringify({ u: username, p: btoa(password) }));
    } else {
        localStorage.removeItem('sc_creds');
    }

    showLoading();
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=validateLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
        const result = await response.json();

        if (result.success && result.data.valid) {
            currentUser = {
                username: result.data.username,
                scId: result.data.scId,
                nama: result.data.nama,
                email: result.data.email,
                jabatan: result.data.jabatan
            };
            currentMode = 'sc';
            closeLoginModal();
            updateModeDisplay();

            // Masuk ke section proker jika sedang di konten (karena konten dikunci di SC)
            if (currentSection === 'konten') {
                switchSection('proker');
            }

            setProkerView('all'); // Otomatis ke view 'Semua' saat login
            showToast('Berhasil masuk Mode SC! Selamat datang, ' + result.data.nama, 'success');
        } else {
            showToast(result.data?.message || 'Username atau password salah!', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
        console.error('Error validating login:', error);
    } finally {
        hideLoading();
    }
}

function logoutSC() {
    currentMode = 'staff';
    currentUser = null;
    updateModeDisplay();
    showToast('Keluar dari Mode SC', 'success');
    // Switch back to proker section if currently viewing SC
    if (currentSection !== 'proker' && currentSection !== 'konten') {
        switchSection('proker');
    }
}

function updateModeDisplay() {
    const modeBadge = document.getElementById('current-mode');
    const switchBtn = document.getElementById('switch-mode-btn'); // Renamed from loginBtn in snippet to match existing code
    const addProkerBtn = document.getElementById('add-proker-btn');
    const bulkProkerBtn = document.getElementById('bulk-proker-btn'); // New
    const welcomeBanner = document.getElementById('welcome-banner');
    const welcomeTitle = welcomeBanner?.querySelector('h2');
    const welcomeSubtitle = welcomeBanner?.querySelector('p');
    const kontenTab = document.getElementById('tab-konten');
    const indicator = document.getElementById('sc-active-indicator'); // New
    const bulkHeader = document.querySelectorAll('.sc-only-header'); // New

    if (currentMode === 'sc') {
        if (currentUser && currentUser.nama) {
            modeBadge.textContent = `Mode: SC (${currentUser.nama})`;
        } else {
            modeBadge.textContent = 'Mode: SC';
        }
        modeBadge.className = 'mode-badge sc-active';
        switchBtn.textContent = 'Keluar Mode SC';
        switchBtn.onclick = logoutSC;
        addProkerBtn.style.display = 'inline-flex';
        bulkProkerBtn.style.display = 'inline-flex';

        if (kontenTab) {
            kontenTab.style.pointerEvents = 'none';
            kontenTab.style.opacity = '0.5';
            kontenTab.style.cursor = 'not-allowed';
        }
        if (welcomeTitle && currentUser) {
            welcomeTitle.textContent = `Selamat datang ${currentUser.nama || currentUser.username} di Mode Steering Committee`;
        }
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Anda dapat mengedit program kerja dalam mode ini';
        }

        indicator.style.display = 'flex';
        bulkHeader.forEach(el => el.style.display = 'table-cell');
        startSCPolling();
    } else {
        modeBadge.textContent = 'Mode: Staff';
        modeBadge.className = 'mode-badge';
        switchBtn.textContent = 'Masuk Mode SC';
        switchBtn.onclick = showLoginModal;
        addProkerBtn.style.display = 'none';
        bulkProkerBtn.style.display = 'none';

        if (kontenTab) {
            kontenTab.style.pointerEvents = 'auto';
            kontenTab.style.opacity = '1';
            kontenTab.style.cursor = 'pointer';
        }
        if (welcomeTitle) {
            welcomeTitle.textContent = 'Selamat datang di HIMAGRO HUB';
        }
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Dashboard monitoring Program Kerja dan Konten Media Sosial HIMAGRO';
        }

        indicator.style.display = 'none';
        bulkHeader.forEach(el => el.style.display = 'none');
        document.getElementById('proker-bulk-actions').style.display = 'none';
        stopSCPolling();
    }

    // Lock/Unlock Proker Views
    const prokerViewButtons = document.querySelectorAll('#proker-section .view-btn');
    prokerViewButtons.forEach(btn => {
        const view = btn.dataset.view;
        if (currentMode === 'sc' && (view === 'monthly' || view === 'calendar')) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Mode ini dikunci saat dalam Mode SC';
        } else {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.title = '';
        }
    });

    // Re-render current section to update button visibility
    if (currentSection === 'proker') {
        renderProkerView();
    } else {
        renderKontenView();
    }
}

// ==================== SECTION SWITCHER ====================

async function switchSection(section) {
    // Cek jika di SC mode dan mencoba akses konten
    if (currentMode === 'sc' && section === 'konten') {
        showToast('Tab Konten tidak tersedia di Mode SC', 'error');
        return;
    }

    currentSection = section;

    // Update tab buttons
    document.getElementById('tab-proker').classList.toggle('active', section === 'proker');
    document.getElementById('tab-konten').classList.toggle('active', section === 'konten');

    // Show/hide sections
    document.getElementById('proker-section').style.display = section === 'proker' ? 'block' : 'none';
    document.getElementById('konten-section').style.display = section === 'konten' ? 'block' : 'none';

    // Lazy load konten data hanya saat user klik section konten
    if (section === 'konten' && kontenData.length === 0) {
        showLoading();
        try {
            await loadKontenData();
            populateMonthFilters(); // Update month filters setelah konten data loaded
        } catch (error) {
            console.error('Error loading konten data:', error);
        } finally {
            hideLoading();
        }
    }

    // Render sesuai section
    if (section === 'proker') {
        renderProkerView();
    } else if (section === 'konten') {
        renderKontenView();
    }
}

// ==================== PROKER FUNCTIONS (CRUD) ====================

async function loadProkerData(options = {}) {
    const force = typeof options === 'boolean' ? options : (options.force || false);
    const silent = options.silent || false;
    const cacheKey = 'prokerDataCache';
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const now = Date.now();

    // Use cache if valid and NOT forced
    if (!force && !silent && cacheTime && (now - parseInt(cacheTime)) < 300000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                processProkerData(cachedData);
                console.log('Loaded proker data from cache');
                return;
            } catch (e) { console.error('Error parsing cache:', e); }
        }
    }

    if (!silent) showLoading();
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getProker&_=${now}`);
        const result = await response.json();

        if (result.success) {
            const currentHash = JSON.stringify(result.data);
            const isDifferent = currentHash !== lastProkerDataHash;

            if (isDifferent || force) {
                processProkerData(result.data);

                // Show notification if data changed in background
                if (silent && isDifferent && lastProkerDataHash !== '') {
                    showToast('Data baru sudah terupdate otomatis', 'success');
                }

                lastProkerDataHash = currentHash;
                localStorage.setItem(cacheKey, currentHash);
                localStorage.setItem(cacheKey + '_time', now.toString());
            }
        } else if (!silent) {
            showToast('Gagal memuat data Proker: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error loading proker:', error);
        if (!silent) showToast('Error: ' + error.message, 'error');
    } finally {
        if (!silent) hideLoading();
    }
}

// Helper to process and render proker data
function processProkerData(data) {
    prokerData = data.map(item => {
        let dateObj = null;
        if (item.tanggal) {
            if (item.tanggal.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const parts = item.tanggal.split('/');
                dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                dateObj = new Date(item.tanggal + 'T00:00:00');
            }
        }
        return { ...item, dateObj: dateObj };
    });

    // CRITICAL: Merge pending locally-made changes so they aren't lost on reload
    Object.keys(pendingChanges).forEach(id => {
        const idx = prokerData.findIndex(p => p.id === id);
        if (idx !== -1) {
            Object.assign(prokerData[idx], pendingChanges[id]);
        }
    });

    filteredProker = [...prokerData];
    sortProkerByMonth();
    applyFilters(); // This will trigger renderProkerView
}

function sortProkerByMonth() {
    filteredProker.sort((a, b) => {
        if (!a.dateObj && !b.dateObj) return 0;
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        return b.dateObj - a.dateObj;
    });
}

function setProkerView(view) {
    currentProkerView = view;
    document.querySelectorAll('#proker-section .view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });

    document.getElementById('proker-month-filter').style.display =
        view === 'monthly' ? 'flex' : 'none';

    document.getElementById('proker-monthly-view').style.display =
        view === 'monthly' ? 'block' : 'none';
    document.getElementById('proker-all-view').style.display =
        view === 'all' ? 'block' : 'none';
    document.getElementById('proker-calendar-view').style.display =
        view === 'calendar' ? 'block' : 'none';

    renderProkerView();
}

function renderProkerView() {
    if (currentProkerView === 'monthly') {
        renderProkerMonthly();
    } else if (currentProkerView === 'all') {
        renderProkerTable();
    } else if (currentProkerView === 'calendar') {
        renderProkerCalendar();
    }
}

function renderProkerMonthly() {
    const container = document.getElementById('proker-monthly-content');

    // Use filteredProker directly (it's already filtered by month and search in applyFilters)
    const grouped = groupByMonth(filteredProker);

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = '<div class="loading">Tidak ada data</div>';
        return;
    }

    let html = '';
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Sort bulan dari terbaru ke terlama
    const months = Object.keys(grouped).map(m => parseInt(m)).sort((a, b) => b - a);

    const canEdit = currentMode === 'sc';

    months.forEach(monthIndex => {

        const monthName = monthNames[monthIndex];
        const monthData = grouped[monthIndex];

        // Sort data dalam bulan berdasarkan tanggal (terbaru dulu)
        monthData.sort((a, b) => {
            if (!a.dateObj && !b.dateObj) return 0;
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        });

        html += `
            <div class="month-group">
                <div class="month-header">
                    <span>${monthName}</span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">
                        ${monthData.length} proker
                    </span>
                </div>
                <div class="month-content">
                    ${monthData.map(proker => `
                        <div class="month-item ${proker.statusSelesai ? 'status-success' : ''}" data-proker-id="${proker.id}" onclick="toggleProkerDetail('${proker.id}')" style="cursor: pointer;">
                            <div class="month-item-header">
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                                    <button class="detail-toggle-btn" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}')" id="detail-toggle-${proker.id}" title="Tampilkan detail">
                                        <span class="detail-toggle-icon">▼</span>
                                    </button>
                                    <div class="month-item-title" style="flex: 1;">
                                        ${escapeHtml(proker.nama || '')}
                                    </div>
                                </div>
                                <div class="month-item-meta" onclick="event.stopPropagation();">
                                    ${proker.statusSelesai ? `
                                        <span class="status-badge status-completed">Selesai</span>
                                    ` : ''}
                                    <span>${formatDate(proker.tanggal || '')}</span>
                                </div>
                            </div>
                            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;" onclick="event.stopPropagation();">
                                ${canEdit ? `
                                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                                            <input type="checkbox" ${proker.proposal ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'proposal', this.checked)">
                                            <span>Proposal</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                                            <input type="checkbox" ${proker.rak ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'rak', this.checked)">
                                            <span>RAK</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                                            <input type="checkbox" ${proker.rab ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'rab', this.checked)">
                                            <span>RAB</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                                            <input type="checkbox" ${proker.lpj ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'lpj', this.checked)">
                                            <span>LPJ</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                                            <input type="checkbox" ${proker.statusSelesai ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'statusSelesai', this.checked)">
                                            <span>Selesai</span>
                                        </label>
                                    </div>
                                ` : ''}
                                ${canEdit ? `
                                    <button class="btn btn-edit" onclick="event.stopPropagation(); editProker('${proker.id}')">Edit</button>
                                    <button class="btn btn-danger" onclick="event.stopPropagation(); deleteProker('${proker.id}')">Hapus</button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderProkerTable() {
    const tbody = document.getElementById('proker-tbody');
    const canEdit = currentMode === 'sc';

    if (filteredProker.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Tidak ada data</td></tr>';
        return;
    }

    if (canEdit) {
        tbody.innerHTML = filteredProker.map((proker, index) => `
            <tr class="${proker.statusSelesai ? 'status-success' : ''}" data-proker-id="${proker.id}" onclick="toggleProkerDetail('${proker.id}')" style="cursor: pointer;">
                <td class="sc-only-header" onclick="event.stopPropagation();" style="text-align: center;">
                    <input type="checkbox" class="proker-checkbox" value="${proker.id}" onchange="updateBulkActionUI()">
                </td>
                <td>${index + 1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button class="detail-toggle-btn" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}')" id="detail-toggle-${proker.id}" title="Tampilkan detail">
                            <span class="detail-toggle-icon">▼</span>
                        </button>
                        <span>${escapeHtml(proker.nama || '')}</span>
                    </div>
                </td>
                <td onclick="event.stopPropagation();">${escapeHtml(proker.divisiId || '-')}</td>
                <td onclick="event.stopPropagation();">${formatDate(proker.tanggal || '')}</td>
                <td onclick="event.stopPropagation();">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                            <input type="checkbox" ${proker.proposal ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'proposal', this.checked)">
                            <span>P</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                            <input type="checkbox" ${proker.rak ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'rak', this.checked)">
                            <span>RAK</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                            <input type="checkbox" ${proker.rab ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'rab', this.checked)">
                            <span>RAB</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                            <input type="checkbox" ${proker.lpj ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'lpj', this.checked)">
                            <span>LPJ</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                            <input type="checkbox" ${proker.statusSelesai ? 'checked' : ''} onchange="updateProkerCheckbox('${proker.id}', 'statusSelesai', this.checked)">
                            <span>Selesai</span>
                        </label>
                    </div>
                </td>
                <td onclick="event.stopPropagation();">
                    <div class="btn-group">
                        <button class="btn btn-edit" onclick="event.stopPropagation(); editProker('${proker.id}')">Edit</button>
                        <button class="btn btn-danger" onclick="event.stopPropagation(); deleteProker('${proker.id}')">Hapus</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = filteredProker.map((proker, index) => `
            <tr class="${proker.statusSelesai ? 'status-success' : ''}" data-proker-id="${proker.id}" onclick="toggleProkerDetail('${proker.id}')" style="cursor: pointer;">
                <td class="sc-only-header" style="display: none;"></td>
                <td>${index + 1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button class="detail-toggle-btn" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}')" id="detail-toggle-${proker.id}" title="Tampilkan detail">
                            <span class="detail-toggle-icon">▼</span>
                        </button>
                        <a href="#" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}'); return false;" style="color: var(--primary-color); text-decoration: underline;">${escapeHtml(proker.nama || '')}</a>
                    </div>
                </td>
                <td onclick="event.stopPropagation();">${escapeHtml(proker.divisiId || '-')}</td>
                <td onclick="event.stopPropagation();">${formatDate(proker.tanggal || '')}</td>
                <td onclick="event.stopPropagation();">${proker.statusSelesai ? '<span class="status-badge status-completed">Selesai</span>' : ''}</td>
                <td onclick="event.stopPropagation();">
                    <button class="btn btn-sm" style="background: var(--primary-color); color: white; padding: 0.5rem 1rem;" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}')">Detail</button>
                </td>
            </tr>
        `).join('');
    }
}

function renderProkerCalendar() {
    const container = document.getElementById('calendar-container');
    const monthYear = document.getElementById('calendar-month-year');

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    monthYear.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;

    const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let html = '<div class="calendar-grid">';

    // Day headers
    const dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Calendar days
    const currentDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
        const isCurrentMonth = currentDate.getMonth() === currentCalendarMonth;
        const isToday = isSameDay(currentDate, new Date());
        const dayProker = filteredProker.filter(p => {
            if (!p.dateObj || isNaN(p.dateObj.getTime())) return false;
            return isSameDay(p.dateObj, currentDate);
        });

        html += `
            <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
                 onclick="showCalendarDayDetails('${currentDate.toDateString()}', 'proker')"
                 style="cursor: pointer;">
                <div class="calendar-day-number">${currentDate.getDate()}</div>
                ${dayProker.length > 0 ? `
                    <div class="calendar-day-events">
                        ${dayProker.length} proker
                    </div>
                    ${dayProker.slice(0, 2).map(p => `
                        <div class="calendar-event-item ${p.statusSelesai ? 'status-success' : ''}" title="${escapeHtml(p.nama)}">
                            ${escapeHtml(p.nama.substring(0, 15))}${p.nama.length > 15 ? '...' : ''}
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;

        currentDate.setDate(currentDate.getDate() + 1);
    }

    html += '</div>';
    container.innerHTML = html;
}

function changeCalendarMonth(delta) {
    currentCalendarMonth += delta;
    if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    } else if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    }
    renderProkerCalendar();
}

function filterProkerByMonth() {
    const select = document.getElementById('proker-month-select');
    currentProkerMonth = select.value || null;
    renderProkerMonthly();
}

// Fungsi untuk apply filters dan render (untuk mengganti applyFilters yang hilang)
function applyFilters() {
    const searchTerm = document.getElementById('proker-search')?.value.toLowerCase() || '';
    const monthFilter = (currentProkerMonth !== null && currentProkerMonth !== "") ? parseInt(currentProkerMonth) : null;

    filteredProker = prokerData.filter(p => {
        // 1. Check if active
        if (p.isActive === false) return false;

        // 2. Filter by Month (if specified)
        if (monthFilter !== null && (!p.dateObj || p.dateObj.getMonth() !== monthFilter)) {
            return false;
        }

        // 3. Filter by Search
        if (searchTerm) {
            const matches = (p.nama || '').toLowerCase().includes(searchTerm) ||
                (p.id || '').toLowerCase().includes(searchTerm) ||
                (p.divisiId || '').toLowerCase().includes(searchTerm) ||
                (p.picId || '').toLowerCase().includes(searchTerm);
            if (!matches) return false;
        }

        return true;
    });

    sortProkerByMonth();
    renderProkerView();
}

function populateMonthFilters() {
    const prokerSelect = document.getElementById('proker-month-select');
    const kontenSelect = document.getElementById('konten-month-select');

    if (!prokerSelect || !kontenSelect) return;

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    prokerSelect.innerHTML = '';
    kontenSelect.innerHTML = '';

    const now = new Date();
    const currentMonthIndex = now.getMonth();

    monthNames.forEach((name, index) => {
        // Proker Option
        const optProker = document.createElement('option');
        optProker.value = index;
        optProker.textContent = name;
        if (index === currentMonthIndex) {
            optProker.selected = true;
            currentProkerMonth = index.toString();
        }
        prokerSelect.appendChild(optProker);

        // Konten Option
        const optKonten = document.createElement('option');
        optKonten.value = index;
        optKonten.textContent = name;
        if (index === currentMonthIndex) {
            optKonten.selected = true;
            currentKontenMonth = index.toString();
        }
        kontenSelect.appendChild(optKonten);
    });

    // Trigger filter jika sudah ada data
    if (prokerData.length > 0) filterProkerByMonth();
    if (kontenData.length > 0) filterKontenByMonth();
}

function groupByMonth(data) {
    const grouped = {};
    data.forEach(item => {
        if (!item.dateObj || isNaN(item.dateObj.getTime())) return;
        const monthIndex = item.dateObj.getMonth(); // 0-11
        if (!grouped[monthIndex]) {
            grouped[monthIndex] = [];
        }
        grouped[monthIndex].push(item);
    });
    return grouped;
}

function formatMonthName(monthIndex) {
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return monthNames[parseInt(monthIndex)] || '';
}

function formatDateForFilter(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

const debouncedSearchProker = debounce(() => {
    const searchTerm = document.getElementById('proker-search').value.toLowerCase();

    // Use filteredProker from applyFilters logic for consistency
    applyFilters();
}, 300);

function searchProker() {
    debouncedSearchProker();
}

async function showAddProkerModal() {
    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk menambahkan data', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Silakan login ke Mode SC terlebih dahulu', 'error');
        return;
    }

    // Pastikan master data sudah di-load
    if (!masterRapat || masterRapat.length === 0) {
        showLoading();
        try {
            await loadMasterData();
        } catch (error) {
            console.error('Error loading master data:', error);
        } finally {
            hideLoading();
        }
    }

    document.getElementById('modal-title').textContent = 'Tambah Proker Baru';
    document.getElementById('proker-form').reset();
    document.getElementById('proker-id').value = '';
    document.getElementById('proker-divisi-id').value = '';
    document.getElementById('proker-pic-id').value = '';
    document.getElementById('proker-tanggal').valueAsDate = new Date();
    document.getElementById('proker-proposal').checked = false;
    document.getElementById('proker-rak').checked = false;
    document.getElementById('proker-rab').checked = false;
    document.getElementById('proker-lpj').checked = false;
    document.getElementById('proker-status-selesai').checked = false;

    // Clear rapat forms
    const rapatContainer = document.getElementById('rapat-forms-container');
    if (rapatContainer) {
        rapatContainer.innerHTML = '';
    }
    rapatFormCounter = 0;

    document.getElementById('proker-modal').classList.add('show');
}

async function editProker(id) {
    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk mengubah data', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Silakan login ke Mode SC terlebih dahulu', 'error');
        return;
    }

    const proker = prokerData.find(p => p.id === id);
    if (!proker) return;

    // Load detail proker untuk mendapatkan data rapat
    showLoading();
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getProkerDetail&id=${encodeURIComponent(id)}`);
        const result = await response.json();

        if (result.success) {
            const detail = result.data;
            const prokerData = detail.proker;
            const rapatData = detail.rapat || [];

            document.getElementById('modal-title').textContent = 'Edit Proker';
            document.getElementById('proker-id').value = prokerData.id;
            document.getElementById('proker-nama').value = prokerData.nama || '';
            document.getElementById('proker-divisi-id').value = prokerData.divisiId || '';
            document.getElementById('proker-pic-id').value = prokerData.picId || '';

            // Convert DD/MM/YYYY ke YYYY-MM-DD untuk input date
            const tanggalInput = convertDateForInput(prokerData.tanggal || '');
            document.getElementById('proker-tanggal').value = tanggalInput;

            document.getElementById('proker-proposal').checked = prokerData.proposal || false;
            document.getElementById('proker-rak').checked = prokerData.rak || false;
            document.getElementById('proker-rab').checked = prokerData.rab || false;
            document.getElementById('proker-lpj').checked = prokerData.lpj || false;
            document.getElementById('proker-status-selesai').checked = prokerData.statusSelesai || false;

            // Load rapat forms
            const container = document.getElementById('rapat-forms-container');
            container.innerHTML = '';
            rapatFormCounter = 0;

            rapatData.forEach(rapat => {
                const formId = 'rapat-form-' + rapatFormCounter++;
                const rapatForm = document.createElement('div');
                rapatForm.className = 'rapat-item-form';
                rapatForm.id = formId;

                const tanggalRapInput = convertDateForInput(rapat.tanggalRap || '');

                rapatForm.innerHTML = `
                    <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: var(--bg-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <strong>Rapat ${rapatFormCounter}</strong>
                            <button type="button" class="btn btn-sm btn-danger" onclick="removeRapatForm('${formId}')">Hapus</button>
                        </div>
                        <div class="form-group">
                            <label>Jenis Rapat *</label>
                            <select class="rapat-jenis-select" required>
                                <option value="">Pilih Jenis Rapat</option>
                                ${masterRapat.map(r => `<option value="${escapeHtml(r.jenisRapat)}" ${r.jenisRapat === rapat.jenisRapat ? 'selected' : ''}>${escapeHtml(r.jenisRapat)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Tanggal Rapat *</label>
                            <input type="date" class="rapat-tanggal-input" value="${tanggalRapInput}" required>
                        </div>

                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                            <em>PIC: ${escapeHtml(rapat.pic || '-')} | Email: ${escapeHtml(rapat.picEmail || '-')}</em>
                        </p>
                    </div>
                `;

                container.appendChild(rapatForm);
            });

            document.getElementById('proker-modal').classList.add('show');
        }
    } catch (error) {
        showToast('Error loading proker detail: ' + error.message, 'error');
        console.error('Error loading proker detail:', error);
    } finally {
        hideLoading();
    }
}

// Toggle detail proker (expandable, bukan modal)
function toggleProkerDetail(id) {
    if (!id) return;

    const detailId = `proker-detail-${id}`;

    // Find the proker item based on current view to ensure we toggle the one in front of us
    let prokerItem = null;
    if (currentProkerView === 'monthly') {
        prokerItem = document.querySelector(`#proker-monthly-content .month-item[data-proker-id="${id}"]`);
    } else if (currentProkerView === 'all') {
        prokerItem = document.querySelector(`#proker-tbody tr[data-proker-id="${id}"]`);
    }

    // If we have the proker item, check its immediate next sibling
    const detailElement = prokerItem ? prokerItem.nextElementSibling : null;
    const isMatchingDetail = detailElement && detailElement.id === detailId;

    const toggleBtn = document.getElementById(`detail-toggle-${id}`);
    const toggleIcon = toggleBtn?.querySelector('.detail-toggle-icon');

    if (isMatchingDetail) {
        const isHidden = detailElement.style.display === 'none' ||
            detailElement.querySelector('div')?.style.maxHeight === '0px' ||
            detailElement.style.maxHeight === '0px';

        if (isHidden) {
            // Buka detail
            detailElement.style.display = 'block';
            requestAnimationFrame(() => {
                detailElement.style.maxHeight = detailElement.scrollHeight + 'px';
                detailElement.style.opacity = '1';
            });
            // Ubah segitiga ke atas
            if (toggleIcon) {
                toggleIcon.textContent = '▲';
                toggleIcon.classList.add('open');
            }
        } else {
            // Tutup detail
            detailElement.style.maxHeight = '0px';
            detailElement.style.opacity = '0';
            setTimeout(() => {
                detailElement.style.display = 'none';
            }, 300);
            // Ubah segitiga ke bawah
            if (toggleIcon) {
                toggleIcon.textContent = '▼';
                toggleIcon.classList.remove('open');
            }
        }
        return;
    }

    // Get proker data from local cache
    const proker = prokerData.find(p => p.id === id);
    if (!proker) {
        console.error('Proker not found in cache:', id, 'Total proker:', prokerData.length);
        showToast('Proker tidak ditemukan', 'error');
        return;
    }

    // Load rapat data if needed
    loadProkerDetailInline(id, proker);
}

async function loadProkerDetailInline(id, proker) {
    // 1. Render immediately with basic info and EMPTY rapat list to show loading state
    renderProkerDetailInline(id, proker, null);

    try {
        // Get rapat data
        const encodedId = encodeURIComponent(id);
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getProkerDetail&id=${encodedId}`);
        const result = await response.json();

        let rapatList = [];
        if (result.success && result.data.rapat) {
            rapatList = result.data.rapat.filter(r => r.aktif !== false); // Filter hanya yang aktif
        }

        // 2. Re-render with fetched rapat data (update only, don't re-toggle)
        renderProkerDetailInline(id, proker, rapatList, true);

        // Update tombol segitiga jika belum set
        const toggleBtn = document.getElementById(`detail-toggle-${id}`);
        const toggleIcon = toggleBtn?.querySelector('.detail-toggle-icon');
        if (toggleIcon && !toggleIcon.classList.contains('open')) {
            toggleIcon.textContent = '▲';
            toggleIcon.classList.add('open');
        }
    } catch (error) {
        console.error('Error loading rapat:', error);
        // Render tanpa rapat jika error (update only)
        renderProkerDetailInline(id, proker, [], true);

        // Update tombol segitiga
        const toggleBtn = document.getElementById(`detail-toggle-${id}`);
        const toggleIcon = toggleBtn?.querySelector('.detail-toggle-icon');
        if (toggleIcon && !toggleIcon.classList.contains('open')) {
            toggleIcon.textContent = '▲';
            toggleIcon.classList.add('open');
        }
    }
}

function renderProkerDetailInline(id, proker, rapatList, isUpdate = false) {
    const detailId = `proker-detail-${id}`;

    // Get divisi and PIC names
    const divisi = masterDivisi.find(d => d.divisiId === proker.divisiId);
    const pic = masterPIC.find(p => p.picId === proker.picId);

    const html = `
        <div class="proker-detail-content" style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
            <h4 style="margin-top: 0; margin-bottom: 1rem;">Detail Proker</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong>Nama Proker:</strong><br>
                    <span>${escapeHtml(proker.nama || '-')}</span>
                </div>
                <div>
                    <strong>Tanggal:</strong><br>
                    <span>${formatDate(proker.tanggal || '')}</span>
                </div>
                <div>
                    <strong>Status:</strong><br>
                    <span class="status-badge ${proker.statusSelesai ? 'status-completed' : 'status-active'}">
                        ${proker.statusSelesai ? 'Selesai' : 'Belum Selesai'}
                    </span>
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Progress:</strong><br>
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
                    <span>Proposal: ${proker.proposal ? '✓' : '✗'}</span>
                    <span>RAK: ${proker.rak ? '✓' : '✗'}</span>
                    <span>RAB: ${proker.rab ? '✓' : '✗'}</span>
                    <span>LPJ: ${proker.lpj ? '✓' : '✗'}</span>
                </div>
            </div>
            ${rapatList === null ? `
                <div style="padding: 1rem; text-align: center; color: var(--text-secondary);">
                    <div class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0 auto 0.5rem;"></div>
                    Memuat data rapat...
                </div>
            ` : rapatList.length > 0 ? `
                <div>
                    <strong>Data Rapat:</strong>
                    <div style="margin-top: 0.5rem;">
                        ${rapatList.map(r => `
                            <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-color);">
                                <strong style="color: var(--primary-color); display: block; margin-bottom: 0.25rem;">${escapeHtml(r.jenisRapat || '-')}</strong>
                                <div style="font-size: 0.875rem; color: var(--text-secondary); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem;">
                                    <span><strong>Tanggal:</strong> ${formatDate(r.tanggalRap || '')}</span>
                                    <span><strong>PIC:</strong> ${escapeHtml(r.pic || '-')}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '<p style="color: var(--text-secondary); margin: 0;">Tidak ada data rapat</p>'}
        </div>
    `;

    // Find the proker item based on current view
    let prokerItem = null;
    if (currentProkerView === 'monthly') {
        const container = document.getElementById('proker-monthly-content');
        prokerItem = container.querySelector(`.month-item[data-proker-id="${id}"]`);
    } else if (currentProkerView === 'all') {
        const tbody = document.getElementById('proker-tbody');
        prokerItem = tbody.querySelector(`tr[data-proker-id="${id}"]`);
    }

    if (!prokerItem) return;

    // IMPORTANT: Check for existing detail WITHIN the active container only
    const existingDetail = prokerItem.nextElementSibling && prokerItem.nextElementSibling.id === detailId ? prokerItem.nextElementSibling : null;

    if (existingDetail && !isUpdate) {
        // Toggle: remove if exists (only if NOT an update)
        existingDetail.style.maxHeight = '0px';
        existingDetail.style.opacity = '0';
        setTimeout(() => {
            existingDetail.remove();
        }, 300);
    } else if (existingDetail && isUpdate) {
        // Update mode: replace content but keep structure/animation state
        if (prokerItem.tagName === 'TR') {
            const cell = existingDetail.cells[0];
            const detailDiv = cell.querySelector('.proker-detail-expanded'); // This is the animating div
            detailDiv.innerHTML = html;
            if (detailDiv.style.maxHeight !== '0px') {
                detailDiv.style.maxHeight = detailDiv.scrollHeight + 'px';
            }
        } else {
            existingDetail.innerHTML = html;
            if (existingDetail.style.maxHeight !== '0px') {
                existingDetail.style.maxHeight = existingDetail.scrollHeight + 'px';
            }
        }
    } else {
        // Insert detail after the item dengan animasi
        if (prokerItem.tagName === 'TR') {
            const tbody = prokerItem.parentElement;
            const newRow = tbody.insertRow(prokerItem.sectionRowIndex + 1);
            newRow.id = detailId;
            const cell = newRow.insertCell(0);
            cell.colSpan = 6;
            cell.style.padding = '0';
            const detailDiv = document.createElement('div');
            detailDiv.className = 'proker-detail-expanded';
            detailDiv.innerHTML = html;
            detailDiv.style.maxHeight = '0px';
            detailDiv.style.opacity = '0';
            detailDiv.style.overflow = 'hidden';
            cell.appendChild(detailDiv);

            // Wait for next frame to start animation
            setTimeout(() => {
                detailDiv.style.maxHeight = detailDiv.scrollHeight + 'px';
                detailDiv.style.opacity = '1';
            }, 10);
        } else {
            const detailDiv = document.createElement('div');
            detailDiv.id = detailId;
            detailDiv.className = 'proker-detail-expanded';
            detailDiv.innerHTML = html;
            detailDiv.style.maxHeight = '0px';
            detailDiv.style.opacity = '0';
            detailDiv.style.overflow = 'hidden';
            detailDiv.style.marginTop = '0.5rem';
            prokerItem.insertAdjacentElement('afterend', detailDiv);

            setTimeout(() => {
                detailDiv.style.maxHeight = detailDiv.scrollHeight + 'px';
                detailDiv.style.opacity = '1';
            }, 10);
        }
    }
}

function renderProkerDetailModal(detail) {
    const modal = document.getElementById('proker-detail-modal');
    const proker = detail.proker;
    const rapat = detail.rapat || [];

    document.getElementById('detail-proker-nama').textContent = proker.nama || '-';
    document.getElementById('detail-proker-id').textContent = proker.id || '-';
    document.getElementById('detail-proker-divisi').textContent = proker.divisiId || '-';
    document.getElementById('detail-proker-pic').textContent = proker.picId || '-';
    document.getElementById('detail-proker-tanggal').textContent = formatDate(proker.tanggal) || '-';
    document.getElementById('detail-proker-proposal').textContent = proker.proposal ? '✓' : '✗';
    document.getElementById('detail-proker-rak').textContent = proker.rak ? '✓' : '✗';
    document.getElementById('detail-proker-rab').textContent = proker.rab ? '✓' : '✗';
    document.getElementById('detail-proker-lpj').textContent = proker.lpj ? '✓' : '✗';
    document.getElementById('detail-proker-status').textContent = proker.statusSelesai ? 'Selesai' : 'Belum Selesai';

    // Render rapat list
    const rapatContainer = document.getElementById('detail-rapat-list');
    if (rapat.length === 0) {
        rapatContainer.innerHTML = '<p style="color: var(--text-secondary);">Tidak ada data rapat</p>';
    } else {
        rapatContainer.innerHTML = rapat.map(r => `
            <div class="rapat-item">
                <div class="rapat-header">
                    <strong>${escapeHtml(r.jenisRapat || '-')}</strong>

                </div>
                <div class="rapat-meta">
                    <span>Tanggal: ${formatDate(r.tanggalRap)}</span>
                    <span>PIC: ${escapeHtml(r.pic || '-')}</span>
                </div>
            </div>
        `).join('');
    }

    modal.classList.add('show');
}

function closeProkerModal() {
    document.getElementById('proker-modal').classList.remove('show');
    // Clear rapat forms
    document.getElementById('rapat-forms-container').innerHTML = '';
    rapatFormCounter = 0;
}

let bulkProkerCounter = 0;

function showBulkProkerModal() {
    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk fitur ini', 'error');
        return;
    }
    const container = document.getElementById('bulk-proker-forms-container');
    container.innerHTML = '';
    bulkProkerCounter = 0;

    // Add first 2 forms by default
    addBulkProkerForm();
    addBulkProkerForm();

    document.getElementById('bulk-proker-modal').classList.add('show');
}

function closeBulkProkerModal() {
    document.getElementById('bulk-proker-modal').classList.remove('show');
}

function addBulkProkerForm() {
    const container = document.getElementById('bulk-proker-forms-container');
    const formId = 'bulk-proker-form-' + bulkProkerCounter++;

    const div = document.createElement('div');
    div.className = 'bulk-proker-item-form';
    div.id = formId;
    div.innerHTML = `
        <div style="border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; background: var(--bg-color); position: relative; animation: fadeIn 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <strong style="color: var(--primary-color);">Proker #${bulkProkerCounter}</strong>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeBulkProkerForm('${formId}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Hapus Proker</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Nama Proker *</label>
                    <input type="text" class="bulk-nama" placeholder="Masukkan nama proker" required>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Tanggal Pelaksanaan *</label>
                    <input type="date" class="bulk-tanggal" required>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Divisi</label>
                    <select class="bulk-divisi">
                        <option value="">Pilih Divisi</option>
                        ${masterDivisi.map(d => `<option value="${d.divisiId}">${d.namaDivisi}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>PIC</label>
                    <select class="bulk-pic">
                        <option value="">Pilih PIC</option>
                        ${masterPIC.map(p => `<option value="${p.picId}">${p.namaPic}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Rapat Section for Bulk Proker -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: 1rem; border: 1px dashed var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h5 style="margin: 0; font-size: 0.9rem;">Data Rapat Proker #${bulkProkerCounter}</h5>
                    <button type="button" class="btn btn-sm btn-success" onclick="addRapatToBulkItem('${formId}')" style="font-size: 0.7rem; padding: 0.25rem 0.6rem;">
                        + Tambah Rapat
                    </button>
                </div>
                <div class="bulk-rapat-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
                    <!-- Rapat sub-forms go here -->
                </div>
            </div>
        </div>
    `;

    container.appendChild(div);
    // Smooth scroll to bottom
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function removeBulkProkerForm(formId) {
    const el = document.getElementById(formId);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.95)';
        setTimeout(() => el.remove(), 200);
    }
}

function addRapatToBulkItem(prokerFormId) {
    const parentForm = document.getElementById(prokerFormId);
    const container = parentForm.querySelector('.bulk-rapat-container');
    const subFormId = 'bulk-rapat-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const div = document.createElement('div');
    div.id = subFormId;
    div.style.background = 'var(--bg-color)';
    div.style.padding = '0.75rem';
    div.style.borderRadius = '8px';
    div.style.border = '1px solid var(--border-color)';
    div.style.position = 'relative';

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
             <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Rapat Baru</span>
             <button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('${subFormId}').remove()" 
                style="width: 20px; height: 20px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; line-height: 1;">&times;</button>
        </div>
        <div class="form-group" style="margin-bottom: 0.5rem;">
            <select class="bulk-rapat-jenis" style="width: 100%; font-size: 0.8rem; height: auto; padding: 0.35rem 0.5rem; text-overflow: ellipsis;" required>
                <option value="">Jenis Rapat</option>
                ${masterRapat.map(r => `<option value="${escapeHtml(r.jenisRapat)}">${escapeHtml(r.jenisRapat)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <input type="date" class="bulk-rapat-tanggal" style="width: 100%; font-size: 0.8rem; height: auto; padding: 0.35rem 0.5rem;" required>
        </div>
    `;

    container.appendChild(div);
}

async function processBulkProker() {
    const items = document.querySelectorAll('.bulk-proker-item-form');
    const newProkers = [];

    let hasError = false;
    items.forEach((item, index) => {
        const nama = item.querySelector('.bulk-nama').value.trim();
        const tanggal = item.querySelector('.bulk-tanggal').value;
        const divisiId = item.querySelector('.bulk-divisi').value;
        const picId = item.querySelector('.bulk-pic').value;

        if (!nama || !tanggal) {
            if (nama || tanggal) { // Only error if one is partially filled
                showToast(`Mohon lengkapi Nama dan Tanggal untuk Proker #${index + 1}`, 'error');
                hasError = true;
            }
            return; // Skip empty rows
        }

        // Collect Rapat for this proker
        const rapatList = [];
        const rapatItems = item.querySelectorAll('.bulk-rapat-container > div');

        // Find PIC Name/Email for automatic population in rapat
        const selectedPIC = masterPIC.find(p => p.picId === picId);
        const picName = selectedPIC ? selectedPIC.namaPic : '';
        const picEmail = selectedPIC ? selectedPIC.email : '';

        rapatItems.forEach(rItem => {
            const jenis = rItem.querySelector('.bulk-rapat-jenis').value;
            const tgl = rItem.querySelector('.bulk-rapat-tanggal').value;
            if (jenis && tgl) {
                rapatList.push({
                    jenisRapat: jenis,
                    tanggalRap: tgl,
                    pic: picName,
                    picEmail: picEmail,
                    statusRapat: false,
                    aktif: true
                });
            }
        });

        newProkers.push({
            nama,
            divisiId,
            picId,
            tanggal,
            proposal: false,
            rak: false,
            rab: false,
            lpj: false,
            statusSelesai: false,
            rapat: rapatList,
            username: currentUser.username,
            scId: currentUser.scId,
            scNama: currentUser.nama
        });
    });

    if (hasError) return;

    if (newProkers.length === 0) {
        showToast('Minimal masukkan 1 proker yang lengkap', 'warning');
        return;
    }

    const ok = await showConfirm(`Simpan ${newProkers.length} proker baru?`, {
        title: 'Konfirmasi Simpan Massal',
        okText: 'Ya, Simpan'
    });

    if (!ok) return;

    showLoading();
    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=batchCreateProker', {
            method: 'POST',
            body: JSON.stringify({ prokers: newProkers })
        });

        const result = await response.json();
        if (result.success) {
            showToast(`${newProkers.length} Proker berhasil ditambahkan!`, 'success');
            closeBulkProkerModal();
            loadProkerData(true);
        } else {
            showToast('Gagal: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error in bulk add:', error);
        showToast('Gagal memproses tambah massal. Cek koneksi.', 'error');
    } finally {
        hideLoading();
    }
}

let rapatFormCounter = 0;

function addRapatForm() {
    const container = document.getElementById('rapat-forms-container');
    if (!container) {
        console.error('Container rapat-forms-container tidak ditemukan');
        return;
    }

    // Pastikan masterRapat sudah di-load
    if (!masterRapat || masterRapat.length === 0) {
        console.warn('Master Rapat kosong, mencoba reload...');
        loadMasterData().then(() => {
            // Retry setelah data di-load
            if (masterRapat && masterRapat.length > 0) {
                addRapatForm();
            } else {
                showToast('Data Master Rapat belum tersedia. Silakan refresh halaman.', 'error');
            }
        }).catch(err => {
            console.error('Error loading master rapat:', err);
            showToast('Gagal memuat data Master Rapat', 'error');
        });
        return;
    }

    const formId = 'rapat-form-' + rapatFormCounter++;

    const rapatForm = document.createElement('div');
    rapatForm.className = 'rapat-item-form';
    rapatForm.id = formId;
    rapatForm.innerHTML = `
        <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: var(--bg-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <strong>Rapat ${rapatFormCounter}</strong>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeRapatForm('${formId}')">Hapus</button>
            </div>
            <div class="form-group">
                <label>Jenis Rapat *</label>
                <select class="rapat-jenis-select" required>
                    <option value="">Pilih Jenis Rapat</option>
                    ${masterRapat.map(r => `<option value="${escapeHtml(r.jenisRapat)}">${escapeHtml(r.jenisRapat)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Tanggal Rapat *</label>
                <input type="date" class="rapat-tanggal-input" required>
            </div>

            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                <em>PIC dan Email PIC akan otomatis diambil dari Master_PIC berdasarkan PIC ID yang dipilih di proker</em>
            </p>
        </div>
    `;

    container.appendChild(rapatForm);
}

function removeRapatForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.remove();
    }
}

async function saveProker(event) {
    event.preventDefault();

    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk mengubah data', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Silakan login ke Mode SC terlebih dahulu', 'error');
        return;
    }

    const id = document.getElementById('proker-id').value;

    // Collect rapat data (hanya jenis rapat dan tanggal, PIC dan email akan diambil otomatis dari Master_PIC)
    const rapatList = [];
    const rapatItems = document.querySelectorAll('#rapat-forms-container .rapat-item-form');
    const picId = document.getElementById('proker-pic-id').value;

    // Get PIC data dari masterPIC
    const selectedPIC = masterPIC.find(p => p.picId === picId);
    if (!selectedPIC && picId) {
        console.warn('PIC not found in master data:', picId);
    }
    const picName = selectedPIC ? selectedPIC.namaPic : '';
    const picEmail = selectedPIC ? selectedPIC.email : '';

    rapatItems.forEach(item => {
        const selectEl = item.querySelector('.rapat-jenis-select');
        const dateEl = item.querySelector('.rapat-tanggal-input');

        if (selectEl && dateEl) {
            const jenisRapat = selectEl.value;
            const tanggalRap = dateEl.value;

            if (jenisRapat && tanggalRap) {
                rapatList.push({
                    jenisRapat: jenisRapat,
                    tanggalRap: tanggalRap,
                    pic: picName, // Otomatis dari Master_PIC
                    picEmail: picEmail, // Otomatis dari Master_PIC
                    statusRapat: false, // Internal backend default
                    aktif: true
                });
            }
        }
    });

    const proker = {
        nama: document.getElementById('proker-nama').value,
        divisiId: document.getElementById('proker-divisi-id').value || '',
        picId: document.getElementById('proker-pic-id').value || '',
        tanggal: document.getElementById('proker-tanggal').value,
        proposal: document.getElementById('proker-proposal').checked,
        rak: document.getElementById('proker-rak').checked,
        rab: document.getElementById('proker-rab').checked,
        lpj: document.getElementById('proker-lpj').checked,
        statusSelesai: document.getElementById('proker-status-selesai').checked,
        rapat: rapatList
    };

    // Tambah info user untuk history (JANGAN overwrite proker.nama!)
    proker.username = currentUser.username;
    proker.scId = currentUser.scId;
    proker.scNama = currentUser.nama; // Gunakan scNama untuk nama SC, bukan overwrite proker.nama

    showLoading();
    try {
        const action = id ? 'updateProker' : 'createProker';

        // Gunakan URLSearchParams untuk query string
        const params = new URLSearchParams();
        params.append('action', action);
        if (id) {
            params.append('id', id);
        }

        const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

        // Untuk Google Apps Script, gunakan mode 'no-cors' atau tanpa custom headers
        // karena Apps Script Web App sudah handle CORS otomatis
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(proker)
        });

        // GAS returns opaque response sometimes, but often it works if parsed as JSON
        let result = { success: true };
        try {
            const text = await response.text();
            if (text) {
                result = JSON.parse(text);
            }
        } catch (e) {
            console.warn('Could not parse response but request might have succeeded', e);
        }

        if (result.success) {
            showToast(id ? 'Proker berhasil diperbarui!' : 'Proker berhasil ditambahkan!', 'success');
            closeProkerModal();

            if (id) {
                const index = prokerData.findIndex(p => p.id === id);
                if (index !== -1) {
                    prokerData[index] = { ...prokerData[index], ...proker, id: id };
                    localStorage.setItem('prokerDataCache', JSON.stringify(prokerData.map(p => ({ ...p, dateObj: null }))));
                    applyFilters();
                    renderProkerView();
                }
            } else {
                // For new proker, reload data immediately and force bypass cache
                loadProkerData(true);
            }
        } else {
            showToast('Gagal menyimpan: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error saving proker:', error);
        showToast('Error: ' + error.message + '. Pastikan Apps Script sudah di-deploy dan URL benar. Cek browser console untuk detail.', 'error');
    } finally {
        hideLoading();
    }
}

// Update checkbox langsung dengan sistem batch
function updateProkerCheckbox(prokerId, field, value) {
    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk mengubah data', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Silakan login ke Mode SC terlebih dahulu', 'error');
        return;
    }

    // Initialize entry if not exists
    if (!pendingChanges[prokerId]) {
        pendingChanges[prokerId] = {};
    }

    // Update pending changes
    pendingChanges[prokerId][field] = value;

    // Update data lokal agar UI berubah seketika
    const index = prokerData.findIndex(p => p.id === prokerId);
    if (index !== -1) {
        prokerData[index][field] = value;

        // OPTIMIZATION: Update DOM directly without full re-render
        const items = document.querySelectorAll(`[data-proker-id="${prokerId}"]`);
        items.forEach(item => {
            if (field === 'statusSelesai') {
                if (value) item.classList.add('status-success');
                else item.classList.remove('status-success');

                // Update badge in monthly view if exists
                const meta = item.querySelector('.month-item-meta');
                if (meta) {
                    const existingBadge = meta.querySelector('.status-badge');
                    if (value && !existingBadge) {
                        const badge = document.createElement('span');
                        badge.className = 'status-badge status-completed';
                        badge.textContent = 'Selesai';
                        meta.insertBefore(badge, meta.firstChild);
                    } else if (!value && existingBadge) {
                        existingBadge.remove();
                    }
                }

                // Update badge in table view if exists
                if (item.tagName === 'TR') {
                    const statusTd = item.cells[item.cells.length - 2];
                    if (statusTd && !currentMode === 'sc') { // only for staff view but we are in sc mode
                        // in sc mode table, the status is checkboxes
                    }
                }
            }

            // For other checkboxes, they are already checked in the DOM because the user clicked them
            // No further DOM update needed for the one the user just clicked.
        });
    }

    updateBatchUI();
}

function updateBatchUI() {
    const container = document.getElementById('batch-save-container');
    const countSpan = document.getElementById('batch-count');
    const prokerCount = Object.keys(pendingChanges).length;

    if (prokerCount > 0) {
        container.classList.add('show');
        countSpan.textContent = prokerCount;
    } else {
        container.classList.remove('show');
    }
}

async function discardBatchChanges() {
    const ok = await showConfirm('Batalkan semua perubahan yang belum disimpan?', {
        title: 'Batalkan Perubahan',
        variant: 'danger',
        okText: 'Ya, Batalkan'
    });

    if (ok) {
        pendingChanges = {};
        updateBatchUI();
        // Reload data untuk mengembalikan ke status server
        loadProkerData();
    }
}

async function saveBatchChanges() {
    if (Object.keys(pendingChanges).length === 0) return;

    showLoading();
    try {
        const updates = Object.keys(pendingChanges).map(id => ({
            id: id,
            data: pendingChanges[id]
        }));

        const payload = {
            action: 'batchUpdateProker',
            username: currentUser.username,
            scId: currentUser.scId,
            scNama: currentUser.nama,
            updates: updates
        };

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // Karena no-cors, kita tidak bisa baca response, jadi kita asumsikan sukses
        // dan update cache lokal

        // Simpan ke cache permanen
        localStorage.setItem('prokerDataCache', JSON.stringify(prokerData.map(p => ({ ...p, dateObj: null }))));
        localStorage.setItem('prokerDataCache_time', Date.now().toString());

        showToast('Semua perubahan berhasil disimpan!', 'success');
        pendingChanges = {};
        updateBatchUI();

        // Sedikit delay lalu reload data untuk sinkronisasi final
        setTimeout(() => loadProkerData(), 1000);

    } catch (error) {
        console.error('Error saving batch changes:', error);
        showToast('Gagal menyimpan perubahan: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteProker(id) {
    const ok = await showConfirm('Apakah Anda yakin ingin menghapus proker ini? Data yang dihapus tidak dapat dikembalikan.', {
        title: 'Hapus Proker',
        variant: 'danger',
        okText: 'Ya, Hapus'
    });

    if (!ok) {
        return;
    }

    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk menghapus data', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Silakan login ke Mode SC terlebih dahulu', 'error');
        return;
    }

    showLoading();
    try {
        const url = `${APPS_SCRIPT_URL}?action=deleteProker&id=${id}&username=${encodeURIComponent(currentUser.username)}&scId=${encodeURIComponent(currentUser.scId)}&nama=${encodeURIComponent(currentUser.nama)}`;

        const response = await fetch(url, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            showToast('Proker berhasil dihapus!', 'success');
            // Update data lokal - set isActive ke false atau hapus
            const index = prokerData.findIndex(p => p.id === id);
            if (index !== -1) {
                prokerData.splice(index, 1);
                // Clear cache so it fetches fresh next time or update it
                localStorage.removeItem('prokerDataCache_time');
                applyFilters();
                renderProkerView();
                updateBulkActionUI();
            }
        } else {
            showToast('Gagal menghapus: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
        console.error('Error deleting proker:', error);
    } finally {
        hideLoading();
    }
}

// ==================== KONTEN KOMINFO FUNCTIONS (READ ONLY) ====================

async function loadKontenData() {
    // Cek cache dulu
    const cacheKey = 'kontenDataCache';
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const now = Date.now();

    // Gunakan cache jika masih valid (5 menit)
    if (cacheTime && (now - parseInt(cacheTime)) < 300000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                kontenData = cachedData.map(item => {
                    let dateObj = null;
                    if (item.tanggal) {
                        if (item.tanggal.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                            const parts = item.tanggal.split('/');
                            dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                        } else {
                            dateObj = new Date(item.tanggal + 'T00:00:00');
                        }
                    }
                    return { ...item, dateObj: dateObj };
                });
                filteredKonten = [...kontenData];
                sortKontenByMonth();
                renderKontenView();
                populateMonthFilters();
                console.log('Loaded konten data from cache');
                return; // Return early jika menggunakan cache
            } catch (e) {
                console.error('Error parsing cache:', e);
            }
        }
    }

    // Jika tidak ada cache atau cache expired, load dari server
    showLoading();
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getKonten&_=${now}`);
        const result = await response.json();

        if (result.success) {
            kontenData = result.data.map(item => {
                // Handle format DD/MM/YYYY untuk tanggal
                let dateObj = null;
                if (item.tanggal) {
                    if (item.tanggal.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        const parts = item.tanggal.split('/');
                        dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                    } else {
                        dateObj = new Date(item.tanggal + 'T00:00:00');
                    }
                }
                return {
                    ...item,
                    dateObj: dateObj
                };
            });
            filteredKonten = [...kontenData];
            sortKontenByMonth();
            renderKontenView();
            populateMonthFilters();

            // Simpan ke cache
            localStorage.setItem(cacheKey, JSON.stringify(result.data));
            localStorage.setItem(cacheKey + '_time', now.toString());
        } else {
            showToast('Gagal memuat data Konten: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
        console.error('Error loading konten:', error);
    } finally {
        hideLoading();
    }
}

function sortKontenByMonth() {
    filteredKonten.sort((a, b) => {
        if (!a.dateObj && !b.dateObj) return 0;
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        return b.dateObj - a.dateObj;
    });
}

function setKontenView(view) {
    currentKontenView = view;
    document.querySelectorAll('#konten-section .view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });

    document.getElementById('konten-month-filter').style.display =
        view === 'monthly' ? 'flex' : 'none';

    document.getElementById('konten-monthly-view').style.display =
        view === 'monthly' ? 'block' : 'none';
    document.getElementById('konten-all-view').style.display =
        view === 'all' ? 'block' : 'none';
    document.getElementById('konten-calendar-view').style.display =
        view === 'calendar' ? 'block' : 'none';

    renderKontenView();
}

function renderKontenView() {
    if (currentKontenView === 'monthly') {
        renderKontenMonthly();
    } else if (currentKontenView === 'all') {
        renderKontenTable();
    } else if (currentKontenView === 'calendar') {
        renderKontenCalendar();
    }
}

function renderKontenMonthly() {
    const container = document.getElementById('konten-monthly-content');

    // Filter berdasarkan bulan yang dipilih
    let filtered = filteredKonten;
    if (currentKontenMonth !== null && currentKontenMonth !== "") {
        filtered = filteredKonten.filter(k => {
            if (!k.dateObj) return false;
            return k.dateObj.getMonth() === parseInt(currentKontenMonth);
        });
    }

    const grouped = groupByMonth(filtered);

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = '<div class="loading">Tidak ada data</div>';
        return;
    }

    let html = '';
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Sort bulan dari terbaru ke terlama
    const months = Object.keys(grouped).map(m => parseInt(m)).sort((a, b) => b - a);

    months.forEach(monthIndex => {

        const monthName = monthNames[monthIndex];
        const monthData = grouped[monthIndex];

        // Sort data dalam bulan berdasarkan tanggal (terbaru dulu)
        monthData.sort((a, b) => {
            if (!a.dateObj && !b.dateObj) return 0;
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        });

        html += `
            <div class="month-group">
                <div class="month-header">
                    <span>${monthName}</span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">
                        ${monthData.length} konten
                    </span>
                </div>
                <div class="month-content">
                    ${monthData.map(konten => `
                        <div class="month-item ${(konten.status || '').toLowerCase().includes('selesai') ? 'status-success' : ''}">
                            <div class="month-item-header">
                                <div class="month-item-title">${escapeHtml(konten.nama || '')}</div>
                                <div class="month-item-meta">
                                    <span>${formatDate(konten.tanggal || '')}</span>
                                    ${konten.status ? `<span>${escapeHtml(konten.status)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderKontenTable() {
    const tbody = document.getElementById('konten-tbody');

    if (filteredKonten.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading">Tidak ada data</td></tr>';
        return;
    }

    tbody.innerHTML = filteredKonten.map((konten, index) => `
        <tr class="${(konten.status || '').toLowerCase().includes('selesai') ? 'status-success' : ''}">
            <td>${index + 1}</td>
            <td>${escapeHtml(konten.nama || '')}</td>
            <td>${formatDate(konten.tanggal || '')}</td>
        </tr>
    `).join('');
}

function renderKontenCalendar() {
    const container = document.getElementById('konten-calendar-container');
    const monthYear = document.getElementById('konten-calendar-month-year');

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    monthYear.textContent = `${monthNames[currentKontenCalendarMonth]} ${currentKontenCalendarYear}`;

    const firstDay = new Date(currentKontenCalendarYear, currentKontenCalendarMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let html = '<div class="calendar-grid">';

    const dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    const currentDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
        const isCurrentMonth = currentDate.getMonth() === currentKontenCalendarMonth;
        const isToday = isSameDay(currentDate, new Date());
        const dayKonten = filteredKonten.filter(k => {
            if (!k.dateObj || isNaN(k.dateObj.getTime())) return false;
            return isSameDay(k.dateObj, currentDate);
        });

        html += `
            <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}"
                 onclick="showCalendarDayDetails('${currentDate.toDateString()}', 'konten')"
                 style="cursor: pointer;">
                <div class="calendar-day-number">${currentDate.getDate()}</div>
                ${dayKonten.length > 0 ? `
                    <div class="calendar-day-events">
                        ${dayKonten.length} konten
                    </div>
                    ${dayKonten.slice(0, 2).map(k => `
                        <div class="calendar-event-item ${(k.status || '').toLowerCase().includes('selesai') ? 'status-success' : ''}" title="${escapeHtml(k.nama)}">
                            ${escapeHtml(k.nama.substring(0, 15))}${k.nama.length > 15 ? '...' : ''}
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;

        currentDate.setDate(currentDate.getDate() + 1);
    }

    html += '</div>';
    container.innerHTML = html;
}

function changeKontenCalendarMonth(delta) {
    currentKontenCalendarMonth += delta;
    if (currentKontenCalendarMonth < 0) {
        currentKontenCalendarMonth = 11;
        currentKontenCalendarYear--;
    } else if (currentKontenCalendarMonth > 11) {
        currentKontenCalendarMonth = 0;
        currentKontenCalendarYear++;
    }
    renderKontenCalendar();
}

function filterKontenByMonth() {
    const select = document.getElementById('konten-month-select');
    currentKontenMonth = select.value || null;
    renderKontenMonthly();
}

function searchKonten() {
    const searchTerm = document.getElementById('konten-search').value.toLowerCase();
    filteredKonten = kontenData.filter(konten =>
        (konten.nama || '').toLowerCase().includes(searchTerm)
    );
    sortKontenByMonth();
    renderKontenView();
}

// ==================== SC FUNCTIONS ====================

function renderSCContent() {
    const container = document.getElementById('sc-content');
    container.innerHTML = `
        <div class="sc-placeholder">
            <p>Section Steering Committee</p>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                Selamat datang, ${currentUser ? currentUser.nama : 'User'}!
            </p>
        </div>
    `;
}

// ==================== UTILITY FUNCTIONS ====================

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Format tanggal (dari DD/MM/YYYY ke format display)
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        // Jika sudah format DD/MM/YYYY, return as is
        if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return dateString;
        }
        // Jika format YYYY-MM-DD, convert ke DD/MM/YYYY
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = dateString.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        // Coba parse sebagai date
        const date = new Date(dateString + 'T00:00:00');
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
        return dateString;
    } catch (e) {
        return dateString;
    }
}

// Convert DD/MM/YYYY ke YYYY-MM-DD untuk input date
function convertDateForInput(dateString) {
    if (!dateString) return '';
    try {
        // Jika format DD/MM/YYYY
        if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const parts = dateString.split('/');
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        // Jika sudah format YYYY-MM-DD, return as is
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        return dateString;
    } catch (e) {
        return dateString;
    }
}

function getStatusClass(status) {
    // Tidak digunakan lagi, tapi tetap ada untuk kompatibilitas
    return 'default';
}

function closeProkerDetailModal() {
    document.getElementById('proker-detail-modal').classList.remove('show');
}

function showLoading() {
    document.getElementById('loading-overlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('show');
}

function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const titleEl = document.getElementById('confirm-title');

        if (!modal || !msgEl || !okBtn || !cancelBtn || !titleEl) {
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message;
        okBtn.textContent = options.okText || 'Ya, Hapus';
        cancelBtn.textContent = options.cancelText || 'Batal';
        titleEl.textContent = options.title || 'Konfirmasi';

        // Change OK button color if specified
        if (options.variant === 'danger') {
            okBtn.className = 'btn btn-danger';
        } else {
            okBtn.className = 'btn btn-primary';
        }

        const cleanup = () => {
            modal.classList.remove('show');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);

        modal.classList.add('show');
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== SELECTION & BULK ACTIONS ====================

function toggleAllProkerSelection(checked) {
    const checkboxes = document.querySelectorAll('.proker-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateBulkActionUI();
}

function updateBulkActionUI() {
    const selected = document.querySelectorAll('.proker-checkbox:checked');
    const bulkBar = document.getElementById('proker-bulk-actions');
    const countSpan = document.getElementById('selected-count');
    const selectAllCb = document.getElementById('select-all-proker');

    if (selected.length > 0) {
        bulkBar.style.display = 'flex';
        countSpan.textContent = `${selected.length} item terpilih`;
    } else {
        bulkBar.style.display = 'none';
        if (selectAllCb) selectAllCb.checked = false;
    }
}

function clearProkerSelection() {
    const checkboxes = document.querySelectorAll('.proker-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    const selectAllCb = document.getElementById('select-all-proker');
    if (selectAllCb) selectAllCb.checked = false;
    updateBulkActionUI();
}

async function deleteSelectedProker() {
    const selected = document.querySelectorAll('.proker-checkbox:checked');
    const ids = Array.from(selected).map(cb => cb.value);

    if (ids.length === 0) return;

    const ok = await showConfirm(`Apakah Anda yakin ingin menghapus ${ids.length} proker terpilih? Tindakan ini tidak dapat dibatalkan.`, {
        title: 'Hapus Massal',
        variant: 'danger',
        okText: `Ya, Hapus ${ids.length} Item`
    });

    if (!ok) return;

    showLoading();
    try {
        const payload = {
            action: 'batchDeleteProker',
            ids: ids,
            username: currentUser.username,
            scId: currentUser.scId,
            nama: currentUser.nama
        };

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            showToast(`${ids.length} Proker berhasil dihapus!`, 'success');
            // Force reload data
            await loadProkerData(true);
            clearProkerSelection();
        } else {
            showToast('Gagal menghapus massal: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error in batch delete:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Close modal saat klik di luar
window.onclick = function (event) {
    const prokerModal = document.getElementById('proker-modal');
    const loginModal = document.getElementById('login-modal');
    const detailModal = document.getElementById('proker-detail-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const calendarModal = document.getElementById('calendar-day-modal');

    if (event.target === prokerModal) closeProkerModal();
    if (event.target === loginModal) closeLoginModal();
    if (event.target === detailModal) closeProkerDetailModal();
    if (event.target === confirmModal) {
        // We don't close confirm modal on backdrop click for safety
    }
    if (event.target === calendarModal) closeCalendarDayModal();
}

// ==================== BATCH UPDATES (CHECKBOXES) ====================

function updateProkerCheckbox(id, field, value) {
    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk mengubah data', 'error');
        // Revert checkbox state
        loadProkerData(false);
        return;
    }

    if (!pendingChanges[id]) {
        pendingChanges[id] = {};
    }
    pendingChanges[id][field] = value;

    // Update batch save UI
    updateBatchSaveUI();
}

function updateBatchSaveUI() {
    const container = document.getElementById('batch-save-container');
    const countSpan = document.getElementById('batch-count');

    // Count changes
    let changesCount = 0;
    Object.keys(pendingChanges).forEach(id => {
        changesCount += Object.keys(pendingChanges[id]).length;
    });

    if (changesCount > 0) {
        container.classList.add('show');
        countSpan.textContent = changesCount;
    } else {
        container.classList.remove('show');
    }
}

function discardBatchChanges() {
    pendingChanges = {};
    updateBatchSaveUI();
    loadProkerData(false); // Reload from cache just to reset UI
    showToast('Perubahan dibatalkan', 'info');
}

async function saveBatchChanges() {
    // Construct updates array
    const updates = [];
    Object.keys(pendingChanges).forEach(id => {
        updates.push({
            id: id,
            data: pendingChanges[id]
        });
    });

    if (updates.length === 0) return;

    showLoading();
    try {
        const payload = {
            action: 'batchUpdateProker',
            updates: updates,
            username: currentUser.username,
            scId: currentUser.scId,
            nama: currentUser.nama
        };

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            showToast(`${updates.length} Proker berhasil diperbarui!`, 'success');
            pendingChanges = {}; // Clear changes
            updateBatchSaveUI();

            // Reload data to ensure sync
            await loadProkerData(true);
        } else {
            showToast('Gagal menyimpan perubahan massal: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error batch update:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
