// Konfigurasi Apps Script URL
// GANTI URL INI DENGAN URL APPS SCRIPT ANDA SETELAH DEPLOY
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxsamlYnc3uomGJSP61KNF7MdEwVUjRxcfEEN3x3JSPqLYofvdKQL8oW8uKOA9p8-JQJw/exec';

// Data cache
let prokerData = [];
let kontenData = [];
let rapatData = []; // New
let scData = [];
let filteredProker = [];
let filteredKonten = [];
let masterDivisi = [];
let masterPIC = [];
let masterRapat = [];
let divisiMap = {}; // Lookup Map for Divisi names
let picMap = {};    // Lookup Map for PIC names
let lastProkerDataHash = '';
let lastRapatDataHash = ''; // New
let lastKontenDataHash = ''; // New

// State management
let currentMode = 'staff'; // 'staff' or 'sc'
let currentUser = null; // { username, password }
let pendingChanges = {}; // { prokerId: { field: value } }
let currentSection = 'proker'; // 'proker' or 'konten'
let currentProkerView = 'all'; // Default now to 'all' as requested
let currentKontenView = 'monthly'; // 'monthly', 'all', 'calendar'
let currentProkerMonth = null;
let currentKontenMonth = null;
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let currentKontenCalendarMonth = new Date().getMonth();
let currentKontenCalendarYear = new Date().getFullYear();
let currentPengurusCalendarMonth = new Date().getMonth();
let currentPengurusCalendarYear = new Date().getFullYear();
let bulkProkerCounter = 0;
let rapatFormCounter = 0;
let lastActivityTime = Date.now(); // New: For idle timeout
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms

// Polling intervals for SC indicator
let presenceInterval = null;
let activeScInterval = null;
let autoSyncInterval = null;
let idleInterval = null; // New

// Add activity listeners
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
    document.addEventListener(name, () => {
        lastActivityTime = Date.now();
    });
});


// ==================== SC PRESENCE POLLING ====================

function startSCPolling() {
    if (presenceInterval) return;

    // Ping immediately
    updatePresencePing();
    fetchActiveSCs();
    lastActivityTime = Date.now(); // Reset activity on start

    // SC-specific intervals (Presence & Active list)
    presenceInterval = setInterval(updatePresencePing, 60000); // Ping presence every 1 min
    activeScInterval = setInterval(fetchActiveSCs, 30000);     // Active icons list every 30 sec

    // Idle timeout check
    if (idleInterval) clearInterval(idleInterval);
    idleInterval = setInterval(() => {
        if (currentMode === 'sc' && (Date.now() - lastActivityTime) > IDLE_TIMEOUT) {
            console.log('Idle timeout reached. Logging out...');
            logoutSC();
            showToast('Anda telah otomatis keluar karena tidak ada aktivitas', 'info');
        }
    }, 60000); // Check every 1 minute
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
    if (idleInterval) {
        clearInterval(idleInterval);
        idleInterval = null;
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
        items = prokerData.filter(p => p.dateObj && isSameDay(p.dateObj, date) && p.isActive !== false).map(p => ({
            nama: p.nama,
            meta: p.divisiId || '-'
        }));
    } else if (type === 'pengurus') {
        prokerData.forEach(p => {
            if (p.dateObj && isSameDay(p.dateObj, date) && p.isActive !== false) {
                items.push({ nama: p.nama, meta: 'Program Kerja' });
            }
        });
        rapatData.forEach(r => {
            if (r.dateObj && isSameDay(r.dateObj, date)) {
                items.push({ nama: `${r.jenisRapat} (${r.namaProker || ''})`, meta: 'Rapat Pengurus' });
            }
        });
    } else {
        items = kontenData.filter(k => k.dateObj && isSameDay(k.dateObj, date)).map(k => ({
            nama: k.nama,
            meta: k.status || '-'
        }));
    }

    if (items.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Tidak ada agenda pada tanggal ini</div>`;
    } else {
        listContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${items.map(item => `
                    <div class="month-item" style="margin-bottom: 0; cursor: default; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-color);">
                        <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(item.nama)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            ${item.meta}
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
    updateModeDisplay();

    // Load hanya master data dan proker data saat pertama kali (lazy loading untuk konten)
    showLoading('Sedang memuat data awal...');
    try {
        await Promise.all([
            loadMasterData(),
            loadProkerData({ force: false, silent: true }),
            loadRapatData({ force: false, silent: true })
        ]);

        // First time onboarding check
        if (!localStorage.getItem('hasSeenHelp')) {
            showHelpModal();
            localStorage.setItem('hasSeenHelp', 'true');
        }

        populateMonthFilters();
        switchSection('proker'); // Default show Proker
    } catch (e) {
        console.error('Error during initial load:', e);
    } finally {
        hideLoading(); // Pastikan loading di-hide apapun yang terjadi
    }
    // Aktifkan mode transisi normal setelah loading awal selesai
    document.getElementById('welcome-logo-container').style.display = 'none';
    document.getElementById('welcome-title').style.display = 'none';

    startGlobalSync(); // Start background sync for all users
});

// ==================== GLOBAL BACKGROUND SYNC ====================

function startGlobalSync() {
    if (autoSyncInterval) return;

    console.log('Starting global background sync...');
    autoSyncInterval = setInterval(async () => {
        // Only sync if tab is visible to save resources (optional but good)
        if (document.hidden) return;

        // Background sync Proker & Rapat
        await loadProkerData({ silent: true, force: true });
        await loadRapatData({ silent: true, force: true });

        // Background sync Konten
        await loadKontenData({ silent: true, force: true });

        // Background sync Master data (PIC, Divisi, etc)
        await loadMasterData({ silent: true });
    }, 10000); // Poll every 10 seconds for real-time feel
}

// ==================== MASTER DATA ====================

async function loadMasterData(options = {}) {
    const silent = options.silent || false;
    const force = options.force || false;
    const now = Date.now();
    const cacheKey = 'masterDataCache';
    const cacheTime = localStorage.getItem(cacheKey + '_time');

    // Use cache if available and not forced
    if (!force && cacheTime && (now - parseInt(cacheTime)) < 300000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                masterDivisi = data.divisi || [];
                masterPIC = data.pic || [];
                masterRapat = data.rapat || [];
                updateDivisiMap();
                updatePicMap();
                populateDivisiDropdown();
                populatePICDropdown();
                console.log('Loaded master data from cache');
                return;
            } catch (e) { console.error('Error parsing master cache:', e); }
        }
    }

    try {
        // Fetch all in parallel for speed
        const [divResponse, picResponse, rapatResponse] = await Promise.all([
            fetch(`${APPS_SCRIPT_URL}?action=getMasterDivisi&_=${now}`),
            fetch(`${APPS_SCRIPT_URL}?action=getMasterPIC&_=${now}`),
            fetch(`${APPS_SCRIPT_URL}?action=getMasterRapat&_=${now}`)
        ]);

        const [d_res, p_res, r_res] = await Promise.all([
            divResponse.json(),
            picResponse.json(),
            rapatResponse.json()
        ]);

        if (d_res.success) masterDivisi = d_res.data || [];
        if (p_res.success) masterPIC = p_res.data || [];
        if (r_res.success) masterRapat = r_res.data || [];

        updateDivisiMap();
        updatePicMap();
        populateDivisiDropdown();
        populatePICDropdown();

        // Save to cache
        localStorage.setItem(cacheKey, JSON.stringify({
            divisi: masterDivisi,
            pic: masterPIC,
            rapat: masterRapat
        }));
        localStorage.setItem(cacheKey + '_time', now.toString());

    } catch (error) {
        if (!silent) console.error('Error loading master data:', error);
        masterDivisi = masterDivisi || [];
        masterPIC = masterPIC || [];
        masterRapat = masterRapat || [];
    }
}

function updateDivisiMap() {
    divisiMap = {};
    masterDivisi.forEach(d => {
        divisiMap[d.divisiId] = d.namaDivisi || d.divisiId;
    });
}

function updatePicMap() {
    picMap = {};
    masterPIC.forEach(p => {
        picMap[p.picId] = {
            nama: p.namaPic || p.picId,
            email: p.email || '',
            namaLower: (p.namaPic || '').toLowerCase()
        };
    });
}

function populateDivisiDropdown() {
    const select = document.getElementById('proker-divisi-id');
    if (!select) return;

    const selects = [select, document.getElementById('proker-divisi-select')];

    selects.forEach(sel => {
        if (!sel) return;
        const isFilter = sel.id === 'proker-divisi-select';
        sel.innerHTML = isFilter ? '<option value="">Semua Divisi</option>' : '<option value="">Pilih Divisi</option>';

        masterDivisi.forEach(divisi => {
            const option = document.createElement('option');
            option.value = divisi.divisiId;
            option.textContent = divisi.namaDivisi ? `${divisi.namaDivisi} (${divisi.divisiId})` : divisi.divisiId;
            sel.appendChild(option);
        });
    });
}


function populatePICDropdown(filterDivisiId = null) {
    const select = document.getElementById('proker-pic-id');
    if (!select) return;

    // Jika Divisi belum dipilih, reset dan tampilkan pesan
    if (!filterDivisiId) {
        select.innerHTML = '<option value="">Pilih Divisi Terlebih Dahulu</option>';
        return;
    }

    // Clear existing options except first
    select.innerHTML = '<option value="">Pilih PIC</option>';

    if (!masterPIC || masterPIC.length === 0) {
        console.warn('Master PIC kosong, pastikan data sudah di-load');
        return;
    }

    // Filter PIC yang memiliki nama saja
    let activePICs = masterPIC.filter(pic => pic.namaPic && pic.namaPic.trim() !== '');

    // Filter by Divisi (Strict)
    activePICs = activePICs.filter(pic => pic.divisiId === filterDivisiId);

    if (activePICs.length === 0) {
        const option = document.createElement('option');
        option.text = "- Tidak ada PIC di divisi ini -";
        select.appendChild(option);
    }

    activePICs.forEach(pic => {
        const option = document.createElement('option');
        option.value = pic.picId;
        option.textContent = `${pic.namaPic} (${pic.picId})`;
        select.appendChild(option);
    });
}

// ... existing code ...

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

    // Reset PIC dropdown (empty initially until division selected)
    populatePICDropdown(null);

    // Add event listener for division change
    const divisiSelect = document.getElementById('proker-divisi-id');
    divisiSelect.onchange = function () {
        populatePICDropdown(this.value);
    };

    document.getElementById('proker-tanggal').valueAsDate = new Date();
    document.getElementById('proker-proposal').checked = false;
    document.getElementById('proker-rak').checked = false;
    document.getElementById('proker-rab').checked = false;
    document.getElementById('proker-lpj').checked = false;
    // Selesai checkbox removed

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

            // Populate PIC dropdown filtered by saved division
            populatePICDropdown(prokerData.divisiId);
            document.getElementById('proker-pic-id').value = prokerData.picId || '';

            // Add onchange handler
            document.getElementById('proker-divisi-id').onchange = function () {
                populatePICDropdown(this.value);
            };

            // Convert DD/MM/YYYY ke YYYY-MM-DD untuk input date
            const tanggalInput = convertDateForInput(prokerData.tanggal || '');
            document.getElementById('proker-tanggal').value = tanggalInput;

            document.getElementById('proker-proposal').checked = prokerData.proposal || false;
            document.getElementById('proker-rak').checked = prokerData.rak || false;
            document.getElementById('proker-rab').checked = prokerData.rab || false;
            document.getElementById('proker-lpj').checked = prokerData.lpj || false;
            // Selesai checkbox removed

            // Load rapat forms - EXISTING CODE for rapat forms ...
            const container = document.getElementById('rapat-forms-container');
            container.innerHTML = '';
            rapatFormCounter = 0;

            rapatData.forEach(rapat => {
                // ... existing rapat form creation code ...
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
                            <label>Jenis Rapat</label>
                            <select class="rapat-jenis-select" required>
                                <option value="">Pilih Jenis Rapat</option>
                                ${masterRapat.map(r => `<option value="${escapeHtml(r.jenisRapat)}" ${r.jenisRapat === rapat.jenisRapat ? 'selected' : ''}>${escapeHtml(r.jenisRapat)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Tanggal Rapat</label>
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

// ... existing toggleProkerDetail ...

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
                    <label>Nama Proker</label>
                    <input type="text" class="bulk-nama" placeholder="Masukkan nama proker" required>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Tanggal Pelaksanaan</label>
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
                        <option value="">Pilih Divisi Dulu</option>
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

    // Add event listener for dynamic filtering
    const divisiSelect = div.querySelector('.bulk-divisi');
    const picSelect = div.querySelector('.bulk-pic');

    divisiSelect.onchange = function () {
        const divisionId = this.value;
        picSelect.innerHTML = '<option value="">Pilih PIC</option>';

        const filteredPICs = masterPIC.filter(p => p.divisiId === divisionId && p.namaPic && p.namaPic.trim() !== '');
        filteredPICs.forEach(p => {
            const option = document.createElement('option');
            option.value = p.picId;
            option.textContent = p.namaPic;
            picSelect.appendChild(option);
        });
    };

    // Smooth scroll to bottom
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

// ... existing code ...

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
    const nama = document.getElementById('proker-nama').value.trim();
    const tanggal = document.getElementById('proker-tanggal').value;
    const divisiId = document.getElementById('proker-divisi-id').value;
    const picId = document.getElementById('proker-pic-id').value;

    if (!nama) {
        showToast('Mohon isi minimal Nama Program Kerja', 'error');
        return;
    }

    // Collect rapat data
    const rapatList = [];
    const rapatItems = document.querySelectorAll('#rapat-forms-container .rapat-item-form');
    // picId already declared above using basic declaration, just use it
    // const picId = document.getElementById('proker-pic-id').value; 

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
                    pic: picName,
                    picEmail: picEmail,
                    statusRapat: false,
                    aktif: true
                });
            }
        }
    });

    const proposal = document.getElementById('proker-proposal').checked;
    const rak = document.getElementById('proker-rak').checked;
    const rab = document.getElementById('proker-rab').checked;
    const lpj = document.getElementById('proker-lpj').checked;

    // Auto-calculate finished status
    const statusSelesai = proposal && rak && rab && lpj;

    const proker = {
        nama: document.getElementById('proker-nama').value,
        divisiId: document.getElementById('proker-divisi-id').value || '',
        picId: document.getElementById('proker-pic-id').value || '',
        tanggal: document.getElementById('proker-tanggal').value,
        proposal: proposal,
        rak: rak,
        rab: rab,
        lpj: lpj,
        statusSelesai: statusSelesai, // Calculated
        rapat: rapatList
    };

    // Tambah info user untuk history
    proker.username = currentUser.username;
    proker.scId = currentUser.scId;
    proker.scNama = currentUser.nama;

    // ... existing save/fetch logic ...
    showLoading(id ? 'Sedang memperbarui proker...' : 'Sedang menyimpan proker baru...');
    try {
        const action = id ? 'updateProker' : 'createProker';

        const params = new URLSearchParams();
        params.append('action', action);
        if (id) {
            params.append('id', id);
        }

        const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(proker)
        });

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

            // Optimistic local update to avoid propagation delay
            const updatedProker = {
                ...proker,
                id: id || (result.data ? result.data.id : null),
                isActive: true,
                updatedAt: new Date().toISOString()
            };

            if (id) {
                const index = prokerData.findIndex(p => p.id === id);
                if (index !== -1) {
                    prokerData[index] = { ...prokerData[index], ...updatedProker };
                }
            } else if (updatedProker.id) {
                // If it's a new proker, add to the start of the list
                updatedProker.createdAt = new Date().toISOString();
                prokerData.unshift(updatedProker);
            }

            // Re-process locally to update dateObj and re-render
            processProkerData(prokerData);

            // Still force a background refresh to sync with authoritative server data
            await loadProkerData({ force: true, silent: true });
        } else {
            showToast('Gagal menyimpan: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error saving proker:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function updateProkerCheckbox(id, field, value) {
    if (currentMode !== 'sc') {
        showToast('Mode SC diperlukan untuk mengubah data', 'error');
        loadProkerData(false);
        return;
    }

    if (!pendingChanges[id]) {
        pendingChanges[id] = {};
    }
    pendingChanges[id][field] = value;

    // Update data lokal agar UI berubah seketika
    const index = prokerData.findIndex(p => p.id === id);
    if (index !== -1) {
        prokerData[index][field] = value;

        // Auto-calculate statusSelesai based on all checkboxes
        // We use the pending changes if available, else current data
        const p = prokerData[index];
        // Note: 'value' is already set in p[field] above.
        // But for other fields, we should check pendingChanges first? 
        // Simpler: assume prokerData is the source of truth for current UI state since we just updated it.
        const isFinished = p.proposal && p.rak && p.rab && p.lpj;

        if (p.statusSelesai !== isFinished) {
            p.statusSelesai = isFinished;
            pendingChanges[id]['statusSelesai'] = isFinished; // Add to batch

            // Visual Update for Status Badge
            const items = document.querySelectorAll(`[data-proker-id="${id}"]`);
            items.forEach(item => {
                if (isFinished) {
                    item.classList.add('status-success');
                    // Find or add badge
                    const meta = item.querySelector('.month-item-meta');
                    if (meta && !meta.querySelector('.status-completed')) {
                        const badge = document.createElement('span');
                        badge.className = 'status-badge status-completed';
                        badge.textContent = 'Selesai';
                        meta.insertBefore(badge, meta.firstChild);
                    }
                } else {
                    item.classList.remove('status-success');
                    const badge = item.querySelector('.status-completed');
                    if (badge) badge.remove();
                }
            });
        }
    }

    // Update batch save UI
    updateBatchSaveUI();
}




// ==================== REFRESH & CACHE ====================

async function refreshData() {
    showLoading('Sedang memperbarui data...');

    // Clear cache
    localStorage.removeItem('prokerDataCache');
    localStorage.removeItem('prokerDataCache_time');
    localStorage.removeItem('kontenDataCache');
    localStorage.removeItem('kontenDataCache_time');
    localStorage.removeItem('rapatDataCache');
    localStorage.removeItem('rapatDataCache_time');
    sessionStorage.clear();

    prokerData = [];
    kontenData = [];
    rapatData = [];
    scData = [];

    try {
        // Reload semua data secara parallel secara silent agar tidak menimpa pesan loading utama
        await Promise.all([
            loadMasterData({ silent: true }),
            loadProkerData({ force: true, silent: true }),
            loadRapatData({ force: true, silent: true }),
            loadKontenData({ silent: true })
        ]);
        showToast('Data berhasil di-refresh!', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error saat refresh data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function clearCache() {
    const ok = await showConfirm('Tindakan ini akan menghapus semua data sementara dan mengeluarkan Anda dari Mode SC. Gunakan hanya jika aplikasi terasa bermasalah. Lanjutkan?', {
        title: 'Reset Aplikasi',
        okText: 'Ya, Reset'
    });

    if (!ok) return;

    localStorage.removeItem('prokerDataCache');
    localStorage.removeItem('prokerDataCache_time');
    localStorage.removeItem('kontenDataCache');
    localStorage.removeItem('kontenDataCache_time');
    sessionStorage.clear();
    location.reload(); // Reload halaman untuk reset semua state
}

function showHelpModal() {
    document.getElementById('help-modal').classList.add('show');
}

function closeHelpModal() {
    document.getElementById('help-modal').classList.remove('show');
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

    showLoading('Sedang memvalidasi akun...');
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

            renderProkerView(); // Re-render table with SC buttons if already in proker section
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
        switchBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Keluar Mode SC';
        switchBtn.onclick = logoutSC;
        addProkerBtn.style.display = 'inline-flex';
        bulkProkerBtn.style.display = 'inline-flex';

        if (kontenTab) {
            kontenTab.style.pointerEvents = 'none';
            kontenTab.style.opacity = '0.5';
            kontenTab.style.cursor = 'not-allowed';
            kontenTab.title = 'Tab ini tidak tersedia di Mode SC';
        }
        const pengurusTab = document.getElementById('tab-pengurus');
        if (pengurusTab) {
            pengurusTab.style.pointerEvents = 'none';
            pengurusTab.style.opacity = '0.5';
            pengurusTab.style.cursor = 'not-allowed';
            pengurusTab.title = 'Tab ini tidak tersedia di Mode SC';
        }
        if (welcomeTitle && currentUser) {
            welcomeTitle.textContent = `Selamat datang ${currentUser.nama || currentUser.username} di Mode Steering Committee`;
        }
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Anda dapat mengedit program kerja dalam mode ini';
        }

        indicator.style.display = 'flex';
        bulkHeader.forEach(el => el.style.display = 'table-cell');
        const guideBtn = document.getElementById('admin-guide-btn');
        if (guideBtn) guideBtn.style.display = 'flex';
        startSCPolling();
    } else {
        modeBadge.textContent = 'Mode: Staff';
        modeBadge.className = 'mode-badge';
        switchBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Masuk Mode SC';
        switchBtn.onclick = showLoginModal;
        addProkerBtn.style.display = 'none';
        bulkProkerBtn.style.display = 'none';

        if (kontenTab) {
            kontenTab.style.pointerEvents = 'auto';
            kontenTab.style.opacity = '1';
            kontenTab.style.cursor = 'pointer';
            kontenTab.title = '';
        }
        const pengurusTab = document.getElementById('tab-pengurus');
        if (pengurusTab) {
            pengurusTab.style.pointerEvents = 'auto';
            pengurusTab.style.opacity = '1';
            pengurusTab.style.cursor = 'pointer';
            pengurusTab.title = '';
        }
        if (welcomeTitle) {
            welcomeTitle.textContent = 'Selamat datang di HIMAGRO HUB';
        }
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Dashboard Monitoring Program Kerja dan Konten Media Sosial HIMAGRO';
        }

        indicator.style.display = 'none';
        bulkHeader.forEach(el => el.style.display = 'none');
        document.getElementById('proker-bulk-actions').style.display = 'none';
        const guideBtn = document.getElementById('admin-guide-btn');
        if (guideBtn) guideBtn.style.display = 'none';
        stopSCPolling();
    }

    // Lock/Unlock Proker Views
    const prokerViewButtons = document.querySelectorAll('#proker-section .view-btn');
    prokerViewButtons.forEach(btn => {
        const view = btn.dataset.view;
        if (currentMode === 'sc' && view === 'calendar') {
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
    // Cek jika di SC mode dan mencoba akses konten atau kalender pengurus
    if (currentMode === 'sc' && (section === 'konten' || section === 'pengurus')) {
        return;
    }

    currentSection = section;

    // Update tab buttons
    document.getElementById('tab-proker').classList.toggle('active', section === 'proker');
    if (document.getElementById('tab-pengurus')) {
        document.getElementById('tab-pengurus').classList.toggle('active', section === 'pengurus');
    }
    document.getElementById('tab-konten').classList.toggle('active', section === 'konten');

    // Show/hide sections
    document.getElementById('proker-section').style.display = section === 'proker' ? 'block' : 'none';
    const pengurusSection = document.getElementById('pengurus-section');
    if (pengurusSection) {
        pengurusSection.style.display = section === 'pengurus' ? 'block' : 'none';
    }
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
    } else if (section === 'pengurus') {
        renderPengurusCalendar();
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
    if (!force && cacheTime && (now - parseInt(cacheTime)) < 300000) {
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

            // Update only if data is different or it's a forced manual load
            if (isDifferent || (force && !silent)) {
                processProkerData(result.data);

                // Show notification if data changed in background
                if (silent && isDifferent && lastProkerDataHash !== '') {
                    // Silent update, no toast to keep it seamless
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

async function loadRapatData(options = {}) {
    const force = typeof options === 'boolean' ? options : (options.force || false);
    const silent = options.silent || false;
    const cacheKey = 'rapatDataCache';
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const now = Date.now();

    // Use cache if valid and NOT forced
    if (!force && cacheTime && (now - parseInt(cacheTime)) < 300000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                processRapatData(cachedData);
                console.log('Loaded rapat data from cache');
                return;
            } catch (e) { console.error('Error parsing rapat cache:', e); }
        }
    }

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllRapat&_=${now}`);
        const result = await response.json();

        if (result.success) {
            const currentHash = JSON.stringify(result.data);
            const isDifferent = currentHash !== lastRapatDataHash;

            if (isDifferent || (force && !silent)) {
                processRapatData(result.data);
                lastRapatDataHash = currentHash;
                localStorage.setItem(cacheKey, currentHash);
                localStorage.setItem(cacheKey + '_time', now.toString());
            }
        }
    } catch (error) {
        console.error('Error loading rapat:', error);
    }
}

function processRapatData(data) {
    rapatData = data.map(item => {
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

    if (currentSection === 'pengurus') {
        renderPengurusCalendar();
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

    if (currentSection === 'pengurus') {
        renderPengurusCalendar();
    }
}

function sortProkerByMonth() {
    filteredProker.sort((a, b) => {
        if (!a.dateObj && !b.dateObj) return 0;
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        return b.dateObj - a.dateObj;
    });
}



function renderProkerView() {
    // Force 'all' view since monthly is removed
    renderProkerTable();
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
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Tidak ada data</td></tr>';
        return;
    }

    const rows = filteredProker.map((proker, index) => {
        const isFinished = proker.statusSelesai;
        const divisiName = divisiMap[proker.divisiId] || proker.divisiId || '-';
        const picName = picMap[proker.picId]?.nama || proker.picId || '-';
        const dateStr = formatDate(proker.tanggal || '');

        if (canEdit) {
            return `
                <tr class="${isFinished ? 'status-success' : ''}" data-proker-id="${proker.id}" onclick="toggleProkerDetail('${proker.id}')" style="cursor: pointer;">
                    <td class="sc-only-header" onclick="event.stopPropagation();" style="text-align: center;">
                        <input type="checkbox" class="proker-checkbox" value="${proker.id}" onchange="updateBulkActionUI()">
                    </td>
                    <td>${index + 1}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <button class="detail-toggle-btn" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}')" id="detail-toggle-${proker.id}" title="Tampilkan detail">
                                <i class="detail-toggle-icon fa-solid fa-chevron-down"></i>
                            </button>
                            <span>${escapeHtml(proker.nama || '')}</span>
                        </div>
                    </td>
                    <td onclick="event.stopPropagation();">${escapeHtml(divisiName)}</td>
                    <td onclick="event.stopPropagation();">${escapeHtml(picName)}</td>
                    <td onclick="event.stopPropagation();">${dateStr}</td>
                    <td onclick="event.stopPropagation();">
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
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
                        </div>
                    </td>
                    <td onclick="event.stopPropagation();">
                        <div class="btn-group">
                            <button class="btn btn-edit" onclick="event.stopPropagation(); editProker('${proker.id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                            <button class="btn btn-danger" onclick="event.stopPropagation(); deleteProker('${proker.id}')"><i class="fa-solid fa-trash-can"></i> Hapus</button>
                        </div>
                    </td>
                </tr>`;
        } else {
            return `
                <tr class="${isFinished ? 'status-success' : ''}" data-proker-id="${proker.id}" onclick="toggleProkerDetail('${proker.id}')" style="cursor: pointer;">
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
                    <td onclick="event.stopPropagation();">${escapeHtml(divisiName)}</td>
                    <td onclick="event.stopPropagation();">${escapeHtml(picName)}</td>
                    <td onclick="event.stopPropagation();">${dateStr}</td>
                    <td onclick="event.stopPropagation();">${isFinished ? '<span class="status-badge status-completed">Selesai</span>' : ''}</td>
                    <td onclick="event.stopPropagation();">
                        <button class="btn btn-sm" style="background: var(--primary-color); color: white; padding: 0.5rem 1rem;" onclick="event.stopPropagation(); toggleProkerDetail('${proker.id}')">Detail</button>
                    </td>
                </tr>`;
        }
    });

    tbody.innerHTML = rows.join('');
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
    const dayHeaders = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
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

function renderPengurusCalendar() {
    const container = document.getElementById('pengurus-calendar-container');
    const monthYear = document.getElementById('pengurus-calendar-month-year');

    if (!container || !monthYear) return;

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    monthYear.textContent = `${monthNames[currentPengurusCalendarMonth]} ${currentPengurusCalendarYear}`;

    const firstDay = new Date(currentPengurusCalendarYear, currentPengurusCalendarMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let html = '<div class="calendar-grid">';

    // Day headers
    const dayHeaders = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Calendar days
    const currentDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
        const isCurrentMonth = currentDate.getMonth() === currentPengurusCalendarMonth;
        const isToday = isSameDay(currentDate, new Date());

        // Items on this day
        const items = [];

        // 1. Prokers
        prokerData.forEach(p => {
            if (p.dateObj && !isNaN(p.dateObj.getTime()) && isSameDay(p.dateObj, currentDate)) {
                items.push({
                    type: 'proker',
                    nama: p.nama,
                    statusSelesai: p.statusSelesai,
                    id: p.id
                });
            }
        });

        // 2. Rapats
        rapatData.forEach(r => {
            if (r.dateObj && !isNaN(r.dateObj.getTime()) && isSameDay(r.dateObj, currentDate)) {
                items.push({
                    type: 'rapat',
                    nama: `${r.jenisRapat} (${r.namaProker || ''})`,
                    statusSelesai: r.statusRapat === true || r.statusRapat === 'TRUE' || r.statusRapat === 'true',
                    id: r.prokerId
                });
            }
        });

        html += `
            <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
                 onclick="showCalendarDayDetails('${currentDate.toDateString()}', 'pengurus')"
                 style="cursor: pointer;">
                <div class="calendar-day-number">${currentDate.getDate()}</div>
                ${items.length > 0 ? `
                    ${items.slice(0, 2).map(item => `
                        <div class="calendar-event-item ${item.type === 'rapat' ? 'rapat-event' : ''} ${item.statusSelesai ? 'status-success' : ''}" title="${escapeHtml(item.nama)}">
                            ${escapeHtml(item.nama.substring(0, 15))}${item.nama.length > 15 ? '...' : ''}
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

function changePengurusCalendarMonth(delta) {
    currentPengurusCalendarMonth += delta;
    if (currentPengurusCalendarMonth < 0) {
        currentPengurusCalendarMonth = 11;
        currentPengurusCalendarYear--;
    } else if (currentPengurusCalendarMonth > 11) {
        currentPengurusCalendarMonth = 0;
        currentPengurusCalendarYear++;
    }
    renderPengurusCalendar();
}

// Update filterProkerByMonth removed in favor of direct applyFilters call


// Fungsi untuk apply filters dan render (untuk mengganti applyFilters yang hilang)
function applyFilters() {
    const searchTerm = document.getElementById('proker-search')?.value.toLowerCase() || '';
    const monthFilter = (currentProkerMonth !== null && currentProkerMonth !== "") ? parseInt(currentProkerMonth) :
        (document.getElementById('proker-month-select')?.value !== "" ? parseInt(document.getElementById('proker-month-select')?.value) : null);
    const divisiFilter = document.getElementById('proker-divisi-select')?.value || '';

    filteredProker = prokerData.filter(p => {
        if (p.isActive === false) return false;

        // Month Filter
        if (monthFilter !== null) {
            if (p.dateObj && p.dateObj.getMonth() !== monthFilter) return false;
        }

        // Division Filter
        if (divisiFilter && p.divisiId !== divisiFilter) return false;

        // Search Filter (enhanced O(1) lookup)
        if (searchTerm) {
            const picInfo = picMap[p.picId];
            const picName = picInfo ? picInfo.namaLower : '';
            const matches = (p.nama || '').toLowerCase().includes(searchTerm) ||
                (p.id || '').toLowerCase().includes(searchTerm) ||
                (p.divisiId || '').toLowerCase().includes(searchTerm) ||
                picName.includes(searchTerm);
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
    // Proker Option: Add empty/all option first
    const prokerAllOpt = document.createElement('option');
    prokerAllOpt.value = "";
    prokerAllOpt.textContent = "Semua Bulan";
    prokerSelect.appendChild(prokerAllOpt);

    // Konten Option: Add empty/all option first
    const kontenAllOpt = document.createElement('option');
    kontenAllOpt.value = "";
    kontenAllOpt.textContent = "Semua Bulan";
    kontenSelect.appendChild(kontenAllOpt);

    currentProkerMonth = null; // Default to all
    currentKontenMonth = null; // Reset initial state to be updated below

    monthNames.forEach((name, index) => {
        // Proker Option
        const optProker = document.createElement('option');
        optProker.value = index;
        optProker.textContent = name;
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
    if (prokerData.length > 0) applyFilters();
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





// Toggle detail proker (expandable, bukan modal)
function toggleProkerDetail(id) {
    if (!id) return;

    const detailId = `proker-detail-${id}`;

    // Find the proker item based on current view to ensure we toggle the one in front of us
    // Proker item is now always in the table (tbody) since monthly view is removed
    const prokerItem = document.querySelector(`#proker-tbody tr[data-proker-id="${id}"]`);

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
                toggleIcon.className = 'detail-toggle-icon fa-solid fa-chevron-up open';
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
                toggleIcon.className = 'detail-toggle-icon fa-solid fa-chevron-down';
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
            toggleIcon.className = 'detail-toggle-icon fa-solid fa-chevron-up open';
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
            toggleIcon.className = 'detail-toggle-icon fa-solid fa-chevron-up open';
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
                <div\u003e
                    <strong\u003eNama Proker:\u003c/strong\u003e<br\u003e
                    <span\u003e${escapeHtml(proker.nama || '-')}\u003c/span\u003e
                \u003c/div\u003e
                <div\u003e
                    <strong\u003eDivisi:\u003c/strong\u003e<br\u003e
                    <span\u003e${escapeHtml(divisiMap[proker.divisiId] || proker.divisiId || '-')}\u003c/span\u003e
                \u003c/div\u003e
                <div\u003e
                    <strong\u003ePIC Proker:\u003c/strong\u003e<br\u003e
                    <span\u003e${escapeHtml(picMap[proker.picId]?.nama || proker.picId || '-')}\u003c/span\u003e
                \u003c/div\u003e
                <div\u003e
                    <strong\u003eTanggal:\u003c/strong\u003e<br\u003e
                    <span\u003e${formatDate(proker.tanggal) || '-'}\u003c/span\u003e
                \u003c/div\u003e
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
                    <span>Proposal: ${proker.proposal ? '<i class="fa-solid fa-circle-check" style="color: var(--success-color)"></i>' : '<i class="fa-solid fa-circle-xmark" style="color: var(--danger-color)"></i>'}</span>
                    <span>RAK: ${proker.rak ? '<i class="fa-solid fa-circle-check" style="color: var(--success-color)"></i>' : '<i class="fa-solid fa-circle-xmark" style="color: var(--danger-color)"></i>'}</span>
                    <span>RAB: ${proker.rab ? '<i class="fa-solid fa-circle-check" style="color: var(--success-color)"></i>' : '<i class="fa-solid fa-circle-xmark" style="color: var(--danger-color)"></i>'}</span>
                    <span>LPJ: ${proker.lpj ? '<i class="fa-solid fa-circle-check" style="color: var(--success-color)"></i>' : '<i class="fa-solid fa-circle-xmark" style="color: var(--danger-color)"></i>'}</span>
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
                                    <span><strong>Tanggal:</strong> ${formatDate(r.tanggalRap) || '-'}</span>
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
    // Proker item is now always in the table (tbody) since monthly view is removed
    const tbody = document.getElementById('proker-tbody');
    const prokerItem = tbody.querySelector(`tr[data-proker-id="${id}"]`);

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
        const cell = existingDetail.cells[0];
        const detailDiv = cell.querySelector('.proker-detail-expanded'); // This is the animating div
        detailDiv.innerHTML = html;
        if (detailDiv.style.maxHeight !== '0px') {
            detailDiv.style.maxHeight = detailDiv.scrollHeight + 'px';
        }
    } else {
        // Insert detail after the item dengan animasi
        const tbody = prokerItem.parentElement;
        const newRow = tbody.insertRow(prokerItem.sectionRowIndex + 1);
        newRow.id = detailId;
        const cell = newRow.insertCell(0);
        cell.colSpan = 7; // Updated for all columns
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
                    <span>Tanggal: ${formatDate(r.tanggalRap) || '-'}</span>
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

        if (!nama) {
            if (tanggal || divisiId || picId) { // Error if partially filled without name
                showToast(`Mohon isi Nama Proker untuk baris #${index + 1}`, 'error');
                hasError = true;
            }
            return;
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
            divisiId: divisiId || '',
            picId: picId || '',
            tanggal: tanggal || '',
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
        showToast('Minimal masukkan 1 nama proker', 'warning');
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

            // Optimistic update for bulk add
            if (result.data && Array.isArray(result.data)) {
                result.data.forEach((res, i) => {
                    if (res.success && res.data) {
                        const optimisticProker = {
                            ...newProkers[i],
                            id: res.data.id,
                            isActive: true,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        prokerData.unshift(optimisticProker);
                    }
                });
                processProkerData(prokerData);
            }

            closeBulkProkerModal();
            loadProkerData({ force: true, silent: true });
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
                <label>Jenis Rapat</label>
                <select class="rapat-jenis-select" required>
                    <option value="">Pilih Jenis Rapat</option>
                    ${masterRapat.map(r => `<option value="${escapeHtml(r.jenisRapat)}">${escapeHtml(r.jenisRapat)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Tanggal Rapat</label>
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

    showLoading('Sedang menghapus proker...');
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

async function loadKontenData(options = {}) {
    const silent = options.silent || false;
    const force = options.force || false;
    const cacheKey = 'kontenDataCache';
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const now = Date.now();

    // Use cache if available and NOT forced
    if (!force && cacheTime && (now - parseInt(cacheTime)) < 300000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                processKontenData(cachedData);
                console.log('Loaded konten data from cache');
                return;
            } catch (e) { console.error('Error parsing cache:', e); }
        }
    }

    if (!silent) showLoading('Sedang memuat data konten...');
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getKonten&_=${now}`);
        const result = await response.json();

        if (result.success) {
            const currentHash = JSON.stringify(result.data);
            const isDifferent = currentHash !== lastKontenDataHash;

            if (isDifferent || (force && !silent)) {
                processKontenData(result.data);
                lastKontenDataHash = currentHash;
                localStorage.setItem(cacheKey, currentHash);
                localStorage.setItem(cacheKey + '_time', now.toString());
            }
        } else if (!silent) {
            showToast('Gagal memuat data Konten: ' + result.message, 'error');
        }
    } catch (error) {
        if (!silent) showToast('Error: ' + error.message, 'error');
        console.error('Error loading konten:', error);
    } finally {
        if (!silent) hideLoading();
    }
}

function processKontenData(data) {
    kontenData = data.map(item => {
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

    // Both views use the same controls row now
    document.getElementById('konten-all-view').style.display =
        view === 'all' ? 'block' : 'none';
    document.getElementById('konten-calendar-view').style.display =
        view === 'calendar' ? 'block' : 'none';

    renderKontenView();
}

function renderKontenView() {
    if (currentKontenView === 'all') {
        renderKontenTable();
    } else if (currentKontenView === 'calendar') {
        renderKontenCalendar();
    }
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

    const dayHeaders = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
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

function applyKontenFilters() {
    const searchTerm = document.getElementById('konten-search')?.value.toLowerCase() || '';
    const monthFilter = document.getElementById('konten-month-select')?.value;

    filteredKonten = kontenData.filter(konten => {
        // Search Filter
        const matchesSearch = !searchTerm || (konten.nama || '').toLowerCase().includes(searchTerm);

        // Month Filter
        let matchesMonth = true;
        if (monthFilter !== "" && monthFilter !== null) {
            matchesMonth = konten.dateObj && konten.dateObj.getMonth() === parseInt(monthFilter);
        }

        return matchesSearch && matchesMonth;
    });

    sortKontenByMonth();
    renderKontenView();
}

function filterKontenByMonth() {
    applyKontenFilters();
}

function searchKonten() {
    applyKontenFilters();
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

function showLoading(text = 'Sedang memuat...') {
    const loadingTextEl = document.getElementById('loading-text');
    if (loadingTextEl) loadingTextEl.textContent = text;
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

    showLoading(`Sedang menyimpan ${updates.length} perubahan...`);
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

// ==================== ADMIN GUIDE (PEWARISAN) ====================

function showAdminGuide() {
    // Reset to first tab
    switchAGTab('ag-task');
    document.getElementById('admin-guide-modal').classList.add('show');
}

function closeAdminGuide() {
    document.getElementById('admin-guide-modal').classList.remove('show');
}

function switchAGTab(tabId) {
    // Hide all content
    document.querySelectorAll('.ag-content').forEach(el => {
        el.style.display = 'none';
    });
    // Remove active class from tabs
    document.querySelectorAll('.ag-tab').forEach(el => {
        el.classList.remove('active');
    });

    // Show selected content
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.style.display = 'block';
    }

    // Add active class to clicked tab
    // Find the button that has the onclick matching this tabId
    document.querySelectorAll('.ag-tab').forEach(btn => {
        if (btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });
}

// ==================== PWA INSTALLATION LOGIC ====================
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Tangkap prompt instalasi
    e.preventDefault();
    deferredPrompt = e;
    // Tampilkan tombol instalasi
    if (installBtn) installBtn.style.display = 'inline-flex';
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        // Tampilkan prompt ke user
        deferredPrompt.prompt();
        // Tunggu respon user
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // Reset prompt agar tidak bisa digunakan lagi
        deferredPrompt = null;
        // Sembunyikan tombol
        installBtn.style.display = 'none';
    });
}

window.addEventListener('appinstalled', (evt) => {
    console.log('HIMAGRO HUB was installed.');
    if (installBtn) installBtn.style.display = 'none';
});
