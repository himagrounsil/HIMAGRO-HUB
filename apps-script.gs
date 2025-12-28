/**
 * HIMAGRO Hub - Apps Script Backend
 * 
 * INSTRUKSI SETUP:
 * 1. Buka Google Apps Script (script.google.com)
 * 2. Buat project baru
 * 3. Copy paste semua kode ini
 * 4. Ganti SPREADSHEET_ID_PROKER dan SPREADSHEET_ID_KONTEN dengan ID spreadsheet Anda
 * 5. Deploy sebagai Web App
 * 6. Set execute as: Me (your email)
 * 7. Set access: Anyone (atau Anyone with Google account)
 * 8. Copy Web App URL dan paste ke script.js (variabel APPS_SCRIPT_URL)
 */

// ==================== KONFIGURASI ====================
// GANTI ID SPREADSHEET ANDA DI SINI
const SPREADSHEET_ID_PROKER = '1q78bgXcbS1pHizgXnY43fJSezlZxwK3R73JAGP_05No';
const SPREADSHEET_ID_KONTEN = '1HfFmOx8iGWvA_XEWvz8RSBMxxbOZKCA459fOkD1JT_E';

// Nama sheet di Spreadsheet Proker
const SHEET_NAME_PROKER = 'Proker';
const SHEET_NAME_RAPAT_PROKER = 'Rapat_Proker';
const SHEET_NAME_MASTER_SC = 'Master_SC';
const SHEET_NAME_MASTER_DIVISI = 'Master_Divisi';
const SHEET_NAME_MASTER_PIC = 'Master_PIC';
const SHEET_NAME_MASTER_RAPAT = 'Master_Rapat';
const SHEET_NAME_HISTORY_LOG = 'History_Log';
const SHEET_NAME_ACTIVE_SESSIONS = 'Active_Sessions';

// Nama sheet di Spreadsheet Konten
const SHEET_NAME_CONTENT_PLANNER = 'Content Planner';

// ==================== DOGET - HANDLE GET REQUESTS ====================
function doGet(e) {
  // Handle jika e atau e.parameter undefined
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Request parameter tidak valid'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const action = e.parameter.action;
  
  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Action parameter tidak ditemukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    switch(action) {
      case 'getProker':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getProkerData()
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'getProkerDetail':
        const prokerId = e.parameter.id;
        if (!prokerId) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ID parameter tidak ditemukan'
          })).setMimeType(ContentService.MimeType.JSON);
        }
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getProkerDetail(prokerId)
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'getKonten':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getKontenData()
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'validateLogin':
        const username = e.parameter.username;
        const password = e.parameter.password;
        if (!username || !password) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            data: { valid: false, message: 'Username dan password harus diisi' }
          })).setMimeType(ContentService.MimeType.JSON);
        }
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: validateLogin(username, password)
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'getMasterDivisi':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getMasterDivisi()
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'getMasterPIC':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getMasterPIC()
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'getMasterRapat':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getMasterRapat()
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'updatePresence':
        const scIdP = e.parameter.scId;
        const namaP = e.parameter.nama;
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: updatePresence(scIdP, namaP)
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'getActiveSCs':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: getActiveSCs()
        })).setMimeType(ContentService.MimeType.JSON);
        
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Action tidak valid: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== DOPOST - HANDLE POST REQUESTS ====================
function doPost(e) {
  // Handle jika e atau e.parameter undefined
  if (!e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Request parameter tidak valid'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Get action dari parameter atau postData
  let action = null;
  let postData = {};
  
  // Cek action di parameter dulu
  if (e.parameter && e.parameter.action) {
    action = e.parameter.action;
  }
  
  // Parse postData jika ada
  if (e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      postData = parsed;
      // Jika action tidak ada di parameter, cek di postData
      if (!action && parsed.action) {
        action = parsed.action;
      }
    } catch (error) {
      Logger.log('Error parsing JSON: ' + error.toString());
      // Jika bukan JSON, mungkin form data
      if (e.postData.type === 'application/x-www-form-urlencoded') {
        const params = e.parameter || {};
        action = params.action || null;
        postData = params;
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Invalid JSON data: ' + error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  } else if (e.parameter) {
    // Jika tidak ada postData, gunakan parameter
    postData = e.parameter;
  }
  
  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Action parameter tidak ditemukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    switch(action) {
      case 'createProker':
        const username = postData.username || '';
        const scId = postData.scId || '';
        const nama = postData.scNama || postData.nama || ''; // Gunakan scNama jika ada, fallback ke nama
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: createProker(postData, username, scId, nama)
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'batchCreateProker':
        const prokersToCreate = postData.prokers || [];
        const createResults = [];
        const createLock = LockService.getScriptLock();
        try {
          createLock.waitLock(60000); // 1 min
          prokersToCreate.forEach(pData => {
            try {
              const res = createProker(pData, pData.username, pData.scId, pData.scNama, true);
              createResults.push({ success: true, data: res });
            } catch (err) {
              createResults.push({ success: false, message: err.toString() });
            }
          });
        } finally {
          createLock.releaseLock();
        }
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: createResults
        })).setMimeType(ContentService.MimeType.JSON);

        
      case 'updateProker':
        const updateId = (e.parameter && e.parameter.id) ? e.parameter.id : null;
        if (!updateId) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ID parameter tidak ditemukan'
          })).setMimeType(ContentService.MimeType.JSON);
        }
        const updateUsername = postData.username || '';
        const updateScId = postData.scId || '';
        const updateNama = postData.scNama || postData.nama || ''; // Gunakan scNama jika ada, fallback ke nama
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: updateProker(updateId, postData, updateUsername, updateScId, updateNama)
        })).setMimeType(ContentService.MimeType.JSON);

      case 'batchUpdateProker':
        const batchUsername = postData.username || '';
        const batchScId = postData.scId || '';
        const batchNama = postData.scNama || postData.nama || '';
        const updates = postData.updates || [];
        const results = [];
        
        const batchLock = LockService.getScriptLock();
        try {
          batchLock.waitLock(60000); // 1 min for batch
          updates.forEach(update => {
            try {
              // Kita panggil updateProker. Karena script execution sama, waitLock di dalamnya langsung return.
              // TAPI releaseLock di akhir updateProker akan melepaskan lock script!! 
              // Jadi kita harus memindahkan lock ke luar atau menggunakan flag.
              const res = updateProker(update.id, update.data, batchUsername, batchScId, batchNama, true);
              results.push({ id: update.id, success: true, data: res });
            } catch (err) {
              results.push({ id: update.id, success: false, message: err.toString() });
            }
          });
        } finally {
          batchLock.releaseLock();
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: results
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'deleteProker':
        const deleteId = (e.parameter && e.parameter.id) ? e.parameter.id : null;
        if (!deleteId) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ID parameter tidak ditemukan'
          })).setMimeType(ContentService.MimeType.JSON);
        }
        const deleteUsername = (e.parameter && e.parameter.username) ? e.parameter.username : '';
        const deleteScId = (e.parameter && e.parameter.scId) ? e.parameter.scId : '';
        const deleteNama = (e.parameter && e.parameter.nama) ? e.parameter.nama : '';
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: deleteProker(deleteId, deleteUsername, deleteScId, deleteNama)
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'batchDeleteProker':
        const batchDelUsername = (postData.username) || '';
        const batchDelScId = (postData.scId) || '';
        const batchDelNama = (postData.scNama || postData.nama) || '';
        const idsToDelete = postData.ids || [];
        const delResults = [];
        
        const delLock = LockService.getScriptLock();
        try {
          delLock.waitLock(60000);
          idsToDelete.forEach(id => {
            try {
              const res = deleteProker(id, batchDelUsername, batchDelScId, batchDelNama, true);
              delResults.push({ id: id, success: true, message: res });
            } catch (err) {
              delResults.push({ id: id, success: false, message: err.toString() });
            }
          });
        } finally {
          delLock.releaseLock();
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: delResults
        })).setMimeType(ContentService.MimeType.JSON);
        
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Action tidak valid: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validasi login dari sheet Master_SC
 */
function validateLogin(username, password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_MASTER_SC);
    
    if (!sheet) {
      return { valid: false, message: 'Sheet Master_SC tidak ditemukan' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      return { valid: false, message: 'Tidak ada data SC' };
    }
    
    const rows = data.slice(1);
    
    // Cari user dengan username dan password yang sesuai
    // Format: SC_ID | Nama | Email | Username | Password | Jabatan | Is_Active
    const trimmedUsername = String(username || '').trim();
    const trimmedPassword = String(password || '').trim();
    
    Logger.log('Validating login for username: ' + trimmedUsername);
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowUsername = String(row[3] || '').trim(); // Kolom D: Username
      const rowPassword = String(row[4] || '').trim(); // Kolom E: Password
      const isActiveValue = row[6]; // Kolom G: Is_Active
      
      // Handle checkbox value (bisa TRUE, true, TRUE checkbox, atau boolean)
      let isActive = false;
      if (typeof isActiveValue === 'boolean') {
        isActive = isActiveValue;
      } else if (typeof isActiveValue === 'string') {
        isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === 'TRUE';
      } else {
        isActive = Boolean(isActiveValue);
      }
      
      Logger.log('Row ' + (i + 2) + ': username="' + rowUsername + '", password="' + rowPassword + '", isActive=' + isActive);
      
      // Compare username dan password (case-sensitive untuk password, tapi bisa disesuaikan)
      if (rowUsername === trimmedUsername && rowPassword === trimmedPassword) {
        if (!isActive) {
          Logger.log('Login failed: Account is not active');
          return { valid: false, message: 'Akun tidak aktif' };
        }
        
        Logger.log('Login successful for: ' + rowUsername);
        return {
          valid: true,
          scId: String(row[0] || ''), // SC_ID
          nama: String(row[1] || ''), // Nama
          email: String(row[2] || ''), // Email
          username: rowUsername,
          jabatan: String(row[5] || '') // Jabatan
        };
      }
    }
    
    Logger.log('Login failed: Username or password incorrect');
    return { valid: false, message: 'Username atau password salah' };
  } catch (error) {
    Logger.log('Error validateLogin: ' + error.toString());
    return { valid: false, message: error.toString() };
  }
}

// ==================== PROKER FUNCTIONS (CRUD) ====================

/**
 * Get semua data Proker dari spreadsheet
 * Format kolom: Proker_ID | Nama_Proker | Divisi_ID | PIC_ID | Tanggal_Pelaksana | 
 *                Proposal | RAK | RAB | LPJ | Status_Selesai | Is_Active | Created_At | Updated_At
 */
function getProkerData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_PROKER);
    
    if (!sheet) {
      throw new Error('Sheet Proker tidak ditemukan');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      return [];
    }
    
    const rows = data.slice(1);
    
    return rows.map((row, index) => {
      return {
        id: row[0] || '', // Proker_ID
        nama: row[1] || '', // Nama_Proker
        divisiId: row[2] || '', // Divisi_ID
        picId: row[3] || '', // PIC_ID
        tanggal: row[4] ? formatDateForOutput(row[4]) : '', // Tanggal_Pelaksana
        proposal: row[5] || false, // Proposal (checkbox)
        rak: row[6] || false, // RAK (checkbox)
        rab: row[7] || false, // RAB (checkbox)
        lpj: row[8] || false, // LPJ (checkbox)
        statusSelesai: row[9] || false, // Status_Selesai (checkbox)
        isActive: row[10] || false, // Is_Active (checkbox)
        createdAt: row[11] ? formatDateForOutput(row[11]) : '', // Created_At
        updatedAt: row[12] ? formatDateForOutput(row[12]) : '' // Updated_At
      };
    }).filter(row => row.id && row.nama); // Filter hanya yang memiliki ID dan Nama (row yang tidak kosong)
  } catch (error) {
    Logger.log('Error getProkerData: ' + error.toString());
    throw error;
  }
}

/**
 * Get detail proker termasuk data rapat
 */
function getProkerDetail(prokerId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const prokerSheet = ss.getSheetByName(SHEET_NAME_PROKER);
    const rapatSheet = ss.getSheetByName(SHEET_NAME_RAPAT_PROKER);
    
    if (!prokerSheet) {
      throw new Error('Sheet Proker tidak ditemukan');
    }
    
    // Get data proker
    const prokerData = prokerSheet.getDataRange().getValues();
    let proker = null;
    
    for (let i = 1; i < prokerData.length; i++) {
      if (prokerData[i][0] == prokerId) { // Proker_ID di kolom A
        proker = {
          id: prokerData[i][0] || '',
          nama: prokerData[i][1] || '',
          divisiId: prokerData[i][2] || '',
          picId: prokerData[i][3] || '',
          tanggal: prokerData[i][4] ? formatDateForOutput(prokerData[i][4]) : '',
          proposal: prokerData[i][5] || false,
          rak: prokerData[i][6] || false,
          rab: prokerData[i][7] || false,
          lpj: prokerData[i][8] || false,
          statusSelesai: prokerData[i][9] || false,
          isActive: prokerData[i][10] || false,
          createdAt: prokerData[i][11] ? formatDateForOutput(prokerData[i][11]) : '',
          updatedAt: prokerData[i][12] ? formatDateForOutput(prokerData[i][12]) : ''
        };
        break;
      }
    }
    
    if (!proker) {
      throw new Error('Proker tidak ditemukan');
    }
    
    // Get data rapat proker
    let rapatList = [];
    if (rapatSheet) {
      const rapatData = rapatSheet.getDataRange().getValues();
      // Format: RAPAT_ID | PROKER_ID | NAMA_PROKER | JENIS_RAPAT | TANGGAL_RAP | 
      //         PIC | PIC_EMAIL | STATUS_RAPAT | AKTIF
      for (let i = 1; i < rapatData.length; i++) {
        if (rapatData[i][1] == prokerId) { // PROKER_ID di kolom B
          const aktif = rapatData[i][8];
          // Filter hanya yang aktif (true)
          if (aktif === true || aktif === 'TRUE' || aktif === 'true' || aktif === 1) {
            rapatList.push({
              rapatId: rapatData[i][0] || '',
              prokerId: rapatData[i][1] || '',
              namaProker: rapatData[i][2] || '',
              jenisRapat: rapatData[i][3] || '',
              tanggalRap: rapatData[i][4] ? formatDateForOutput(rapatData[i][4]) : '',
              pic: rapatData[i][5] || '',
              picEmail: rapatData[i][6] || '',
              statusRapat: rapatData[i][7] || false,
              aktif: true
            });
          }
        }
      }
    }
    
    return {
      proker: proker,
      rapat: rapatList
    };
  } catch (error) {
    Logger.log('Error getProkerDetail: ' + error.toString());
    throw error;
  }
}

/**
 * Create Proker baru dengan history tracking
 */
function createProker(data, username, scId, nama, isInternal = false) {
  const lock = LockService.getScriptLock();
  try {
    if (!isInternal) lock.waitLock(30000); // Tunggu sampai 30 detik untuk mendapatkan lock
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_PROKER);
    
    if (!sheet) {
      throw new Error('Sheet Proker tidak ditemukan');
    }
    
    // Generate Proker_ID baru
    // Format: PROKER001, PROKER002, dst
    const dataRange = sheet.getDataRange();
    const allRows = dataRange.getValues();
    const existingIds = allRows.slice(1).map(row => String(row[0] || '').trim()).filter(id => id && id.startsWith('PROKER'));
    
    // Cari ID terbesar
    let maxNumber = 0;
    existingIds.forEach(id => {
      const match = id.match(/PROKER(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    // Generate ID baru
    const newId = 'PROKER' + String(maxNumber + 1).padStart(3, '0');
    
    Logger.log('Generated new Proker_ID: ' + newId);
    
    const now = new Date();
    const tanggal = data.tanggal ? formatDateForInput(data.tanggal) : now;
    
    // Cari baris kosong untuk reuse (cek kolom A)
    let rowNumber = 0;
    for (let i = 1; i < allRows.length; i++) {
        if (!allRows[i][0]) { // Jika ID kosong
            rowNumber = i + 1;
            break;
        }
    }
    
    // Jika tidak ada baris kosong, tambahkan di bawah
    if (rowNumber === 0) {
        rowNumber = sheet.getLastRow() + 1;
    }
    
    // Format: Proker_ID | Nama_Proker | Divisi_ID | PIC_ID | Tanggal_Pelaksana | 
    //         Proposal | RAK | RAB | LPJ | Status_Selesai | Is_Active | Created_At | Updated_At
    sheet.getRange(rowNumber, 1, 1, 13).setValues([[
      newId,
      data.nama || '',
      data.divisiId || '',
      data.picId || '',
      tanggal,
      data.proposal || false,
      data.rak || false,
      data.rab || false,
      data.lpj || false,
      data.statusSelesai || false,
      true, // Is_Active default true
      now, // Created_At
      now  // Updated_At
    ]]);
    
    // Set data validation untuk Divisi_ID dan PIC_ID (dropdown)
    try {
      // Set validation untuk Divisi_ID (kolom C)
      const divisiSheet = ss.getSheetByName(SHEET_NAME_MASTER_DIVISI);
      if (divisiSheet) {
        const divisiRange = divisiSheet.getRange(2, 1, divisiSheet.getLastRow() - 1, 1);
        const divisiValues = divisiRange.getValues().map(row => row[0]).filter(val => val);
        const divisiRule = SpreadsheetApp.newDataValidation()
          .requireValueInList(divisiValues, true)
          .setAllowInvalid(false)
          .build();
        sheet.getRange(rowNumber, 3).setDataValidation(divisiRule);
      }
      
      // Set validation untuk PIC_ID (kolom D)
      const picSheet = ss.getSheetByName(SHEET_NAME_MASTER_PIC);
      if (picSheet) {
        const picRange = picSheet.getRange(2, 1, picSheet.getLastRow() - 1, 1);
        const picValues = picRange.getValues().map(row => row[0]).filter(val => val);
        const picRule = SpreadsheetApp.newDataValidation()
          .requireValueInList(picValues, true)
          .setAllowInvalid(false)
          .build();
        sheet.getRange(rowNumber, 4).setDataValidation(picRule);
      }
      
      // Set format checkbox untuk Proposal, RAK, RAB, LPJ, Status_Selesai, Is_Active
      // Kolom F, G, H, I, J, K (indeks 6, 7, 8, 9, 10, 11)
      // Gunakan insertCheckboxes() jika tersedia, atau setDataValidation
      const checkboxRange = sheet.getRange(rowNumber, 6, 1, 6);
      try {
        // Coba insertCheckboxes() dulu (lebih baik)
        checkboxRange.insertCheckboxes();
      } catch (e) {
        // Fallback ke data validation
        const checkboxRule = SpreadsheetApp.newDataValidation()
          .requireCheckbox()
          .build();
        checkboxRange.setDataValidation(checkboxRule);
      }
    } catch (error) {
      Logger.log('Error setting data validation: ' + error.toString());
      // Continue even if validation fails
    }
    
    // Log history
    logHistory('CREATE', newId, data.nama || '', scId, nama, 'Proker', '', JSON.stringify(data));
    
    // Create rapat jika ada
    if (data.rapat && Array.isArray(data.rapat) && data.rapat.length > 0) {
      createRapatForProker(newId, data.nama, data.rapat, data.picId);
    }
    
    return {
      id: newId,
      nama: data.nama,
      tanggal: data.tanggal,
      statusSelesai: data.statusSelesai || false
    };
  } catch (error) {
    Logger.log('Error createProker: ' + error.toString());
    throw error;
  } finally {
    if (!isInternal) lock.releaseLock();
  }
}

/**
 * Create rapat untuk proker
 * PIC dan PIC_EMAIL akan diambil otomatis dari Master_PIC berdasarkan PIC_ID proker
 */
function createRapatForProker(prokerId, namaProker, rapatList, picId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const rapatSheet = ss.getSheetByName(SHEET_NAME_RAPAT_PROKER);
    const picSheet = ss.getSheetByName(SHEET_NAME_MASTER_PIC);
    
    if (!rapatSheet) {
      Logger.log('Sheet Rapat_Proker tidak ditemukan, skip create rapat');
      return;
    }
    
    // Get PIC data dari Master_PIC
    let picName = '';
    let picEmail = '';
    if (picId && picSheet) {
      const picData = picSheet.getDataRange().getValues();
      for (let i = 1; i < picData.length; i++) {
        if (String(picData[i][0] || '').trim() === picId) {
          picName = String(picData[i][1] || '').trim(); // Nama_PIC
          picEmail = String(picData[i][2] || '').trim(); // Email
          break;
        }
      }
    }
    
    const dataRange = rapatSheet.getDataRange();
    const allRows = dataRange.getValues();
    const existingIds = allRows.slice(1).map(row => String(row[0] || '').trim()).filter(id => id && id.startsWith('RAPAT'));
    
    // Cari ID terbesar
    let maxNumber = 0;
    existingIds.forEach(id => {
      const match = id.match(/RAPAT(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    // Track rows already used in this session to avoid overwriting
    let usedRowIndices = [];

    // Create rapat untuk setiap item
    rapatList.forEach((rapat, index) => {
      const rapatId = 'RAPAT' + String(maxNumber + index + 1).padStart(3, '0');
      const tanggalRap = rapat.tanggalRap ? formatDateForInput(rapat.tanggalRap) : new Date();
      
      // Cari baris kosong di rapatSheet (kolom A)
      const currentRapatData = rapatSheet.getDataRange().getValues();
      let rowNumber = 0;
      
      for (let j = 1; j < currentRapatData.length; j++) {
          if (!currentRapatData[j][0] && !usedRowIndices.includes(j + 1)) {
              rowNumber = j + 1;
              break;
          }
      }
      
      if (rowNumber === 0) {
          rowNumber = rapatSheet.getLastRow() + 1;
          // Cek lagi if lastRow + 1 was already used by a previous iteration in this loop
          while (usedRowIndices.includes(rowNumber)) {
            rowNumber++;
          }
      }
      
      usedRowIndices.push(rowNumber);

      rapatSheet.getRange(rowNumber, 1, 1, 9).setValues([[
        rapatId,
        prokerId,
        namaProker,
        rapat.jenisRapat || '',
        tanggalRap,
        picName, // Otomatis dari Master_PIC
        picEmail, // Otomatis dari Master_PIC
        rapat.statusRapat || false,
        rapat.aktif !== undefined ? rapat.aktif : true
      ]]);
      
      // Set data validation untuk Jenis_Rapat (dropdown) dan Status_Rapat (checkbox)
      try {
        // Dropdown untuk Jenis_Rapat (kolom D, index 4)
        const rapatMasterSheet = ss.getSheetByName(SHEET_NAME_MASTER_RAPAT);
        if (rapatMasterSheet) {
          const rapatRange = rapatMasterSheet.getRange(2, 1, rapatMasterSheet.getLastRow() - 1, 1);
          const rapatValues = rapatRange.getValues().map(row => row[0]).filter(val => val);
          const rapatRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(rapatValues, true)
            .setAllowInvalid(false)
            .build();
          rapatSheet.getRange(rowNumber, 4).setDataValidation(rapatRule);
        }
        
        // Checkbox untuk Status_Rapat (kolom H, index 8)
        const statusRange = rapatSheet.getRange(rowNumber, 8);
        try {
          statusRange.insertCheckboxes();
        } catch (e) {
          const checkboxRule = SpreadsheetApp.newDataValidation()
            .requireCheckbox()
            .build();
          statusRange.setDataValidation(checkboxRule);
        }
        
        // Checkbox untuk Aktif (kolom I, index 9)
        const aktifRange = rapatSheet.getRange(rowNumber, 9);
        try {
          aktifRange.insertCheckboxes();
        } catch (e) {
          const checkboxRule = SpreadsheetApp.newDataValidation()
            .requireCheckbox()
            .build();
          aktifRange.setDataValidation(checkboxRule);
        }
      } catch (error) {
        Logger.log('Error setting rapat data validation: ' + error.toString());
        // Continue even if validation fails
      }
    });
    
    Logger.log('Created ' + rapatList.length + ' rapat for proker: ' + prokerId);
  } catch (error) {
    Logger.log('Error createRapatForProker: ' + error.toString());
    // Jangan throw error, karena ini opsional
  }
}

/**
 * Update Proker dengan history tracking
 */
function updateProker(id, data, username, scId, nama, isInternal = false) {
  const lock = LockService.getScriptLock();
  try {
    if (!isInternal) lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_PROKER);
    
    if (!sheet) {
      throw new Error('Sheet Proker tidak ditemukan');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Cari row dengan Proker_ID yang sesuai
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] == id) {
        const oldData = {
          nama: values[i][1] || '',
          divisiId: values[i][2] || '',
          picId: values[i][3] || '',
          tanggal: values[i][4] ? formatDateForOutput(values[i][4]) : '',
          proposal: values[i][5] || false,
          rak: values[i][6] || false,
          rab: values[i][7] || false,
          lpj: values[i][8] || false,
          statusSelesai: values[i][9] || false
        };
        
        const tanggal = data.tanggal ? formatDateForInput(data.tanggal) : values[i][4];
        const now = new Date();
        
        const rowNum = i + 1;
        // Update row
        sheet.getRange(rowNum, 1, 1, 13).setValues([[
          id,
          data.nama || values[i][1],
          data.divisiId !== undefined ? data.divisiId : values[i][2],
          data.picId !== undefined ? data.picId : values[i][3],
          tanggal,
          data.proposal !== undefined ? data.proposal : values[i][5],
          data.rak !== undefined ? data.rak : values[i][6],
          data.rab !== undefined ? data.rab : values[i][7],
          data.lpj !== undefined ? data.lpj : values[i][8],
          data.statusSelesai !== undefined ? data.statusSelesai : values[i][9],
          values[i][10] || true, // Is_Active
          values[i][11] || now, // Created_At
          now  // Updated_At
        ]]);
        
        // Update data validation jika Divisi_ID atau PIC_ID berubah
        try {
          if (data.divisiId !== undefined) {
            const divisiSheet = ss.getSheetByName(SHEET_NAME_MASTER_DIVISI);
            if (divisiSheet) {
              const divisiRange = divisiSheet.getRange(2, 1, divisiSheet.getLastRow() - 1, 1);
              const divisiValues = divisiRange.getValues().map(row => row[0]).filter(val => val);
              const divisiRule = SpreadsheetApp.newDataValidation()
                .requireValueInList(divisiValues, true)
                .setAllowInvalid(false)
                .build();
              sheet.getRange(rowNum, 3).setDataValidation(divisiRule);
            }
          }
          
          if (data.picId !== undefined) {
            const picSheet = ss.getSheetByName(SHEET_NAME_MASTER_PIC);
            if (picSheet) {
              const picRange = picSheet.getRange(2, 1, picSheet.getLastRow() - 1, 1);
              const picValues = picRange.getValues().map(row => row[0]).filter(val => val);
              const picRule = SpreadsheetApp.newDataValidation()
                .requireValueInList(picValues, true)
                .setAllowInvalid(false)
                .build();
              sheet.getRange(rowNum, 4).setDataValidation(picRule);
            }
          }
          
          // Pastikan checkbox format tetap ada
          const checkboxRange = sheet.getRange(rowNum, 6, 1, 6);
          try {
            checkboxRange.insertCheckboxes();
          } catch (e) {
            const checkboxRule = SpreadsheetApp.newDataValidation()
              .requireCheckbox()
              .build();
            checkboxRange.setDataValidation(checkboxRule);
          }
        } catch (error) {
          Logger.log('Error updating data validation: ' + error.toString());
          // Continue even if validation fails
        }
        
        // Log history untuk setiap field yang berubah
        const fields = ['nama', 'divisiId', 'picId', 'tanggal', 'proposal', 'rak', 'rab', 'lpj', 'statusSelesai'];
        fields.forEach(field => {
          const oldVal = oldData[field];
          const newVal = data[field] !== undefined ? data[field] : oldVal;
          if (String(oldVal) !== String(newVal)) {
            logHistory('UPDATE', id, data.nama || oldData.nama, scId, nama, field, String(oldVal), String(newVal));
          }
        });
        
        // Update rapat jika ada (bersihkan yang lama dan tambahkan yang baru)
        if (data.rapat !== undefined && Array.isArray(data.rapat)) {
          const rapatSheet = ss.getSheetByName(SHEET_NAME_RAPAT_PROKER);
          if (rapatSheet) {
            const rapatData = rapatSheet.getDataRange().getValues();
            for (let j = rapatData.length - 1; j >= 1; j--) {
              if (rapatData[j][1] == id) { // PROKER_ID di kolom B
                rapatSheet.getRange(j + 1, 1, 1, 9).clearContent();
              }
            }
            
            // Tambahkan rapat baru jika list tidak kosong
            if (data.rapat.length > 0) {
              const picId = data.picId !== undefined ? data.picId : values[i][3];
              createRapatForProker(id, data.nama || oldData.nama, data.rapat, picId);
            }
          }
        }
        
        return {
          id: id,
          nama: data.nama || oldData.nama,
          tanggal: data.tanggal || oldData.tanggal
        };
      }
    }
    
    throw new Error('Proker dengan ID ' + id + ' tidak ditemukan');
  } catch (error) {
    Logger.log('Error updateProker: ' + error.toString());
    throw error;
  }
}

/**
 * Delete Proker dengan history tracking
 */
function deleteProker(id, username, scId, nama, isInternal = false) {
  const lock = LockService.getScriptLock();
  try {
    if (!isInternal) lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_PROKER);
    const rapatSheet = ss.getSheetByName(SHEET_NAME_RAPAT_PROKER);
    
    if (!sheet) {
      throw new Error('Sheet Proker tidak ditemukan');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Cari row dengan Proker_ID yang sesuai
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] == id) {
        const deletedData = {
          nama: values[i][1] || ''
        };
        
        // Log history sebelum delete
        logHistory('DELETE', id, deletedData.nama, scId, nama, 'Proker', '', '');
        
        // Hapus isi baris proker (benar-benar dihapus isinya agar bisa di-reuse)
        sheet.getRange(i + 1, 1, 1, 13).clearContent();
        
        // Hapus semua rapat terkait
        if (rapatSheet) {
          const rapatDataRange = rapatSheet.getDataRange();
          const rapatValues = rapatDataRange.getValues();
          
          for (let j = rapatValues.length - 1; j >= 1; j--) {
            if (String(rapatValues[j][1] || '').trim() === String(id).trim()) {
              // Hapus isi baris rapat
              rapatSheet.getRange(j + 1, 1, 1, 9).clearContent();
            }
          }
          Logger.log('Hard deleted rapat for proker: ' + id);
        }
        
        return 'Proker berhasil dihapus';
      }
    }
    
    throw new Error('Proker dengan ID ' + id + ' tidak ditemukan');
  } catch (error) {
    Logger.log('Error deleteProker: ' + error.toString());
    throw error;
  } finally {
    if (!isInternal) lock.releaseLock();
  }
}

// ==================== KONTEN KOMINFO FUNCTIONS (READ ONLY) ====================

/**
 * Get semua data Konten dari spreadsheet Content Planner
 * Hanya mengambil kolom Task dan Due Date
 */
function getKontenData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_KONTEN);
    const sheet = ss.getSheetByName(SHEET_NAME_CONTENT_PLANNER);
    
    if (!sheet) {
      throw new Error('Sheet Content Planner tidak ditemukan');
    }
    
    // Header ada di baris 16 (index 15), data mulai baris 17 (index 16)
    const HEADER_ROW = 16; // Baris 16
    const DATA_START_ROW = 17; // Baris 17
    
    // Baca header dari baris 16
    const headerRange = sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn());
    const headers = headerRange.getValues()[0];
    
    // Cari kolom Task, Due Date, dan Status
    let taskColIndex = -1;
    let dueDateColIndex = -1;
    let statusColIndex = -1;
    
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase().trim();
      // Cek berbagai variasi nama kolom
      if (header === 'task' || header.includes('task')) {
        taskColIndex = i;
        Logger.log('Task column found at index: ' + i);
      } else if (header === 'due date' || header === 'duedate' || header.includes('due date') || header.includes('duedate')) {
        dueDateColIndex = i;
        Logger.log('Due Date column found at index: ' + i);
      } else if (header === 'status') {
        statusColIndex = i;
        Logger.log('Status column found at index: ' + i);
      }
    }
    
    if (taskColIndex === -1 || dueDateColIndex === -1) {
      const errorMsg = 'Kolom Task atau Due Date tidak ditemukan di sheet Content Planner (baris 16). ';
      const foundHeaders = headers.map((h, idx) => `[${idx}]: "${h}"`).join(', ');
      throw new Error(errorMsg + 'Header yang ditemukan: ' + foundHeaders);
    }
    
    // Baca data mulai dari baris 17
    const lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) {
      return []; // Tidak ada data
    }
    
    const dataRange = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, sheet.getLastColumn());
    const rows = dataRange.getValues();
    
    return rows.map((row, index) => {
      return {
        id: (index + 1).toString(),
        nama: row[taskColIndex] || '', // Task
        tanggal: row[dueDateColIndex] ? formatDateForOutput(row[dueDateColIndex]) : '', // Due Date
        status: statusColIndex !== -1 ? (row[statusColIndex] || '') : '' // Status
      };
    }).filter(row => row.nama); // Filter baris kosong
  } catch (error) {
    Logger.log('Error getKontenData: ' + error.toString());
    throw error;
  }
}

// ==================== HISTORY TRACKING ====================

/**
 * Log history ke sheet History_Log
 * Format: Timestamp | SC_ID | Nama | Proker_ID | Field | Old_Value | New_Value | Action
 */
function logHistory(action, prokerId, prokerNama, scId, nama, field, oldValue, newValue) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    let historySheet = ss.getSheetByName(SHEET_NAME_HISTORY_LOG);
    
    // Buat sheet History_Log jika belum ada
    if (!historySheet) {
      historySheet = ss.insertSheet(SHEET_NAME_HISTORY_LOG);
      historySheet.appendRow(['Timestamp', 'SC_ID', 'Nama', 'Proker_ID', 'Field', 'Old_Value', 'New_Value', 'Action']);
      
      // Format header
      const headerRange = historySheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
    }
    
    const timestamp = new Date();
    const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    
    historySheet.appendRow([
      timestampStr,
      scId || '',
      nama || '',
      prokerId || '',
      field || '',
      oldValue || '',
      newValue || '',
      action || ''
    ]);
    
    Logger.log('History logged: ' + action + ' - ' + prokerId + ' by ' + nama);
  } catch (error) {
    Logger.log('Error logHistory: ' + error.toString());
    // Jangan throw error untuk history, karena ini opsional
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format date untuk output (dari spreadsheet ke web)
 * Format: DD/MM/YYYY
 */
function formatDateForOutput(dateValue) {
  if (!dateValue) return '';
  
  try {
    // Jika sudah berupa string dengan format DD/MM/YYYY, return as is
    if (typeof dateValue === 'string') {
      // Cek jika sudah format DD/MM/YYYY
      if (dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateValue;
      }
      // Coba parse jika format lain
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
      return dateValue;
    }
    
    // Jika Date object, format ke DD/MM/YYYY
    if (dateValue instanceof Date) {
      return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
    
    // Jika number (serial date dari spreadsheet)
    const date = new Date((dateValue - 25569) * 86400 * 1000);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch (error) {
    Logger.log('Error formatDateForOutput: ' + error.toString());
    return dateValue.toString();
  }
}

/**
 * Format date untuk input (dari web ke spreadsheet)
 * Menerima format YYYY-MM-DD dari input date HTML
 */
function formatDateForInput(dateString) {
  if (!dateString) return new Date();
  
  try {
    // Jika format YYYY-MM-DD dari input date HTML
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(dateString + 'T00:00:00');
    }
    // Jika format DD/MM/YYYY
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const parts = dateString.split('/');
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateString);
  } catch (error) {
    Logger.log('Error formatDateForInput: ' + error.toString());
    return new Date();
  }
}

// ==================== MASTER DATA FUNCTIONS ====================

/**
 * Get semua data Master Divisi
 * Format: Divisi_ID | Nama_Divisi | Email_Ketua | Is_Active
 */
function getMasterDivisi() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_MASTER_DIVISI);
    
    if (!sheet) {
      throw new Error('Sheet Master_Divisi tidak ditemukan');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      return [];
    }
    
    const rows = data.slice(1);
    
    return rows.map((row) => {
      const isActive = row[3]; // Is_Active
      let active = false;
      if (typeof isActive === 'boolean') {
        active = isActive;
      } else if (typeof isActive === 'string') {
        active = isActive.toLowerCase() === 'true' || isActive === 'TRUE';
      } else {
        active = Boolean(isActive);
      }
      
      return {
        divisiId: String(row[0] || '').trim(), // Divisi_ID
        namaDivisi: String(row[1] || '').trim(), // Nama_Divisi
        emailKetua: String(row[2] || '').trim(), // Email_Ketua
        isActive: active
      };
    }).filter(row => row.divisiId && row.isActive); // Filter hanya yang aktif
  } catch (error) {
    Logger.log('Error getMasterDivisi: ' + error.toString());
    throw error;
  }
}

/**
 * Get semua data Master PIC
 * Format: PIC_ID | Nama_PIC | Email | Divisi_ID | Is_Active
 */
function getMasterPIC() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_MASTER_PIC);
    
    if (!sheet) {
      throw new Error('Sheet Master_PIC tidak ditemukan');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      return [];
    }
    
    const rows = data.slice(1);
    
    return rows.map((row) => {
      const isActive = row[4]; // Is_Active
      let active = false;
      if (typeof isActive === 'boolean') {
        active = isActive;
      } else if (typeof isActive === 'string') {
        active = isActive.toLowerCase() === 'true' || isActive === 'TRUE';
      } else {
        active = Boolean(isActive);
      }
      
      return {
        picId: String(row[0] || '').trim(), // PIC_ID
        namaPic: String(row[1] || '').trim(), // Nama_PIC
        email: String(row[2] || '').trim(), // Email
        divisiId: String(row[3] || '').trim(), // Divisi_ID
        isActive: active
      };
    }).filter(row => row.picId && row.isActive); // Filter hanya yang aktif
  } catch (error) {
    Logger.log('Error getMasterPIC: ' + error.toString());
    throw error;
  }
}

/**
 * Get semua data Master Rapat
 * Format: JENIS_RAPAT | Is_Active (atau sesuai struktur sheet)
 */
function getMasterRapat() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName(SHEET_NAME_MASTER_RAPAT);
    
    if (!sheet) {
      throw new Error('Sheet Master_Rapat tidak ditemukan');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    if (data.length <= 1) {
      return [];
    }
    
    const rows = data.slice(1);
    
    // Cari kolom Is_Active - bisa di kolom terakhir atau kolom kedua
    // Format: JENIS_RAPAT | Is_Active (atau kolom lain)
    return rows.map((row) => {
      // Cek apakah ada Is_Active di kolom terakhir atau kolom kedua
      let isActive = null;
      if (row.length >= 2) {
        // Coba kolom kedua dulu (index 1)
        isActive = row[1];
      }
      if (isActive === null || isActive === '') {
        // Jika tidak ada, coba kolom terakhir
        isActive = row[row.length - 1];
      }
      
      let active = false;
      if (typeof isActive === 'boolean') {
        active = isActive;
      } else if (typeof isActive === 'string') {
        active = isActive.toLowerCase() === 'true' || isActive === 'TRUE' || isActive === '1';
      } else if (isActive !== null && isActive !== '') {
        active = Boolean(isActive);
      } else {
        // Jika Is_Active kosong/null, anggap aktif (default)
        active = true;
      }
      
      const jenisRapat = String(row[0] || '').trim();
      
      return {
        jenisRapat: jenisRapat,
        isActive: active
      };
    }).filter(row => row.jenisRapat && row.jenisRapat !== ''); // Filter hanya yang punya jenis rapat (tidak filter Is_Active untuk sementara)
  } catch (error) {
    Logger.log('Error getMasterRapat: ' + error.toString());
    throw error;
  }
}

/**
 * Update presence SC untuk indikator aktif
 */
function updatePresence(scId, nama) {
  if (!scId || !nama) return { success: false };
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    let sheet = ss.getSheetByName('Active_Sessions');
    
    // Buat sheet jika tidak ada
    if (!sheet) {
      sheet = ss.insertSheet('Active_Sessions');
      sheet.appendRow(['SC_ID', 'Nama', 'Last_Seen']);
    }
    
    const now = new Date();
    const data = sheet.getDataRange().getValues();
    let rowIdx = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == scId) {
        rowIdx = i + 1;
        break;
      }
    }
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 2, 1, 2).setValues([[nama, now]]);
    } else {
      sheet.appendRow([scId, nama, now]);
    }
    
    return { success: true };
  } catch (error) {
    Logger.log('Error updatePresence: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Get list SC yang sedang aktif (dalam 2 menit terakhir)
 */
function getActiveSCs() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
    const sheet = ss.getSheetByName('Active_Sessions');
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    const now = new Date().getTime();
    const activeThreshold = 2 * 60 * 1000; // 2 menit
    
    const activeNames = [];
    for (let i = 1; i < data.length; i++) {
        if (!data[i][0] || !data[i][2]) continue;
      const lastSeen = new Date(data[i][2]).getTime();
      if ((now - lastSeen) < activeThreshold) {
        activeNames.push(data[i][1]); // Push Nama
      }
    }
    
    return activeNames;
  } catch (error) {
    Logger.log('Error getActiveSCs: ' + error.toString());
    return [];
  }
}
