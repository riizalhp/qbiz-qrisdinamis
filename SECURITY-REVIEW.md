# Tinjauan keamanan qbiz-qrisdinamis v1.3.2 (untuk Employr)

Ditinjau dari kode sumber tag `v1.3.2`. Ini tinjauan baca-kode oleh pihak pengguna, bukan audit independen.

## Latar

- Repo dibuat 2026-08-03, 1 pemelihara, 12 bintang, lisensi MIT, commit tidak bertanda tangan.
- Riwayat commit menyebut penghapusan workflow "unauthorized/malicious/exfiltration" (16 dan 23 Okt). Kami tidak tahu isinya; sebab itu kami memakai fork dan tidak menarik image upstream.

## Sudah ditambal (lihat PATCHES.md)

P1 akun/API key publik, P2 QRIS tiruan, P3 galat ditelan, P4 secret webhook publik, P5 skrip CDN, P6 jalur OTP/data tiruan, P7 reconcile tanpa auth, P8 port DB terbuka, P9 base image mengambang, P10 ekstensi unggahan.

## Masih ada, diterima dengan mitigasi

| Temuan | Risiko | Mitigasi |
|--------|--------|----------|
| `GET /api/v1/invoices/:id/status` publik dan memicu pengaktifan ulang listener Puppeteer untuk merchant tersebut bila belum aktif. | Siapa pun yang tahu id invoice dapat memicu pekerjaan browser (beban CPU/RAM). Id invoice berisi timestamp + 16 byte acak, sulit ditebak. | Id tidak dibagikan selain ke pembeli. Pantau RAM. Pertimbangkan rate limit di reverse proxy. |
| Tanda tangan webhook = HMAC atas isi JSON saja (header timestamp ada tetapi tidak ikut ditandatangani). | Pengulangan (replay) webhook lama. | Employr memverifikasi tanda tangan, lalu memeriksa status ke `GET /invoices/:id/status` dan mencocokkan nominal serta order sebelum memberi akses. Idempoten per `order_id`. |
| Admin qbiz dapat menandai invoice LUNAS lewat reconcile. | Penyalahgunaan oleh admin qbiz. | Akun admin qbiz hanya milik pemilik Employr; 2FA belum ada, gunakan kata sandi panjang. Employr tetap mencocokkan nominal. |
| Deteksi pembayaran bergantung pada scraping GoBiz (Puppeteer) dan sesi cookie. | Bisa putus saat GoBiz mengubah tampilan/otentikasi. | Antrean klaim manual di admin Employr; uji sandbox sebelum produksi. |
| QRIS dipakai bersama bisnis lain. | Nominal bertabrakan dengan transaksi non-Employr. | Selisih nominal acak non-bulat dari Employr, `reserved_amounts`, pencocokan manual dengan referensi. |
| README upstream menyatakan hanya QRIS Food Merchant yang didukung. | QRIS "GoPay Merchant" mungkin tidak terdeteksi. | Diuji di gerbang Task 1 dengan pembayaran kecil sungguhan. |
| Cookie sesi memakai `secure: isHttps` (ditentukan dari permintaan, bukan dipaksa). | Di belakang reverse proxy, bendera `secure` bergantung pada deteksi HTTPS. | Pastikan proxy meneruskan `X-Forwarded-Proto: https`; periksa cookie di browser saat uji Task 1. Jangan buka port 8000 ke publik. |

## Daftar periksa tiap naik versi upstream

- Bandingkan diff `main.tsx`, `src/middleware/auth.ts`, `worker/puppeteer-listener.ts`, `src/services/webhooks.ts`, `Dockerfile`, `docker-compose.yml`, `.github/`.
- Cari panggilan jaringan keluar baru (`fetch(`, `WebSocket`, `Deno.Command`) dan ketergantungan baru.
- Cari kredensial/URL tertanam dan perubahan pada rute yang dikecualikan dari middleware auth.
- Jalankan ulang tes dan uji kotak hitam.
