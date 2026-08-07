/**
 * HIMAGRO Hub - Sistem Reminder Email
 * File: reminders.gs
 *
 * JADWAL:
 * - Tgl 1 tiap bulan : Ketum, Waketum, Sekretaris, Bendahara, Kadiv
 * - Tgl 1 & 15       : PIC LPJ (post-event, LPJ belum selesai)
 * - H-21, H-14, H-7  : PIC Administrasi (Proposal/RAK/RAB)
 * - H-3              : PIC Rapat
 *
 * LOGIC STATUS: Kolom Status_Selesai DIABAIKAN. Hanya dari Proposal, RAK, RAB, LPJ.
 */

// ==================== KONFIGURASI ====================
const REM_SS_ID   = '1q78bgXcbS1pHizgXnY43fJSezlZxwK3R73JAGP_05No';
const REM_APP_URL = 'https://himagrounsil.github.io/HIMAGRO-HUB';
const REM_LOGO    = 'https://raw.githubusercontent.com/himagrounsil/HIMAGRO-HUB/main/Logo/Himagro.png';

const RS_PROKER  = 'Proker';
const RS_RAPAT   = 'Rapat_Proker';
const RS_SC      = 'Master_SC';
const RS_DIVISI  = 'Master_Divisi';
const RS_PIC     = 'Master_PIC';
const RS_CONFIG  = 'Config_Reminder';
const RS_LOG     = 'Reminder_Log';

// ==================== SETUP ====================

function setupReminderSystem() {
  const ss = SpreadsheetApp.openById(REM_SS_ID);

  let cfg = ss.getSheetByName(RS_CONFIG);
  if (!cfg) {
    cfg = ss.insertSheet(RS_CONFIG);
    cfg.appendRow(['Key', 'Value', 'Keterangan']);
    cfg.getRange(2, 1, 9, 3).setValues([
      ['EMAIL_TEST',          Session.getActiveUser().getEmail(), 'Email untuk testing'],
      ['ENABLE_AUTO',         'FALSE',  'Set TRUE untuk aktifkan otomatis'],
      ['REMINDER_HOUR',       '8',      'Jam pengiriman (0-23)'],
      ['JABATAN_KETUM',       'Ketua Umum',        'Jabatan Ketua Umum'],
      ['JABATAN_WAKETUM',     'Wakil Ketua Umum',  'Jabatan Wakil Ketua Umum'],
      ['JABATAN_SEKRE1',      'Sekertaris 1',      'Jabatan Sekretaris 1'],
      ['JABATAN_SEKRE2',      'Sekertaris 2',      'Jabatan Sekretaris 2'],
      ['JABATAN_BEND1',       'Bendahara 1',       'Jabatan Bendahara 1'],
      ['JABATAN_BEND2',       'Bendahara 2',       'Jabatan Bendahara 2'],
    ]);
    cfg.setColumnWidth(1, 200);
    cfg.setColumnWidth(2, 250);
    cfg.setColumnWidth(3, 300);
  }

  let log = ss.getSheetByName(RS_LOG);
  if (!log) {
    log = ss.insertSheet(RS_LOG);
    log.appendRow(['Timestamp', 'Type', 'Email', 'Ref_ID', 'Log_Key', 'Status']);
  }

  Logger.log('Setup selesai! Isi EMAIL_TEST di sheet ' + RS_CONFIG + ' lalu jalankan testAllEmails()');
}

// ==================== TRIGGER ====================

function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'autoReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoReminders').timeBased().everyHours(1).create();
  Logger.log('Trigger aktif – cek setiap 1 jam');
}

// ==================== MANUAL BROADCAST ====================

/**
 * Kirim SEMUA reminder bulan ini secara manual (untuk SC, Kadiv, PIC Admin & LPJ).
 * Jalankan fungsi ini kapan saja jika ingin kirim reminder bulan berjalan.
 */
function kirimReminderBulanIni() {
  Logger.log('=== MANUAL BROADCAST – ' + remBulan() + ' ===');
  if (!checkQuota(10)) {
    Logger.log('ERROR: Quota tidak cukup. Sisa: ' + MailApp.getRemainingDailyQuota());
    return;
  }
  runMonthlyReminders(); // Ketum, Waketum, Sekre, Bendahara, Kadiv
  runLPJReminders();     // PIC LPJ
  Logger.log('=== SELESAI – cek inbox masing-masing penerima ===');
}

/**
 * Hanya kirim ke jajaran SC & Kadiv (Ketum, Waketum, Sekre, Bendahara, Kadiv).
 * Berguna jika hanya perlu update laporan tanpa mengganggu PIC.
 */
function kirimReminderSCdanKadiv() {
  Logger.log('=== MANUAL BROADCAST SC & Kadiv – ' + remBulan() + ' ===');
  if (!checkQuota(5)) {
    Logger.log('ERROR: Quota tidak cukup. Sisa: ' + MailApp.getRemainingDailyQuota());
    return;
  }
  runMonthlyReminders();
  Logger.log('=== SELESAI ===');
}

/**
 * Hanya kirim ke semua PIC yang administrasinya belum lengkap.
 */
function kirimReminderPICSaja() {
  Logger.log('=== MANUAL BROADCAST PIC – ' + remBulan() + ' ===');
  if (!checkQuota(5)) {
    Logger.log('ERROR: Quota tidak cukup. Sisa: ' + MailApp.getRemainingDailyQuota());
    return;
  }
  runPICWeeklyReminders(true); // force=true: kirim meski bukan hari Senin
  runBendaharaWeeklyReminders(true);
  runLPJReminders();
  Logger.log('=== SELESAI ===');
}

/**
 * DIAGNOSTIC: Jalankan fungsi ini kapan saja untuk cek status sistem.
 * Tidak mengirim email apapun – hanya menampilkan info di Execution Log.
 */
function debugAutoReminders() {
  const now = new Date();
  Logger.log('========== DEBUG REMINDER SYSTEM ==========');
  Logger.log('Waktu sekarang     : ' + now.toString());
  Logger.log('Timezone script    : ' + Session.getScriptTimeZone());
  Logger.log('Jam sekarang       : ' + now.getHours());
  Logger.log('Hari (getDay)      : ' + now.getDay() + ' (0=Min,1=Sen,2=Sel,...)');
  Logger.log('Tanggal            : ' + now.getDate());
  Logger.log('');

  const enableAuto = getConfig('ENABLE_AUTO');
  Logger.log('ENABLE_AUTO (raw)  : "' + enableAuto + '"');
  Logger.log('ENABLE_AUTO === TRUE ? ' + (enableAuto === 'TRUE'));

  const reminderHour = getConfig('REMINDER_HOUR');
  Logger.log('REMINDER_HOUR (raw): "' + reminderHour + '"');
  Logger.log('Parsed targetHour  : ' + parseInt(reminderHour || '8'));
  Logger.log('Jam cocok?         : ' + (now.getHours() === parseInt(reminderHour || '8')));
  Logger.log('');

  Logger.log('Email quota sisa   : ' + MailApp.getRemainingDailyQuota());
  Logger.log('Week key           : ' + remWeekKey());
  Logger.log('');

  const prokers = getActiveProker();
  Logger.log('Jumlah proker aktif: ' + prokers.length);
  prokers.forEach(p => {
    Logger.log('  - ' + p.Proker_ID + ': ' + p.Nama_Proker + ' | Is_Active=' + p.Is_Active);
  });
  Logger.log('');

  const scData = remSheetData(RS_SC);
  Logger.log('Jumlah SC aktif    : ' + scData.filter(u => remIsActive(u.Is_Active)).length);
  scData.forEach(u => {
    Logger.log('  - ' + (u.Nama || '-') + ' | Jabatan="' + u.Jabatan + '" | Email=' + u.Email + ' | Is_Active=' + u.Is_Active);
  });
  Logger.log('');

  // Cek trigger
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('Jumlah trigger     : ' + triggers.length);
  triggers.forEach(t => {
    Logger.log('  - ' + t.getHandlerFunction() + ' | ' + t.getEventType() + ' | ' + t.getTriggerSource());
  });

  Logger.log('========== END DEBUG ==========');
}

function autoReminders() {
  const enableAuto = String(getConfig('ENABLE_AUTO') || '').trim().toUpperCase();
  if (enableAuto !== 'TRUE') {
    Logger.log('⏹ autoReminders STOP: ENABLE_AUTO = "' + enableAuto + '" (bukan TRUE)');
    return;
  }

  const now  = new Date();
  const hour = now.getHours();
  const day  = now.getDate();
  const targetHour = parseInt(getConfig('REMINDER_HOUR') || '8');

  Logger.log('▶ autoReminders START: jam=' + hour + ', targetHour=' + targetHour + ', hari=' + now.getDay() + ', tanggal=' + day);

  if (hour !== targetHour) {
    Logger.log('⏹ autoReminders STOP: jam ' + hour + ' ≠ targetHour ' + targetHour);
    return;
  }

  Logger.log('✓ Jam cocok! Menjalankan reminder...');

  if (day === 1) {
    Logger.log('→ Tanggal 1: menjalankan Monthly + LPJ');
    runMonthlyReminders();
    runLPJReminders();
  }
  if (day === 15) {
    Logger.log('→ Tanggal 15: menjalankan LPJ');
    runLPJReminders();
  }

  runPICWeeklyReminders();       // Mingguan setiap Senin: PIC admin belum selesai
  runBendaharaWeeklyReminders(); // Mingguan setiap Senin: tagihan uang kas
  runRapatReminders();           // Harian: H-7 & H-3

  Logger.log('✓ autoReminders SELESAI');
}

// ==================== CORE RUNNERS ====================

function runMonthlyReminders() {
  Logger.log('▶ Monthly reminders...');
  const scData = remSheetData(RS_SC);
  const jabKetum   = getConfig('JABATAN_KETUM')   || 'Ketua Umum';
  const jabWaketum = getConfig('JABATAN_WAKETUM') || 'Wakil Ketua Umum';
  const jabSekre1  = getConfig('JABATAN_SEKRE1')  || 'Sekertaris 1';
  const jabSekre2  = getConfig('JABATAN_SEKRE2')  || 'Sekertaris 2';
  const jabBend1   = getConfig('JABATAN_BEND1')   || 'Bendahara 1';
  const jabBend2   = getConfig('JABATAN_BEND2')   || 'Bendahara 2';

  scData.forEach(u => {
    if (!u.Email || !remIsActive(u.Is_Active)) return;
    if (!checkQuota()) return;
    const jab = String(u.Jabatan || '').trim();
    try {
      if (jab === jabKetum || jab === jabWaketum) {
        sendEmailKetum(u.Email, u.Nama || u.Email);
      } else if (jab === jabSekre1 || jab === jabSekre2) {
        sendEmailSekretaris(u.Email, u.Nama || u.Email);
      } else if (jab === jabBend1 || jab === jabBend2) {
        sendEmailBendahara(u.Email, u.Nama || u.Email);
      }
    } catch(e) { Logger.log('Error SC ' + u.Email + ': ' + e); }
    Utilities.sleep(600);
  });

  remSheetData(RS_DIVISI).forEach(d => {
    if (!d.Email_Ketua || !remIsActive(d.Is_Active)) return;
    if (!checkQuota()) return;
    try {
      sendEmailKadiv(d.Email_Ketua, String(d.Nama_Divisi || ''), String(d.Divisi_ID || ''));
    } catch(e) { Logger.log('Error Kadiv ' + d.Email_Ketua + ': ' + e); }
    Utilities.sleep(600);
  });
}

/**
 * Reminder mingguan PIC administrasi – dikirim setiap SENIN.
 * Mencakup semua proker aktif yang belum terlaksana + admin belum lengkap.
 */
/**
 * @param {boolean} force - Jika true, lewati cek hari Senin (untuk manual broadcast)
 */
function runPICWeeklyReminders(force) {
  const dayOfWeek = new Date().getDay(); // 0=Minggu, 1=Senin, ..., 6=Sabtu
  if (!force && dayOfWeek !== 1) return; // Hanya hari Senin (kecuali dipaksa manual)

  Logger.log('▶ PIC Weekly reminders (Senin)...');
  const picMap = buildPICMap();
  const now    = remToday();

  getActiveProker().forEach(p => {
    const tgl = remParseDate(p.Tanggal_Pelaksanaan);
    if (!tgl || tgl < now) return; // lewati proker sudah lewat

    const belum = buildBelumPreEvent(p);
    if (belum.length === 0) return;

    const picEmail = picMap[String(p.PIC_ID || '').trim()];
    if (!picEmail) return;

    // Dedup per minggu: format YYYY-WNN (misal 2026-W17)
    const logKey = 'PIC_WEEKLY_' + p.Proker_ID + '_' + remWeekKey();
    if (alreadySentInPeriod(logKey) || !checkQuota()) return;

    try {
      const diff = Math.round((tgl - now) / 86400000); // sisa hari
      sendEmailPICAdmin(picEmail, p.Nama_Proker, belum, diff);
      logSent('PIC_WEEKLY', picEmail, p.Proker_ID, logKey);
    } catch(e) { Logger.log('Error PIC_WEEKLY: ' + e); }
    Utilities.sleep(600);
  });
}

/**
 * Reminder mingguan tagihan uang kas untuk Bendahara 1 & 2.
 * Dikirim setiap SENIN. Menyertakan daftar proker RAB pending sebagai konteks.
 */
/**
 * @param {boolean} force - Jika true, lewati cek hari Senin (untuk manual broadcast)
 */
function runBendaharaWeeklyReminders(force) {
  const dayOfWeek = new Date().getDay();
  if (!force && dayOfWeek !== 1) return; // Hanya hari Senin (kecuali dipaksa manual)

  Logger.log('▶ Bendahara weekly kas reminders (Senin)...');
  const scData   = remSheetData(RS_SC);
  const jabBend1 = getConfig('JABATAN_BEND1') || 'Bendahara 1';
  const jabBend2 = getConfig('JABATAN_BEND2') || 'Bendahara 2';

  scData.forEach(u => {
    if (!u.Email || !remIsActive(u.Is_Active)) return;
    const jab = String(u.Jabatan || '').trim();
    if (jab !== jabBend1 && jab !== jabBend2) return;
    if (!checkQuota()) return;

    const logKey = 'BENDAHARA_KAS_' + remWeekKey();
    if (alreadySentInPeriod(logKey)) return;

    try {
      sendEmailBendaharaKas(u.Email, u.Nama || u.Email);
      logSent('BENDAHARA_KAS', u.Email, '-', logKey);
    } catch(e) { Logger.log('Error BENDAHARA_KAS: ' + e); }
    Utilities.sleep(600);
  });
}

function runLPJReminders() {
  Logger.log('▶ LPJ reminders...');
  const picMap = buildPICMap();
  const now    = remToday();
  const dayTag = new Date().getDate();

  getActiveProker().forEach(p => {
    const tgl = remParseDate(p.Tanggal_Pelaksanaan);
    if (!tgl || tgl >= now) return;
    if (remBool(p.LPJ)) return;

    const picEmail = picMap[String(p.PIC_ID || '').trim()];
    if (!picEmail) return;

    const logKey = 'PIC_LPJ_' + p.Proker_ID + '_d' + dayTag;
    if (alreadySentToday(logKey, picEmail) || !checkQuota()) return;

    try {
      sendEmailPICLPJ(picEmail, p.Nama_Proker, p.Tanggal_Pelaksanaan);
      logSent('PIC_LPJ', picEmail, p.Proker_ID, logKey);
    } catch(e) { Logger.log('Error PIC_LPJ: ' + e); }
    Utilities.sleep(600);
  });
}

function runRapatReminders() {
  Logger.log('▶ Rapat H-7 & H-3 reminders...');
  const now = remToday();
  const TRIGGER_DAYS = [7, 3]; // H-7 dan H-3

  remSheetData(RS_RAPAT).forEach(r => {
    if (!remIsActive(r.AKTIF)) return;
    if (remBool(r.STATUS_RAPAT)) return;

    const tgl  = remParseDate(r.TANGGAL_RAPAT);
    if (!tgl) return;
    const diff = Math.round((tgl - now) / 86400000);
    if (!TRIGGER_DAYS.includes(diff)) return;

    const email = String(r.PIC_EMAIL || '').trim();
    if (!email) return;

    const logKey = 'RAPAT_H' + diff + '_' + r.RAPAT_ID;
    if (alreadySentToday(logKey, email) || !checkQuota()) return;

    try {
      sendEmailRapat(r, diff);
      logSent('RAPAT_H' + diff, email, r.RAPAT_ID, logKey);
    } catch(e) { Logger.log('Error RAPAT: ' + e); }
    Utilities.sleep(600);
  });
}

// ==================== EMAIL SENDERS ====================

function sendEmailKetum(toEmail, namaUser) {
  const prokers = getProker2Months();
  const rows = prokers.map(p =>
    `<tr>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111827;">${esc(p.Nama_Proker)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${remFmtDate(p.Tanggal_Pelaksanaan)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;">${statusBadges(p)}</td>
    </tr>`).join('');

  const tbl = prokers.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:linear-gradient(135deg,#065f46,#10b981);">
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Nama Proker</th>
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Tanggal</th>
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Status Administrasi</th>
        </tr></thead><tbody>${rows}</tbody></table>`
    : `<p style="text-align:center;color:#9ca3af;padding:20px;">Tidak ada proker dalam 2 bulan ke depan.</p>`;

  const body = `<p>Halo <strong>${esc(namaUser)}</strong>,</p>
    <p style="color:#555;">Berikut ringkasan status administrasi program kerja <strong>2 bulan ke depan</strong>:</p>
    ${tbl}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:4px;">
      <p style="margin:0;color:#065f46;font-size:14px;">💡 Untuk informasi lebih lengkap termasuk seluruh proker dan rapat, silakan kunjungi <strong>HIMAGRO HUB</strong>.</p>
    </div>`;

  sendMail(toEmail, `[HIMAGRO HUB] Monitoring Proker – ${remBulan()}`,
    wrapEmail(`Monitoring Proker – ${remBulan()}`, body, 'Buka HIMAGRO HUB'));
  Logger.log('✓ Ketum → ' + toEmail);
}

function sendEmailSekretaris(toEmail, namaUser) {
  const now = remToday();
  const all = getActiveProker();

  const preRows = all.filter(p => {
    const tgl = remParseDate(p.Tanggal_Pelaksanaan);
    return (!remBool(p.Proposal) || !remBool(p.RAK)) && (!tgl || tgl >= now);
  }).map(p => {
    const belum = [];
    if (!remBool(p.Proposal)) belum.push('Proposal');
    if (!remBool(p.RAK)) belum.push('RAK');
    return `<tr><td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#111827;">${esc(p.Nama_Proker)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;">${belum.join(', ')}</td></tr>`;
  }).join('');

  const postRows = all.filter(p => {
    const tgl = remParseDate(p.Tanggal_Pelaksanaan);
    return tgl && tgl < now && !remBool(p.LPJ);
  }).map(p =>
    `<tr><td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#111827;">${esc(p.Nama_Proker)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;">LPJ</td></tr>`
  ).join('');

  const thStyle = 'padding:11px 14px;text-align:left;color:#fff;font-size:13px;';

  const tblPre = preRows
    ? `<p style="font-weight:700;color:#111827;margin-bottom:8px;">📋 Proposal & RAK Belum Lengkap</p>
       <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
         <thead><tr style="background:linear-gradient(135deg,#065f46,#10b981);">
           <th style="${thStyle}">Nama Proker</th><th style="${thStyle}">Belum Selesai</th>
         </tr></thead><tbody>${preRows}</tbody></table>`
    : `<p style="color:#059669;margin-bottom:22px;">✅ Semua Proposal & RAK sudah lengkap!</p>`;

  const tblPost = postRows
    ? `<p style="font-weight:700;color:#111827;margin-bottom:8px;">📝 LPJ Belum Dikumpulkan</p>
       <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
         <thead><tr style="background:linear-gradient(135deg,#b45309,#f59e0b);">
           <th style="${thStyle}">Nama Proker</th><th style="${thStyle}">Belum Selesai</th>
         </tr></thead><tbody>${postRows}</tbody></table>`
    : `<p style="color:#059669;margin-bottom:22px;">✅ Semua LPJ sudah terkumpul!</p>`;

  const body = `<p>Halo <strong>${esc(namaUser)}</strong>,</p>
    <p style="color:#555;">Berikut daftar proker yang memerlukan follow-up administrasi:</p>
    ${tblPre}${tblPost}
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin-top:4px;">
      <p style="margin:0 0 6px;font-weight:700;color:#9a3412;">📌 Himbauan:</p>
      <ol style="margin:0;padding-left:20px;color:#9a3412;font-size:14px;">
        <li>Segera hubungi PIC terkait untuk melengkapi administrasi yang masih kurang.</li>
      </ol>
    </div>`;

  sendMail(toEmail, `[HIMAGRO HUB] Follow-up Administrasi – ${remBulan()}`,
    wrapEmail(`Follow-up Administrasi – ${remBulan()}`, body, 'Update di HIMAGRO HUB'));
  Logger.log('✓ Sekretaris → ' + toEmail);
}

function sendEmailBendahara(toEmail, namaUser) {
  const rows = getActiveProker().filter(p => !remBool(p.RAB)).map(p =>
    `<tr><td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#111827;">${esc(p.Nama_Proker)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${remFmtDate(p.Tanggal_Pelaksanaan)}</td></tr>`
  ).join('');

  const tbl = rows
    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:linear-gradient(135deg,#065f46,#10b981);">
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Nama Proker</th>
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Tanggal Pelaksanaan</th>
        </tr></thead><tbody>${rows}</tbody></table>`
    : `<p style="color:#059669;">✅ Semua RAB sudah terkumpul!</p>`;

  const body = `<p>Halo <strong>${esc(namaUser)}</strong>,</p>
    <p style="color:#555;">Berikut daftar proker yang <strong>RAB-nya belum diserahkan</strong>:</p>
    ${tbl}
    <p style="color:#555;font-size:14px;">Mohon segera follow-up kepada PIC masing-masing proker.</p>`;

  sendMail(toEmail, `[HIMAGRO HUB] Reminder RAB – ${remBulan()}`,
    wrapEmail(`Reminder RAB – ${remBulan()}`, body, 'Update di HIMAGRO HUB'));
  Logger.log('✓ Bendahara → ' + toEmail);
}

function sendEmailKadiv(toEmail, namaDivisi, divisiId) {
  const now   = remToday();
  const limit = new Date(now); limit.setMonth(limit.getMonth() + 2);

  const prokers = getActiveProker().filter(p => {
    const tgl = remParseDate(p.Tanggal_Pelaksanaan);
    return String(p.Divisi_ID || '').trim() === divisiId && tgl && tgl >= now && tgl <= limit;
  });

  const rows = prokers.map(p =>
    `<tr>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111827;">${esc(p.Nama_Proker)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${remFmtDate(p.Tanggal_Pelaksanaan)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;">${statusText(p)}</td>
    </tr>`).join('');

  const tbl = rows
    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:linear-gradient(135deg,#065f46,#10b981);">
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Nama Proker</th>
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Tanggal</th>
          <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Status Administrasi</th>
        </tr></thead><tbody>${rows}</tbody></table>`
    : `<p style="color:#9ca3af;">Tidak ada proker dalam 2 bulan ke depan untuk divisi ini.</p>`;

  const body = `<p>Halo <strong>Kepala Divisi ${esc(namaDivisi)}</strong>,</p>
    <p style="color:#555;">Berikut ringkasan status administrasi proker <strong>Divisi ${esc(namaDivisi)}</strong> untuk 2 bulan ke depan:</p>
    ${tbl}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
      <p style="margin:0 0 8px;font-weight:700;color:#065f46;">⚡ Action Required:</p>
      <ol style="margin:0;padding-left:20px;color:#065f46;font-size:14px;">
        <li>Segera lakukan follow-up kepada PIC terkait mengenai kelengkapan administrasi.</li>
      </ol>
      <p style="margin:10px 0 0;font-size:13px;color:#059669;">📊 Untuk melihat status administrasi secara lengkap, silakan kunjungi <strong>HIMAGRO HUB</strong>.</p>
    </div>`;

  sendMail(toEmail, `[HIMAGRO HUB] Monitoring Divisi ${namaDivisi} – ${remBulan()}`,
    wrapEmail(`Monitoring Divisi ${namaDivisi} – ${remBulan()}`, body, 'Buka HIMAGRO HUB'));
  Logger.log('✓ Kadiv ' + namaDivisi + ' → ' + toEmail);
}

function sendEmailBendaharaKas(toEmail, namaUser) {
  const body = `<p>Halo <strong>${esc(namaUser)}</strong>,</p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:18px;">
      <p style="margin:0;color:#854d0e;font-weight:700;font-size:15px;">💰 Reminder Mingguan: Tagihan Uang Kas</p>
    </div>
    <p style="color:#555;">Ini adalah pengingat rutin mingguan untuk segera melakukan <strong>penagihan uang kas</strong> kepada seluruh proker yang memiliki kewajiban keuangan tertunda.</p>
    <p style="color:#555;">Mohon lakukan penagihan dan pencatatan sesuai prosedur keuangan HIMAGRO.</p>
    <p style="color:#6b7280;font-size:14px;margin-top:16px;">Untuk melihat detail status keuangan proker, silakan kunjungi <strong>HIMAGRO HUB</strong>.</p>`;

  sendMail(toEmail, `[HIMAGRO HUB] Reminder Mingguan: Tagihan Uang Kas – ${remBulan()}`,
    wrapEmail('Reminder Tagihan Uang Kas', body, 'Update di HIMAGRO HUB'));
  Logger.log('✓ Bendahara Kas → ' + toEmail);
}

function sendEmailPICAdmin(toEmail, namaProker, itemBelum, hMin) {
  const urgBg  = hMin <= 7 ? '#fef2f2' : hMin <= 14 ? '#fffbeb' : '#f0fdf4';
  const urgBor = hMin <= 7 ? '#fecaca' : hMin <= 14 ? '#fde68a' : '#bbf7d0';
  const urgCol = hMin <= 7 ? '#dc2626' : hMin <= 14 ? '#d97706' : '#059669';
  const urgMsg = `⏰ ${hMin} hari lagi menuju pelaksanaan!`;

  const rows = itemBelum.map(item =>
    `<tr><td style="padding:11px 14px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111827;">❌ ${esc(item)}</td></tr>`
  ).join('');

  const body = `<p>Halo <strong>PIC ${esc(namaProker)}</strong>,</p>
    <div style="background:${urgBg};border:1px solid ${urgBor};border-radius:8px;padding:12px 15px;margin-bottom:18px;">
      <p style="margin:0;color:${urgCol};font-weight:700;font-size:15px;">${urgMsg}</p>
    </div>
    <p style="color:#555;">Mohon segera lengkapi administrasi berikut untuk proker <strong>${esc(namaProker)}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead><tr style="background:linear-gradient(135deg,#065f46,#10b981);">
        <th style="padding:11px 14px;text-align:left;color:#fff;font-size:13px;">Administrasi yang Belum Lengkap</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>
    <p style="color:#6b7280;font-size:14px;">Segera koordinasikan dengan SC HIMAGRO untuk update status.</p>`;

  sendMail(toEmail, `[HIMAGRO HUB] Reminder H-${hMin}: Administrasi ${namaProker}`,
    wrapEmail(`Reminder Administrasi – ${esc(namaProker)}`, body, 'Detail di HIMAGRO HUB'));
  Logger.log('✓ PIC Admin H-' + hMin + ' → ' + toEmail);
}

function sendEmailPICLPJ(toEmail, namaProker, tanggalPelaksanaan) {
  const body = `<p>Halo <strong>PIC ${esc(namaProker)}</strong>,</p>
    <p style="color:#555;">Mengingatkan bahwa <strong>LPJ</strong> untuk proker berikut belum dikumpulkan:</p>
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #10b981;border-radius:12px;padding:22px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:19px;font-weight:700;color:#111827;">${esc(namaProker)}</p>
      <p style="margin:0;font-size:14px;color:#6b7280;">Dilaksanakan: <strong>${remFmtDate(tanggalPelaksanaan)}</strong></p>
    </div>
    <p style="color:#6b7280;font-size:14px;">Mohon segera koordinasikan pengumpulan LPJ dengan Sekretaris HIMAGRO.</p>`;

  sendMail(toEmail, `[HIMAGRO HUB] Reminder LPJ: ${namaProker}`,
    wrapEmail(`Reminder LPJ – ${esc(namaProker)}`, body, 'Detail di HIMAGRO HUB'));
  Logger.log('✓ PIC LPJ → ' + toEmail);
}

function sendEmailRapat(r, hMin) {
  hMin = hMin || 3; // default H-3 jika tidak ada
  const hLabel  = hMin === 7 ? '7 hari' : '3 hari';
  const urgBg   = hMin === 7 ? '#f0fdf4' : '#fef9c3';
  const urgBor  = hMin === 7 ? '#bbf7d0' : '#fef08a';
  const urgCol  = hMin === 7 ? '#065f46' : '#854d0e';

  const body = `<p>Halo,</p>
    <p style="color:#555;">Mengingatkan bahwa ada agenda rapat dalam <strong>${hLabel} ke depan</strong>:</p>
    <div style="background:${urgBg};border:2px solid ${urgBor === '#bbf7d0' ? '#10b981' : '#eab308'};border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${urgCol};text-transform:uppercase;letter-spacing:1px;">Jenis Rapat</p>
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">${esc(r.JENIS_RAPAT || '')}</p>
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${urgCol};text-transform:uppercase;letter-spacing:1px;">Program Kerja</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">${esc(r.NAMA_PROKER || '')}</p>
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${urgCol};text-transform:uppercase;letter-spacing:1px;">Tanggal Rapat</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:${urgCol};">📅 ${remFmtDate(r.TANGGAL_RAPAT)}</p>
    </div>`;

  const title = `Reminder Rapat – ${hLabel} Lagi`;
  sendMail(r.PIC_EMAIL, `[HIMAGRO HUB] Rapat H-${hMin}: ${r.JENIS_RAPAT} – ${r.NAMA_PROKER}`,
    wrapEmail(title, body, 'Detail di HIMAGRO HUB'));
  Logger.log('✓ Rapat H-' + hMin + ' → ' + r.PIC_EMAIL);
}

// ==================== TESTING ====================

/**
 * Jalankan fungsi ini untuk menguji SEMUA jenis email.
 * Semua email akan dikirim ke EMAIL_TEST di sheet Config_Reminder.
 */
function testAllEmails() {
  const testEmail = getConfig('EMAIL_TEST');
  if (!testEmail) {
    Logger.log('ERROR: Isi EMAIL_TEST di sheet ' + RS_CONFIG + ' terlebih dahulu!');
    return;
  }
  if (!checkQuota(9)) {
    Logger.log('ERROR: Quota email tidak cukup (butuh min 9). Sisa: ' + MailApp.getRemainingDailyQuota());
    return;
  }

  Logger.log('=== TEST EMAIL → ' + testEmail + ' ===');

  Logger.log('[1/7] Ketum...');
  sendEmailKetum(testEmail, 'Test Ketua Umum');
  Utilities.sleep(1000);

  Logger.log('[2/7] Sekretaris...');
  sendEmailSekretaris(testEmail, 'Test Sekretaris');
  Utilities.sleep(1000);

  Logger.log('[3/9] Bendahara...');
  sendEmailBendahara(testEmail, 'Test Bendahara');
  Utilities.sleep(1000);

  Logger.log('[4/9] Kepala Divisi...');
  const divData = remSheetData(RS_DIVISI);
  const divLabel = divData.length > 0 ? String(divData[0].Nama_Divisi || 'Test Divisi') : 'Test Divisi';
  const divId    = divData.length > 0 ? String(divData[0].Divisi_ID   || 'D01')         : 'D01';
  sendEmailKadiv(testEmail, divLabel, divId);
  Utilities.sleep(1000);

  Logger.log('[5/9] PIC Administrasi Mingguan (contoh H-10)...');
  sendEmailPICAdmin(testEmail, 'Bakti Sosial Mahasiswa', ['Proposal', 'RAK'], 10);
  Utilities.sleep(1000);

  Logger.log('[6/9] PIC LPJ...');
  sendEmailPICLPJ(testEmail, 'Bakti Sosial Mahasiswa', '15/01/2025');
  Utilities.sleep(1000);

  Logger.log('[7/9] Bendahara Tagihan Kas Mingguan...');
  sendEmailBendaharaKas(testEmail, 'Test Bendahara');
  Utilities.sleep(1000);

  Logger.log('[8/9] Rapat H-7...');
  const d7 = new Date(); d7.setDate(d7.getDate() + 7);
  sendEmailRapat({
    JENIS_RAPAT  : 'Rapat Persiapan',
    NAMA_PROKER  : 'Seminar Agribisnis',
    TANGGAL_RAPAT: `${d7.getDate()}/${d7.getMonth()+1}/${d7.getFullYear()}`,
    PIC_EMAIL    : testEmail
  }, 7);
  Utilities.sleep(1000);

  Logger.log('[9/9] Rapat H-3...');
  const d3 = new Date(); d3.setDate(d3.getDate() + 3);
  sendEmailRapat({
    JENIS_RAPAT  : 'Rapat Koordinasi',
    NAMA_PROKER  : 'Bakti Sosial Mahasiswa',
    TANGGAL_RAPAT: `${d3.getDate()}/${d3.getMonth()+1}/${d3.getFullYear()}`,
    PIC_EMAIL    : testEmail
  }, 3);

  Logger.log('=== SELESAI! Cek inbox: ' + testEmail + ' (total 9 email) ===');
}

// ==================== EMAIL WRAPPER ====================

function wrapEmail(title, bodyHtml, btnText) {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:620px;margin:28px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">
  <div style="background:linear-gradient(135deg,#064e3b 0%,#10b981 60%,#34d399 100%);padding:30px;text-align:center;">
    <img src="${REM_LOGO}" width="62" height="62" alt="HIMAGRO" style="border-radius:50%;border:3px solid rgba(255,255,255,0.3);margin-bottom:12px;">
    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">HIMAGRO HUB · REMINDER SISTEM</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:19px;font-weight:700;">${esc(title)}</h1>
  </div>
  <div style="padding:28px 30px;color:#374151;line-height:1.65;font-size:15px;">${bodyHtml}</div>
  <div style="padding:0 30px 28px;text-align:center;">
    <a href="${REM_APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;padding:13px 30px;border-radius:50px;font-weight:700;font-size:14px;box-shadow:0 4px 15px rgba(16,185,129,0.35);">${esc(btnText)} →</a>
  </div>
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 30px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Email ini dikirim otomatis oleh Sistem Reminder <strong>HIMAGRO HUB</strong>.</p>
    <p style="margin:5px 0 0;font-size:12px;color:#6ee7b7;">© ${new Date().getFullYear()} HIMAGRO UNSIL · All rights reserved</p>
  </div>
</div></body></html>`;
}

// ==================== HELPERS ====================

function getActiveProker() {
  return remSheetData(RS_PROKER).filter(p => remIsActive(p.Is_Active) && p.Proker_ID && p.Nama_Proker);
}

function getProker2Months() {
  const now   = remToday();
  const limit = new Date(now); limit.setMonth(limit.getMonth() + 2);
  return getActiveProker().filter(p => {
    const tgl = remParseDate(p.Tanggal_Pelaksanaan);
    return tgl && tgl >= now && tgl <= limit;
  });
}

function buildBelumPreEvent(p) {
  const b = [];
  if (!remBool(p.Proposal)) b.push('Proposal');
  if (!remBool(p.RAK))      b.push('RAK');
  if (!remBool(p.RAB))      b.push('RAB');
  return b;
}

function buildPICMap() {
  const map = {};
  remSheetData(RS_PIC).forEach(r => {
    const id    = String(r.PIC_ID || '').trim();
    const email = String(r.Email  || '').trim();
    if (id && email) map[id] = email;
  });
  return map;
}

function statusBadges(p) {
  const items = [
    { label:'Prop', val: p.Proposal },
    { label:'RAK',  val: p.RAK },
    { label:'RAB',  val: p.RAB },
    { label:'LPJ',  val: p.LPJ },
  ];
  return items.map(it => {
    const ok = remBool(it.val);
    return `<span style="display:inline-block;background:${ok?'#dcfce7':'#fee2e2'};color:${ok?'#15803d':'#dc2626'};font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;margin:1px;">${ok?'✓':'✗'} ${it.label}</span>`;
  }).join('');
}

function statusText(p) {
  const f = v => remBool(v) ? '✅' : '❌';
  return `Prop ${f(p.Proposal)} · RAK ${f(p.RAK)} · RAB ${f(p.RAB)} · LPJ ${f(p.LPJ)}`;
}

function remSheetData(sheetName) {
  try {
    const ss    = SpreadsheetApp.openById(REM_SS_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) { Logger.log('Sheet tidak ditemukan: ' + sheetName); return []; }
    const vals = sheet.getDataRange().getValues();
    if (vals.length <= 1) return [];
    const hdrs = vals[0];
    return vals.slice(1).map(row => {
      const obj = {};
      hdrs.forEach((h, i) => { obj[String(h || '').trim().replace(/\s+/g, '_')] = row[i]; });
      return obj;
    });
  } catch(e) { Logger.log('Error remSheetData(' + sheetName + '): ' + e); return []; }
}

function getConfig(key) {
  try {
    const ss    = SpreadsheetApp.openById(REM_SS_ID);
    const sheet = ss.getSheetByName(RS_CONFIG);
    if (!sheet) return null;
    const vals  = sheet.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === key) return String(vals[i][1]).trim();
    }
    return null;
  } catch(e) { return null; }
}

function sendMail(to, subject, htmlBody) {
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody });
}

function checkQuota(needed) {
  needed = needed || 1;
  try {
    const rem = MailApp.getRemainingDailyQuota();
    if (rem < needed) { Logger.log('⚠ Quota email sisa ' + rem + ', dibutuhkan ' + needed); return false; }
    return true;
  } catch(e) { return true; }
}

function logSent(type, email, refId, logKey) {
  try {
    const ss    = SpreadsheetApp.openById(REM_SS_ID);
    const sheet = ss.getSheetByName(RS_LOG);
    if (sheet) sheet.appendRow([new Date(), type, email, refId, logKey, 'Sent']);
  } catch(e) { Logger.log('Error logSent: ' + e); }
}

/**
 * Cek apakah email dengan logKey tertentu sudah pernah dikirim.
 * Digunakan untuk reminder harian (H-7/H-3, LPJ) – cek berdasarkan logKey + email hari ini.
 */
function alreadySentToday(logKey, email) {
  try {
    const ss    = SpreadsheetApp.openById(REM_SS_ID);
    const sheet = ss.getSheetByName(RS_LOG);
    if (!sheet) return false;
    const today = remToday().getTime();
    const vals  = sheet.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      const ts = remToday(new Date(vals[i][0])).getTime();
      if (ts === today && vals[i][2] === email && vals[i][4] === logKey) return true;
    }
    return false;
  } catch(e) { return false; }
}

/**
 * Cek apakah log_key sudah pernah ada di log (tanpa peduli tanggal).
 * Digunakan untuk reminder MINGGUAN karena log_key sudah encode periode (misal: 2026-W18).
 * Ini mencegah duplikasi email di minggu yang sama meski trigger jalan berkali-kali.
 */
function alreadySentInPeriod(logKey) {
  try {
    const ss    = SpreadsheetApp.openById(REM_SS_ID);
    const sheet = ss.getSheetByName(RS_LOG);
    if (!sheet) return false;
    const vals = sheet.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][4] === logKey) return true; // cukup cocokkan log_key saja
    }
    return false;
  } catch(e) { return false; }
}

function remParseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1]);
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function remFmtDate(val) {
  const d = remParseDate(val);
  if (!d) return '-';
  const M = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
}

function remToday(d) {
  const t = d ? new Date(d) : new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function remBool(val) {
  return val === true || val === 'TRUE' || val === 'true' || val === 1;
}

function remIsActive(val) {
  // Jika undefined (kolom hilang di sheet), default ke true agar tidak error.
  // Namun jika '' (string kosong / cell kosong) atau null, anggap false karena checkbox tidak dicentang.
  if (val === undefined) return true;
  return remBool(val);
}

function remBulan() {
  const M = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date();
  return M[d.getMonth()] + ' ' + d.getFullYear();
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Kunci unik per bulan untuk dedup log bulanan, contoh: '2026-03' */
function remBulanKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** Kunci unik per minggu ISO untuk dedup, contoh: '2026-W17' */
function remWeekKey() {
  const d    = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(week).padStart(2, '0');
}
