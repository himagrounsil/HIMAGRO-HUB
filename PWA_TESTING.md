# PWA Testing Guide - HIMAGRO Hub

## 🚀 Deploy ke GitHub Pages

### 1. Push ke GitHub
```bash
git add .
git commit -m "Add PWA support"
git push origin main
```

### 2. Aktifkan GitHub Pages
1. Buka repository di GitHub
2. Settings → Pages
3. Source: Deploy from branch `main` (atau `gh-pages`)
4. Folder: `/ (root)`
5. Save

### 3. Akses URL
- URL akan berbentuk: `https://username.github.io/HIMAGRO-HUB/`
- Tunggu 1-2 menit untuk deployment

## ✅ Cara Test PWA

### A. Test di Desktop (Chrome/Edge)
1. Buka DevTools (F12)
2. Tab **Application** → **Manifest**
   - ✅ Cek apakah manifest terdeteksi
   - ✅ Lihat ikon dan konfigurasi
3. Tab **Application** → **Service Workers**
   - ✅ Pastikan status "activated and running"
4. Tab **Lighthouse**
   - Run audit untuk PWA
   - Skor minimal 80/100

### B. Test di Mobile (Android)
1. Buka di Chrome Android
2. Menu (⋮) → **Install app** atau **Add to Home screen**
3. Ikon HIMAGRO akan muncul di home screen
4. Buka dari home screen → tampil fullscreen

### C. Test di Mobile (iOS/Safari)
1. Buka di Safari iOS
2. Tap tombol Share (kotak dengan panah)
3. **Add to Home Screen**
4. Ikon HIMAGRO akan muncul di home screen

## 🐛 Troubleshooting

### ❌ "Tidak muncul apapun"
**Kemungkinan Penyebab:**
1. **Path manifest salah**
   - Cek di DevTools Console ada error?
   - Pastikan `manifest.json` di root folder
   
2. **Service Worker tidak register**
   - Buka DevTools Console
   - Cari pesan "Service Worker registered" atau error
   
3. **HTTPS tidak aktif**
   - GitHub Pages otomatis HTTPS ✅
   - Tapi pastikan akses pakai `https://` bukan `http://`

4. **Cache browser lama**
   - Hard refresh: `Ctrl + Shift + R` (Windows)
   - Atau clear cache browser

### ❌ Manifest tidak terdeteksi
Cek di DevTools Console:
```
Failed to load manifest
```
**Solusi:** Path manifest mungkin salah. Ubah di `index.html`:
```html
<!-- Jika di subfolder GitHub Pages -->
<link rel="manifest" href="./manifest.json">
```

### ❌ Service Worker gagal register
Cek error di Console. Biasanya:
- Path `sw.js` salah
- Scope tidak sesuai
- HTTPS tidak aktif

## 🔧 Quick Fix Commands

### Clear Service Worker (jika stuck)
Buka DevTools Console:
```javascript
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
});
```

### Test Manifest
```javascript
fetch('./manifest.json')
  .then(r => r.json())
  .then(data => console.log('✅ Manifest loaded:', data))
  .catch(e => console.error('❌ Manifest error:', e));
```

### Test Service Worker
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => console.log('Service Workers:', regs));
}
```

## 📱 Expected Behavior

### ✅ Berhasil jika:
1. DevTools Application tab menampilkan manifest
2. Service Worker status "activated"
3. Muncul prompt "Install app" di Chrome
4. Bisa diinstall ke home screen
5. Lighthouse PWA score > 80

### ⚠️ Perlu perbaikan jika:
- Console menampilkan error merah
- Manifest tidak terdeteksi
- Service Worker tidak register
- Tidak ada prompt install

## 🎯 Checklist Deploy

- [ ] File `manifest.json` ada di root
- [ ] File `sw.js` ada di root  
- [ ] `index.html` sudah ada link manifest
- [ ] Service Worker registration script ada
- [ ] Push ke GitHub
- [ ] GitHub Pages aktif
- [ ] Akses via HTTPS
- [ ] Test di DevTools
- [ ] Test install di mobile

## 📞 Debug Info Needed

Jika masih bermasalah, kirim info ini:
1. URL GitHub Pages
2. Screenshot DevTools Console
3. Screenshot DevTools Application → Manifest
4. Browser & OS yang digunakan
