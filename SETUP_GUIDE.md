# Panduan Setup HIMAGRO Hub - 2 Spreadsheet

Panduan lengkap untuk setup aplikasi dengan 2 spreadsheet yang berbeda.

## 📋 Daftar Spreadsheet yang Dibutuhkan

### 1. Spreadsheet Proker
Berisi 4 sheet:
- **Proker** - Data proker utama
- **Rapat_Proker** - Data rapat untuk setiap proker
- **Master_SC** - Database username/password untuk login SC
- **History_Log** - Log semua perubahan (akan dibuat otomatis)

### 2. Spreadsheet Konten
Berisi 1 sheet:
- **Content Planner** - Data konten dari Kominfo

---

## 🚀 Langkah-langkah Setup

### STEP 1: Buat Spreadsheet Proker

1. **Buat Google Spreadsheet baru**
   - Buka [Google Sheets](https://sheets.google.com)
   - Klik "Blank" untuk membuat spreadsheet baru
   - Beri nama: **"HIMAGRO Proker"** (atau nama lain)

2. **Buat Sheet "Proker"**
   - Sheet pertama sudah ada dengan nama "Sheet1"
   - Klik kanan pada tab "Sheet1" → Rename → **"Proker"**
   - Buat header di baris pertama (kolom A-M):
     ```
     A1: Proker_ID
     B1: Nama_Proker
     C1: Divisi_ID
     D1: PIC_ID
     E1: Tanggal_Pelaksana
     F1: Proposal
     G1: RAK
     H1: RAB
     I1: LPJ
     J1: Status_Selesai
     K1: Is_Active
     L1: Created_At
     M1: Updated_At
     ```
   - Format header: Bold, background warna (opsional)

3. **Buat Sheet "Rapat_Proker"**
   - Klik ikon "+" di bawah untuk membuat sheet baru
   - Rename menjadi **"Rapat_Proker"**
   - Buat header di baris pertama (kolom A-I):
     ```
     A1: RAPAT_ID
     B1: PROKER_ID
     C1: NAMA_PROKER
     D1: JENIS_RAPAT
     E1: TANGGAL_RAP
     F1: PIC
     G1: PIC_EMAIL
     H1: STATUS_RAPAT
     I1: AKTIF
     ```

4. **Buat Sheet "Master_SC"**
   - Buat sheet baru, rename menjadi **"Master_SC"**
   - Buat header di baris pertama (kolom A-G):
     ```
     A1: SC_ID
     B1: Nama
     C1: Email
     D1: Username
     E1: Password
     F1: Jabatan
     G1: Is_Active
     ```
   - Tambahkan data contoh di baris 2:
     ```
     A2: SC01
     B2: Nama Ketua
     C2: ketua@example.com
     D2: ketua
     E2: ketua123
     F2: Ketua
     G2: TRUE (checkbox checked)
     ```

5. **Copy Spreadsheet ID Proker**
   - Lihat URL di browser: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
   - Copy bagian **SPREADSHEET_ID_HERE** (antara `/d/` dan `/edit`)
   - Simpan ID ini, akan digunakan nanti

---

### STEP 2: Buat Spreadsheet Konten

1. **Buat Google Spreadsheet baru**
   - Buka [Google Sheets](https://sheets.google.com)
   - Klik "Blank" untuk membuat spreadsheet baru
   - Beri nama: **"HIMAGRO Konten"** (atau nama lain)

2. **Setup Sheet "Content Planner"**
   - Sheet pertama sudah ada dengan nama "Sheet1"
   - Klik kanan pada tab "Sheet1" → Rename → **"Content Planner"**
   - **PENTING**: Header kolom harus ada di **baris 16**
   - Data dimulai dari **baris 17** ke bawah
   - Pastikan ada kolom **"Task"** dan **"Due Date"** di baris 16 (header)
   - Jika sudah ada data, pastikan header ada di baris 16 dan data mulai baris 17
   - Jika belum ada, buat header di baris 16:
     ```
     Baris 16: Header dengan kolom "Task" dan "Due Date" (bisa di kolom manapun)
     Baris 17 ke bawah: Data konten
     ```
   - **PENTING**: 
     - Header harus di baris 16 (bukan baris 1)
     - Data mulai baris 17
     - Apps Script akan mencari kolom berdasarkan nama header, jadi pastikan nama kolomnya mengandung "Task" dan "Due Date"

3. **Copy Spreadsheet ID Konten**
   - Lihat URL di browser: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
   - Copy bagian **SPREADSHEET_ID_HERE**
   - Simpan ID ini, akan digunakan nanti

---

### STEP 3: Setup Google Apps Script

1. **Buka Google Apps Script**
   - Buka [script.google.com](https://script.google.com)
   - Klik "New Project"

2. **Copy Kode Apps Script**
   - Buka file `apps-script.gs` dari project ini
   - Copy semua isinya
   - Paste ke editor Apps Script

3. **Update Spreadsheet ID**
   - Di bagian atas file, cari:
     ```javascript
     const SPREADSHEET_ID_PROKER = 'YOUR_PROKER_SPREADSHEET_ID';
     const SPREADSHEET_ID_KONTEN = 'YOUR_KONTEN_SPREADSHEET_ID';
     ```
   - Ganti `YOUR_PROKER_SPREADSHEET_ID` dengan ID spreadsheet Proker yang sudah di-copy
   - Ganti `YOUR_KONTEN_SPREADSHEET_ID` dengan ID spreadsheet Konten yang sudah di-copy
   - Contoh:
     ```javascript
     const SPREADSHEET_ID_PROKER = '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
     const SPREADSHEET_ID_KONTEN = '9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k';
     ```

4. **Save Project**
   - Klik "Save" (Ctrl+S atau Cmd+S)
   - Beri nama project: **"HIMAGRO Hub Backend"**

5. **Authorize Spreadsheet Access**
   - Klik "Run" (ikon play) di toolbar
   - Pilih fungsi `doGet` atau `doPost` (pilih salah satu)
   - Klik "Run"
   - Akan muncul popup "Authorization required"
   - Klik "Review Permissions"
   - Pilih akun Google Anda
   - Klik "Advanced" → "Go to [project name] (unsafe)"
   - Klik "Allow"
   - **PENTING**: Apps Script perlu akses ke kedua spreadsheet, jadi pastikan authorize dengan benar

---

### STEP 4: Deploy sebagai Web App

1. **Deploy Web App**
   - Di Apps Script editor, klik **"Deploy"** → **"New deployment"**
   - Klik ikon **⚙️ (gear)** di sebelah "Select type"
   - Pilih **"Web app"**

2. **Konfigurasi Deployment**
   - **Description**: HIMAGRO Hub Backend (opsional)
   - **Execute as**: **Me** (your email)
   - **Who has access**: 
     - Pilih **"Anyone"** untuk akses publik (tidak perlu login Google)
     - ATAU **"Anyone with Google account"** untuk lebih aman (perlu login Google)
   - Klik **"Deploy"**

3. **Copy Web App URL**
   - Setelah deploy, akan muncul popup dengan **Web App URL**
   - Format URL: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
   - **Copy URL ini**, akan digunakan di frontend

4. **Authorize Access (jika diminta)**
   - Jika muncul popup authorization, klik "Authorize access"
   - Pilih akun Google Anda
   - Klik "Allow"

---

### STEP 5: Update Frontend

1. **Buka file `script.js`**
   - Buka file `script.js` di project ini

2. **Update Apps Script URL**
   - Cari baris:
     ```javascript
     const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL';
     ```
   - Ganti `YOUR_APPS_SCRIPT_WEB_APP_URL` dengan Web App URL yang sudah di-copy
   - Contoh:
     ```javascript
     const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1234567890/exec';
     ```

3. **Save file**

---

### STEP 6: Test Aplikasi

1. **Buka `index.html` di browser**
   - Bisa langsung buka file, atau
   - Gunakan local server (Python: `python -m http.server 8000`)

2. **Test Fitur**
   - ✅ Cek apakah data Proker muncul (jika sudah ada data)
   - ✅ Cek apakah data Konten muncul (jika sudah ada data)
   - ✅ Test login SC dengan username/password dari sheet Master_SC
   - ✅ Test tambah/edit/hapus proker (harus login SC dulu)
   - ✅ Test lihat detail proker

3. **Troubleshooting**
   - Jika error "Gagal memuat data":
     - Pastikan Spreadsheet ID sudah benar
     - Pastikan nama sheet sudah benar (case-sensitive)
     - Pastikan Apps Script sudah di-deploy
     - Cek browser console (F12) untuk error detail
   - Jika error "Permission denied":
     - Pastikan saat deploy, "Who has access" sudah di-set ke "Anyone" atau "Anyone with Google account"
     - Pastikan sudah authorize Apps Script dengan benar

---

## 📝 Checklist Setup

- [ ] Spreadsheet Proker dibuat dengan 4 sheet (Proker, Rapat_Proker, Master_SC, History_Log)
- [ ] Spreadsheet Konten dibuat dengan sheet Content Planner
- [ ] Header kolom sudah benar di semua sheet
- [ ] Spreadsheet ID Proker sudah di-copy
- [ ] Spreadsheet ID Konten sudah di-copy
- [ ] Apps Script project dibuat
- [ ] Spreadsheet ID sudah di-update di `apps-script.gs`
- [ ] Apps Script sudah di-save
- [ ] Apps Script sudah di-authorize
- [ ] Apps Script sudah di-deploy sebagai Web App
- [ ] Web App URL sudah di-copy
- [ ] Web App URL sudah di-update di `script.js`
- [ ] Aplikasi sudah di-test

---

## 🔐 Setup Login SC

Untuk bisa login sebagai SC, pastikan ada data di sheet **Master_SC**:

1. Buka spreadsheet Proker
2. Buka sheet "Master_SC"
3. Tambahkan data di baris 2 (contoh):
   ```
   SC_ID: SC01
   Nama: Nama Ketua
   Email: ketua@example.com
   Username: ketua
   Password: ketua123
   Jabatan: Ketua
   Is_Active: TRUE (checkbox checked)
   ```

4. Gunakan username dan password ini untuk login di web

---

## 📊 Format Data

### Sheet Proker
- **Proker_ID**: Text (akan di-generate otomatis saat create)
- **Nama_Proker**: Text (required)
- **Divisi_ID**: Text
- **PIC_ID**: Text
- **Tanggal_Pelaksana**: Date
- **Proposal**: Checkbox (TRUE/FALSE)
- **RAK**: Checkbox (TRUE/FALSE)
- **RAB**: Checkbox (TRUE/FALSE)
- **LPJ**: Checkbox (TRUE/FALSE)
- **Status_Selesai**: Checkbox (TRUE/FALSE)
- **Is_Active**: Checkbox (TRUE/FALSE, default TRUE)
- **Created_At**: Date (auto)
- **Updated_At**: Date (auto)

### Sheet Content Planner
- **Task**: Text (akan diambil sebagai nama konten)
- **Due Date**: Date (akan diambil sebagai tanggal konten)
- Kolom lain akan diabaikan

---

## ⚠️ Catatan Penting

1. **Spreadsheet ID**: Pastikan ID yang di-copy benar (tidak ada spasi atau karakter tambahan)

2. **Nama Sheet**: Nama sheet harus tepat sesuai (case-sensitive):
   - "Proker" (bukan "proker" atau "PROKER")
   - "Rapat_Proker" (dengan underscore)
   - "Master_SC" (dengan underscore)
   - "History_Log" (akan dibuat otomatis)
   - "Content Planner" (dengan spasi)

3. **Kolom Header**: 
   - Header harus ada di baris pertama
   - Nama kolom harus tepat (case-insensitive untuk Content Planner, tapi lebih baik sama persis)

4. **Permission**: 
   - Pastikan akun Google yang digunakan untuk Apps Script memiliki akses ke kedua spreadsheet
   - Jika spreadsheet di-share, pastikan permission-nya "Editor" atau "Viewer" sesuai kebutuhan

5. **History_Log**: 
   - Sheet ini akan dibuat otomatis saat pertama kali ada perubahan
   - Tidak perlu dibuat manual

6. **Update Apps Script**: 
   - Setelah mengubah kode Apps Script, harus **deploy ulang** (Deploy → Manage deployments → Edit → New version → Deploy)

---

## 🆘 Troubleshooting

### Error: "Sheet tidak ditemukan"
- Pastikan nama sheet sudah benar (case-sensitive)
- Pastikan sheet sudah dibuat di spreadsheet

### Error: "Kolom tidak ditemukan"
- Pastikan header kolom sudah benar
- Untuk Content Planner, pastikan ada kolom "Task" dan "Due Date"

### Error: "Permission denied"
- Pastikan Apps Script sudah di-authorize
- Pastikan spreadsheet sudah di-share ke akun Google yang digunakan

### Data tidak muncul
- Pastikan ada data di spreadsheet (minimal header)
- Pastikan Is_Active = TRUE untuk data Proker
- Cek browser console (F12) untuk error detail

### Login tidak berhasil
- Pastikan username dan password sudah benar di sheet Master_SC
- Pastikan Is_Active = TRUE untuk user tersebut
- Pastikan tidak ada spasi di username/password

---

## 📞 Support

Jika masih ada masalah:
1. Cek browser console (F12) untuk error detail
2. Cek Apps Script execution log (View → Executions)
3. Pastikan semua checklist sudah dicentang
4. Pastikan format data sudah benar

---

**Selamat setup! 🚀**

