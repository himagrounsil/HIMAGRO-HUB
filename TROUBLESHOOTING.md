# Troubleshooting Guide - HIMAGRO Hub

## Error yang Sering Terjadi

### 1. Error: "Kolom Task atau Due Date tidak ditemukan di sheet Content Planner"

**Penyebab:**
- Nama kolom di spreadsheet tidak sesuai
- Kolom tidak ada di sheet Content Planner
- Header kolom ada di baris yang salah

**Solusi:**
1. Buka spreadsheet Konten
2. Buka sheet "Content Planner"
3. Pastikan di baris pertama (header) ada kolom dengan nama:
   - **"Task"** (atau mengandung kata "task")
   - **"Due Date"** (atau "DueDate" atau mengandung "due date")
4. Nama kolom tidak case-sensitive, tapi harus mengandung kata tersebut
5. Contoh nama kolom yang valid:
   - "Task" ✅
   - "TASK" ✅
   - "task" ✅
   - "Task Name" ✅
   - "Due Date" ✅
   - "DueDate" ✅
   - "due date" ✅
   - "DUE DATE" ✅

**Cara Cek:**
- **PENTING**: Header harus ada di **baris 16**, bukan baris 1!
- Lihat baris 16 di sheet Content Planner
- Pastikan ada kolom yang namanya mengandung "task" dan "due date"
- Pastikan data mulai dari baris 17 ke bawah
- Jika tidak ada, tambahkan atau rename kolom yang ada di baris 16

---

### 2. Error: "ID parameter tidak ditemukan" saat melihat detail proker

**Penyebab:**
- ID proker tidak terkirim dengan benar
- ID proker kosong atau undefined

**Solusi:**
1. Pastikan ada data proker di spreadsheet
2. Pastikan Proker_ID sudah terisi di kolom pertama sheet "Proker"
3. Refresh halaman dan coba lagi
4. Cek browser console (F12) untuk error detail

**Cara Cek:**
- Buka spreadsheet Proker
- Buka sheet "Proker"
- Pastikan kolom A (Proker_ID) terisi untuk setiap baris data
- Pastikan tidak ada baris kosong di antara data

---

### 3. Error: "Action parameter tidak ditemukan"

**Penyebab:**
- Request tidak mengirim parameter `action`
- URL Apps Script tidak benar

**Solusi:**
1. Pastikan Web App URL sudah benar di `script.js`
2. Pastikan Apps Script sudah di-deploy
3. Pastikan saat deploy, "Who has access" sudah di-set ke "Anyone" atau "Anyone with Google account"

**Cara Cek:**
- Buka file `script.js`
- Pastikan `APPS_SCRIPT_URL` sudah diisi dengan URL yang benar
- Format URL: `https://script.google.com/macros/s/SCRIPT_ID/exec`

---

### 4. Error: "Username atau password salah" saat login

**Penyebab:**
- Username atau password tidak sesuai
- Ada spasi di username/password
- Is_Active checkbox tidak checked
- Format data di sheet Master_SC tidak benar

**Solusi:**
1. Buka spreadsheet Proker
2. Buka sheet "Master_SC"
3. Pastikan data di baris 2 (setelah header):
   - Kolom A: SC_ID (contoh: SC01)
   - Kolom B: Nama
   - Kolom C: Email
   - Kolom D: Username (contoh: ketua)
   - Kolom E: Password (contoh: ketua123)
   - Kolom F: Jabatan
   - Kolom G: Is_Active (checkbox harus checked/TRUE)
4. Pastikan tidak ada spasi di username dan password
5. Username dan password adalah case-sensitive
6. Pastikan Is_Active = TRUE (checkbox checked)

**Cara Cek:**
- Lihat baris 2 di sheet Master_SC
- Pastikan username dan password sesuai
- Pastikan kolom G (Is_Active) checkbox checked
- Coba login lagi dengan username dan password yang tepat

---

### 5. Error: "Sheet tidak ditemukan"

**Penyebab:**
- Nama sheet tidak sesuai
- Sheet belum dibuat

**Solusi:**
1. Pastikan nama sheet sudah benar (case-sensitive):
   - Spreadsheet Proker:
     - `Proker` (bukan "proker" atau "PROKER")
     - `Rapat_Proker` (dengan underscore)
     - `Master_SC` (dengan underscore)
     - `History_Log` (akan dibuat otomatis)
   - Spreadsheet Konten:
     - `Content Planner` (dengan spasi)
2. Buat sheet yang belum ada
3. Pastikan tidak ada typo di nama sheet

---

### 6. Error: "Permission denied" atau "Access denied"

**Penyebab:**
- Apps Script tidak memiliki akses ke spreadsheet
- Spreadsheet tidak di-share ke akun Google yang digunakan

**Solusi:**
1. Pastikan spreadsheet Proker dan Konten sudah di-share ke akun Google yang digunakan untuk Apps Script
2. Set permission minimal "Viewer" untuk spreadsheet Konten
3. Set permission "Editor" untuk spreadsheet Proker (karena perlu write access)
4. Pastikan saat deploy Apps Script, "Execute as" sudah di-set ke "Me"

**Cara Cek:**
- Buka spreadsheet Proker → Share → Pastikan akun Google Apps Script ada di list
- Buka spreadsheet Konten → Share → Pastikan akun Google Apps Script ada di list

---

## Checklist Troubleshooting

Jika masih ada error, cek checklist berikut:

### Spreadsheet Proker
- [ ] Sheet "Proker" sudah dibuat
- [ ] Header kolom sudah benar di baris pertama
- [ ] Kolom A adalah "Proker_ID"
- [ ] Ada minimal 1 baris data (selain header)
- [ ] Sheet "Rapat_Proker" sudah dibuat (opsional, untuk detail)
- [ ] Sheet "Master_SC" sudah dibuat dengan data login
- [ ] Spreadsheet sudah di-share ke akun Google Apps Script

### Spreadsheet Konten
- [ ] Sheet "Content Planner" sudah dibuat
- [ ] Ada kolom dengan nama mengandung "Task"
- [ ] Ada kolom dengan nama mengandung "Due Date"
- [ ] **Header kolom ada di baris 16** (bukan baris 1!)
- [ ] **Data mulai dari baris 17** ke bawah
- [ ] Spreadsheet sudah di-share ke akun Google Apps Script

### Apps Script
- [ ] Spreadsheet ID sudah di-update di `apps-script.gs`
- [ ] Apps Script sudah di-save
- [ ] Apps Script sudah di-authorize
- [ ] Apps Script sudah di-deploy sebagai Web App
- [ ] Web App URL sudah di-copy

### Frontend
- [ ] Web App URL sudah di-update di `script.js`
- [ ] File `index.html`, `script.js`, `styles.css` sudah lengkap
- [ ] Browser console tidak ada error JavaScript

---

## Cara Cek Error Detail

### 1. Browser Console
1. Buka aplikasi web di browser
2. Tekan F12 untuk buka Developer Tools
3. Klik tab "Console"
4. Lihat error yang muncul (warna merah)
5. Screenshot atau copy error message

### 2. Apps Script Execution Log
1. Buka [script.google.com](https://script.google.com)
2. Buka project Apps Script
3. Klik "View" → "Executions"
4. Lihat execution log terbaru
5. Klik execution yang error untuk lihat detail

### 3. Test URL Langsung
Test URL Apps Script langsung di browser:
- `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getProker`
- `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getKonten`
- `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=validateLogin&username=test&password=test`

Jika muncul error, berarti masalah di Apps Script.
Jika muncul JSON response, berarti Apps Script bekerja.

---

## Tips

1. **Selalu cek browser console** saat ada error
2. **Cek Apps Script execution log** untuk error detail
3. **Pastikan semua nama sheet dan kolom sudah benar** (case-sensitive)
4. **Pastikan spreadsheet sudah di-share** ke akun Google Apps Script
5. **Deploy ulang Apps Script** setelah mengubah kode

---

## Support

Jika masih ada masalah setelah mengikuti troubleshooting ini:
1. Screenshot error message
2. Screenshot browser console (F12)
3. Screenshot Apps Script execution log
4. Berikan detail langkah yang sudah dilakukan

