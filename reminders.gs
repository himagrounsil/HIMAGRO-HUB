/**
 * HIMAGRO Hub - Reminder System
 * File: reminders.gs
 * 
 * Sistem ini mengelola pengiriman email otomatis untuk Pengurus, Kadiv, dan PIC.
 */

// ==================== KONFIGURASI ====================
// GANTI ID SPREADSHEET ANDA DI SINI
const SPREADSHEET_ID_PROKER = '1q78bgXcbS1pHizgXnY43fJSezlZxwK3R73JAGP_05No';

const APP_URL = 'https://himagrounsil.github.io/HIMAGRO-HUB';
const LOGO_URL = 'https://raw.githubusercontent.com/himagrounsil/HIMAGRO-HUB/main/Logo/Himagro.png';

// Nama-nama sheet (Sesuaikan dengan yang sudah ada)
const S_PROKER = 'Proker';
const S_RAPAT = 'Rapat_Proker';
const S_SC = 'Master_SC';
const S_DIVISI = 'Master_Divisi';
const S_PIC = 'Master_PIC';
const S_CONFIG = 'Config_Reminder';
const S_LOG = 'Reminder_History_Log'; // Diganti agar tidak bentrok dengan web log

// ==================== SETUP & TESTING ====================

/**
 * Jalankan ini SEKALI untuk menyiapkan sheet Config dan Log
 */
function setupReminderSystem() {
  // Gunakan ID yang sudah ada di apps-script.gs atau buka yang aktif
  let ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
  } catch (e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    Logger.log('❌ ERROR: Tidak dapat menemukan Spreadsheet. Pastikan ID SPREADSHEET_ID_PROKER sudah benar.');
    return;
  }
  
  Logger.log('Menyiapkan sistem di Spreadsheet: ' + ss.getName());

  // 1. Setup Config_Reminder
  let configSheet = ss.getSheetByName(S_CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(S_CONFIG);
    configSheet.appendRow(['Key', 'Value', 'Keterangan']);
    const configs = [
      ['EMAIL_TEST_RECEIVER', Session.getActiveUser().getEmail(), 'Email untuk pengujian'],
      ['REMINDER_DAY_MONTHLY', '1', 'Tanggal pengiriman reminder bulanan (1-28)'],
      ['REMINDER_HOUR', '8', 'Jam pengiriman (0-23)'],
      ['PIC_REMINDER_INTERVAL_DAYS', '14', 'Interval reminder PIC (hari)'],
      ['ENABLE_AUTO_REMINDER', 'FALSE', 'Set ke TRUE untuk mengaktifkan sistem otomatis']
    ];
    configSheet.getRange(2, 1, configs.length, 3).setValues(configs);
    configSheet.setColumnWidth(1, 200);
    configSheet.setColumnWidth(2, 250);
    configSheet.setColumnWidth(3, 300);
  }

  // 2. Setup History_Log
  let logSheet = ss.getSheetByName(S_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(S_LOG);
    logSheet.appendRow(['Timestamp', 'Type', 'Recipient', 'Proker_ID/Rapat_ID', 'Status']);
  }
  
  Logger.log('Sistem Reminder Berhasil Disiapkan!');
}

/**
 * Fungsi untuk Testing: Mengirim semua jenis email ke email pengembang
 */
function testAllReminders() {
  const testEmail = getConfigValue('EMAIL_TEST_RECEIVER');
  if (!testEmail) {
    Logger.log('Mohon isi EMAIL_TEST_RECEIVER di sheet Config_Reminder');
    return;
  }

  try {
    sendEmailKetumWaketum(testEmail, true);
    sendEmailSekretaris(testEmail, true);
    sendEmailBendahara(testEmail, true);
    sendEmailKadiv(testEmail, 'D01', true); // Test untuk Divisi 1
    sendEmailPIC(testEmail, 'Test Proker', 'Proposal, RAK', true);
    Logger.log('Test Berhasil! Silakan cek kotak masuk email Anda.');
  } catch (e) {
    Logger.log('Error Testing: ' + e.toString());
  }
}

/**
 * PAKSA KIRIM KE EMAIL ASLI:
 * Jalankan ini jika ingin mengirim email ke seluruh jajaran pengurus SEKARANG JUGA.
 */
function manualBroadcastRealEmails() {
  try {
    runMonthlyReminders();
    runPICReminders();
    runRapatReminders();
    Logger.log('Broadcast Berhasil! Email telah dikirimkan ke alamat masing-masing pengurus.');
  } catch (e) {
    Logger.log('Error Broadcast: ' + e.toString());
  }
}

/**
 * OTOMATISASI AKHIR:
 * Jalankan ini sekali untuk memasang pemicu otomatis setiap jam.
 */
function createTrigger() {
  // Hapus trigger lama jika ada agar tidak double
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach(t => {
    if (t.getHandlerFunction() === 'processAutoReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Buat trigger baru setiap jam
  ScriptApp.newTrigger('processAutoReminders')
           .timeBased()
           .everyHours(1)
           .create();
  
  Logger.log('Otomatisasi AKTIF! Sistem akan mengecek jadwal setiap 1 jam mulai sekarang.');
}

// ==================== CORE LOGIC ====================

/**
 * Fungsi Utama yang digerakkan oleh Trigger (Every Hour)
 */
function processAutoReminders() {
  const isEnabled = getConfigValue('ENABLE_AUTO_REMINDER') === 'TRUE';
  if (!isEnabled) return;

  const now = new Date();
  const currentDay = now.getDate();
  const currentHour = now.getHours();
  
  const targetDay = parseInt(getConfigValue('REMINDER_DAY_MONTHLY') || '1');
  const targetHour = parseInt(getConfigValue('REMINDER_HOUR') || '8');

  // 1. Reminder Bulanan (Ketum, Sekre, Bendahara, Kadiv)
  if (currentDay === targetDay && currentHour === targetHour) {
    runMonthlyReminders();
  }

  // 2. Reminder PIC & Rapat (Setiap hari di jam target)
  if (currentHour === targetHour) {
    runPICReminders();
    runRapatReminders();
  }
}

/**
 * Eksekusi reminder bulanan ke jajaran SC dan Kadiv
 */
function runMonthlyReminders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
  const scData = getSheetData(S_SC);
  
  // Kirim ke Ketum & Waketum
  const ketumWaketum = scData.filter(r => r.Jabatan === 'Ketua Umum' || r.Jabatan === 'Wakil Ketua Umum');
  ketumWaketum.forEach(user => sendEmailKetumWaketum(user.Email));

  // Kirim ke Sekretaris
  const sekretaris = scData.filter(r => r.Jabatan === 'Sekertaris 1' || r.Jabatan === 'Sekertaris 2');
  sekretaris.forEach(user => sendEmailSekretaris(user.Email));

  // Kirim ke Bendahara
  const bendahara = scData.filter(r => r.Jabatan === 'Bendahara 1' || r.Jabatan === 'Bendahara 2');
  bendahara.forEach(user => sendEmailBendahara(user.Email));

  // Kirim ke Kadiv
  const divData = getSheetData(S_DIVISI);
  divData.forEach(div => {
    if (div.Email_Ketua && div.Is_Active) {
      sendEmailKadiv(div.Email_Ketua, div.Divisi_ID);
    }
  });
}

/**
 * Reminder PIC Proker (Setiap 2 minggu) dan LPJ
 */
function runPICReminders() {
  const prokers = getSheetData(S_PROKER);
  const picMap = getPICMap();
  const now = new Date();
  const intervalDays = parseInt(getConfigValue('PIC_REMINDER_INTERVAL_DAYS') || '14');

  prokers.forEach(p => {
    if (!p.Is_Active) return;
    
    const tglKegiatan = parseDate(p.Tanggal_Pelaksanaan);
    if (!tglKegiatan) return;

    const picEmail = picMap[p.PIC_ID];
    if (!picEmail) return;

    const diffDays = (tglKegiatan - now) / (1000 * 60 * 60 * 24);
    
    // Logic Reminder Pre-Event (Proposal, RAK, RAB)
    if (diffDays > 14) { // H-14 ke atas
      const belumBeres = [];
      if (!p.Proposal) belumBeres.push('Proposal');
      if (!p.RAK) belumBeres.push('RAK');
      if (!p.RAB) belumBeres.push('RAB');

      if (belumBeres.length > 0) {
        if (shouldSendReminder('PIC_PRE', picEmail, p.Proker_ID, intervalDays)) {
          sendEmailPIC(picEmail, p.Nama_Proker, belumBeres.join(', '), false, 'Pre-Event');
          logAction('PIC_PRE', picEmail, p.Proker_ID, 'Success');
        }
      }
    }
    
    // Logic Reminder Post-Event (LPJ)
    if (diffDays < 0 && !p.LPJ) {
      if (shouldSendReminder('PIC_POST', picEmail, p.Proker_ID, intervalDays)) {
        sendEmailPIC(picEmail, p.Nama_Proker, 'LPJ', false, 'Post-Event');
        logAction('PIC_POST', picEmail, p.Proker_ID, 'Success');
      }
    }
  });
}

/**
 * Reminder Rapat (H-3)
 */
function runRapatReminders() {
  const rapatri = getSheetData(S_RAPAT);
  const now = new Date();

  rapatri.forEach(r => {
    if (r.AKTIF === false || r.AKTIF === 'FALSE') return;
    
    const tglRapat = parseDate(r.TANGGAL_RAPAT);
    if (!tglRapat) return;

    const diffDays = Math.ceil((tglRapat - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 3) {
      if (!hasAlreadyLog('RAPAT_H3', r.PIC_EMAIL, r.RAPAT_ID)) {
        sendEmailRapat(r);
        logAction('RAPAT_H3', r.PIC_EMAIL, r.RAPAT_ID, 'Success');
      }
    }
  });
}

// ==================== EMAIL SENDERS (HTML TEMPLATES) ====================

function sendEmailKetumWaketum(email, isTest = false) {
  const data = getProkerStatus(2); // Get data 2 bulan kedepan
  const html = templateWrapper('Monitoring Kabinet (2 Bulan Kedepan)', `
    <p>Halo Ketua/Wakil Ketua Umum,</p>
    <p>Berikut adalah ringkasan status administrasi program kerja untuk 2 bulan ke depan:</p>
    <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background:#f2f2f2;">
        <th style="padding:10px; border:1px solid #ddd;">Proker</th>
        <th style="padding:10px; border:1px solid #ddd;">Status</th>
      </tr>
      ${data.map(p => `
        <tr>
          <td style="padding:10px; border:1px solid #ddd;"><b>${p.nama}</b><br><small>${p.tanggal}</small></td>
          <td style="padding:10px; border:1px solid #ddd;">${p.statusStr}</td>
        </tr>
      `).join('')}
    </table>
  `);
  
  MailApp.sendEmail({
    to: email,
    subject: `[HIMAGRO HUB] Monitoring Proker - ${getMonthName()}`,
    htmlBody: html
  });
}

function sendEmailSekretaris(email, isTest = false) {
  const data = getProkerStatus(2);
  const html = templateWrapper('Follow-up Administrasi Sekretaris', `
    <p>Halo Sekretaris,</p>
    <p>Mohon bantuannya untuk mem-follow up administrasi (Proposal & RAK) proker berikut:</p>
    <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background:#f2f2f2;">
        <th style="padding:10px; border:1px solid #ddd;">Proker</th>
        <th style="padding:10px; border:1px solid #ddd;">Belum Selesai</th>
      </tr>
      ${data.filter(p => p.pendingSekre).map(p => `
        <tr>
          <td style="padding:10px; border:1px solid #ddd;"><b>${p.nama}</b></td>
          <td style="padding:10px; border:1px solid #ddd; color:#d9534f;">${p.pendingSekre}</td>
        </tr>
      `).join('')}
    </table>
    <p><i>Catatan: Segera hubungi PIC terkait untuk update status di Web HIMAGRO HUB.</i></p>
  `);
  
  MailApp.sendEmail({ to: email, subject: '[HIMAGRO HUB] Follow-up Administrasi Sekretaris', htmlBody: html });
}

function sendEmailBendahara(email, isTest = false) {
  const data = getProkerStatus(2);
  const html = templateWrapper('Follow-up Keuangan & RAB', `
    <p>Halo Bendahara,</p>
    <p>Berikut daftar proker yang RAB-nya belum selesai/diserahkan:</p>
    <ul>
      ${data.filter(p => !p.rab).map(p => `<li><b>${p.nama}</b> (${p.tanggal})</li>`).join('')}
    </ul>
    <p>Mohon segera follow-up dan lakukan penagihan uang kas jika diperlukan.</p>
  `);
  
  MailApp.sendEmail({ to: email, subject: '[HIMAGRO HUB] Reminder Keuangan RAB', htmlBody: html });
}

function sendEmailKadiv(email, divisiId, isTest = false) {
  const data = getProkerStatus(2).filter(p => p.divisiId === divisiId);
  const html = templateWrapper('Laporan Divisi Anda', `
    <p>Halo Kepala Divisi,</p>
    <p>Berikut adalah progres administrasi divisi Anda untuk 2 bulan ke depan:</p>
    ${data.map(p => `
      <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:10px; border-left:4px solid var(--accent);">
        <strong>${p.nama}</strong> (${p.tanggal})<br>
        Status: ${p.statusStr}
      </div>
    `).join('')}
  `);
  
  MailApp.sendEmail({ to: email, subject: '[HIMAGRO HUB] Monitoring Divisi', htmlBody: html });
}

function sendEmailPIC(email, namaProker, item, isTest = false, type = '') {
  const html = templateWrapper('Reminder Administrasi PIC', `
    <p>Halo PIC <strong>${namaProker}</strong>,</p>
    <p>Mengingatkan untuk segera menyelesaikan administrasi berikut:</p>
    <h2 style="color:#d9534f; text-align:center;">❌ ${item}</h2>
    <p>Abaikan email ini jika Anda sudah mengunggah/update status di Web HIMAGRO HUB.</p>
  `);
  
  MailApp.sendEmail({ to: email, subject: `[HIMAGRO HUB] Reminder PIC - ${namaProker}`, htmlBody: html });
}

function sendEmailRapat(r) {
  const html = templateWrapper('Undangan Rapat Proker', `
    <p>Halo,</p>
    <p>Mengingatkan akan ada agenda rapat dalam 3 hari ke depan:</p>
    <div style="text-align:center; background:#eef; padding:20px; border-radius:10px;">
      <h3 style="margin:0;">${r.JENIS_RAPAT}</h3>
      <p style="margin:5px 0;">Proker: <strong>${r.NAMA_PROKER}</strong></p>
      <p style="font-size:1.2rem; color:#333;">📅 ${r.TANGGAL_RAPAT}</p>
    </div>
  `);
  
  MailApp.sendEmail({ to: r.PIC_EMAIL, subject: `[JADWAL RAPAT] 3 Hari Lagi: ${r.JENIS_RAPAT}`, htmlBody: html });
}

// ==================== HELPERS ====================

function templateWrapper(title, content) {
  return `
    <div style="font-family: 'Segoe UI', Arial; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 15px; overflow: hidden; background: #fff;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: #fff;">
        <img src="${LOGO_URL}" width="70" style="margin-bottom:10px;">
        <h1 style="margin:0; font-size: 20px; letter-spacing: 1px;">HIMAGRO HUB REMINDER</h1>
      </div>
      <div style="padding: 30px; color: #444; line-height: 1.6;">
        <h2 style="color: #10b981; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
        ${content}
        <div style="text-align: center; margin-top: 40px;">
          <a href="${APP_URL}" style="background: #10b981; color: #fff; padding: 15px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 15px rgba(16,185,129,0.3);">
            BUKA HIMAGRO HUB
          </a>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
        &copy; ${new Date().getFullYear()} HIMAGRO UNSIL. Automatic System.
      </div>
    </div>
  `;
}

function getProkerStatus(monthsAhead) {
  const data = getSheetData(S_PROKER);
  const now = new Date();
  const limitDate = new Date();
  limitDate.setMonth(now.getMonth() + monthsAhead);

  return data.filter(p => {
    const tgl = parseDate(p.Tanggal_Pelaksanaan);
    return p.Is_Active && tgl && tgl >= new Date(now.getFullYear(), now.getMonth(), 1) && tgl <= limitDate;
  }).map(p => {
    const tgl = parseDate(p.Tanggal_Pelaksanaan);
    const isPast = tgl < now;
    
    let statusStr = "";
    let pendingSekre = [];
    
    // Status Logic
    const proposal = p.Proposal ? "✅" : "❌";
    const rak = p.RAK ? "✅" : "❌";
    const rab = p.RAB ? "✅" : "❌";
    const lpj = p.LPJ ? "✅" : "❌";
    
    statusStr = `Prop: ${proposal} | RAK: ${rak} | RAB: ${rab}`;
    if (!p.Proposal) pendingSekre.push('Proposal');
    if (!p.RAK) pendingSekre.push('RAK');

    if (isPast) {
      statusStr += ` | LPJ: ${lpj}`;
      if (!p.LPJ) pendingSekre.push('LPJ');
    }

    const isComplete = isPast ? (p.Proposal && p.RAK && p.RAB && p.LPJ) : (p.Proposal && p.RAK && p.RAB);

    return {
      nama: p.Nama_Proker,
      tanggal: p.Tanggal_Pelaksanaan,
      divisiId: p.Divisi_ID,
      statusStr: isComplete ? "✅ Selesai" : statusStr,
      pendingSekre: pendingSekre.join(', '),
      rab: p.RAB
    };
  });
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h.replace(/\s/g, '_')] = row[i]);
    return obj;
  });
}

function getPICMap() {
  const data = getSheetData(S_PIC);
  let map = {};
  data.forEach(r => map[r.PIC_ID] = r.Email);
  return map;
}

function getConfigValue(key) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
  const sheet = ss.getSheetByName(S_CONFIG);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) return values[i][1];
  }
  return null;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  const iso = new Date(dateStr);
  return isNaN(iso.getTime()) ? null : iso;
}

function shouldSendReminder(type, recipient, id, intervalDays) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
  const sheet = ss.getSheetByName(S_LOG);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === type && data[i][2] === recipient && data[i][3] == id) {
      const lastSent = new Date(data[i][0]);
      const diff = (now - lastSent) / (1000 * 60 * 60 * 24);
      return diff >= intervalDays;
    }
  }
  return true;
}

function hasAlreadyLog(type, recipient, id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
  const sheet = ss.getSheetByName(S_LOG);
  const data = sheet.getDataRange().getValues();
  return data.some(r => r[1] === type && r[2] === recipient && r[3] == id);
}

function logAction(type, recipient, id, status) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_PROKER);
  const sheet = ss.getSheetByName(S_LOG);
  sheet.appendRow([new Date(), type, recipient, id, status]);
}

function getMonthName() {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return months[new Date().getMonth()];
}
