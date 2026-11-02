# Patch Employr atas qbiz-qrisdinamis v1.3.2

Basis: tag `v1.3.2`, commit `0fdbafb523e69305210c40710dd09c14e7d75293` (ardianryan/qbiz-qrisdinamis, MIT).
Branch kerja: `employr/v1.3.2`. Setiap perubahan ditandai `[EMPLOYR PATCH Pn]` di kode.

Prinsip: patch sekecil mungkin, hanya menutup celah yang bisa menggerakkan uang atau membocorkan akses.
Fitur upstream tidak diubah. Generator kode unik qbiz sengaja TIDAK diubah: Employr memilih selisih nominal sendiri.

| ID | Masalah di upstream | Perbaikan | Berkas |
|----|---------------------|-----------|--------|
| P1 | Saat tabel `users` kosong, boot membuat 5 akun berkata sandi publik, API key publik, URL webhook.site, dan 2 merchant tiruan. | Hanya 1 `SUPER_ADMIN` dari `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` (min. 12 karakter), API key & secret acak. Tanpa env, tidak ada akun dibuat. `db/seed.ts` dinonaktifkan. | `main.tsx`, `db/seed.ts`, README |
| P2 | Bila unggahan QRIS gagal dibaca, QRIS contoh ("Resto Ayam Bakar Cbk") disimpan diam-diam. Halaman `/pay/:id` juga jatuh ke QRIS contoh. Ekstensi unggahan diambil dari nama berkas. | QRIS wajib lolos `validateStaticQrisPayload` (struktur, CRC16, tag 52/53/58/59/60), kalau tidak 400. QRIS contoh hanya untuk `SANDBOX_MODE=true` atau invoice sandbox. Ekstensi dibatasi png/jpg/jpeg/webp. | `main.tsx`, `src/utils/qris.ts` |
| P3 | Pembuatan invoice menelan semua galat dan mengembalikan sukses dengan `qris_payload` kosong. Edit merchant menelan galat. `merchant_id` bawaan `mrc_toko_1`. | Merchant dicek lebih dulu (404), QRIS divalidasi (409), QR dibentuk sebelum invoice ditulis, galat dikembalikan 500. `merchant_id` wajib (400). Edit merchant gagal = 500. | `main.tsx` |
| P4 | Secret HMAC webhook bawaan publik `qbiz_secret_key_hmac_2026`. | Tanpa secret, webhook tidak dikirim (fail-closed). | `worker/puppeteer-listener.ts` |
| P5 | `/docs` memuat skrip CDN tanpa versi di origin dashboard. | 404 kecuali `ENABLE_API_DOCS=true`. | `main.tsx` |
| P6 | Merchant berawalan `mrc_toko` melewati OTP GoBiz sungguhan; galat DB menampilkan data transaksi palsu. | Jalur tiruan hanya bila `SANDBOX_MODE=true`. Galat DB tidak lagi menampilkan data palsu. | `main.tsx` |
| P7 | `POST /api/v1/invoices/:id/reconcile` tanpa autentikasi: siapa pun yang tahu id invoice bisa menandai LUNAS dan memicu webhook bertanda tangan. | Wajib login dengan peran SUPER_ADMIN / ADMIN / REGIONAL_ADMIN (regional hanya merchant miliknya). | `main.tsx`, `src/middleware/auth.ts` |
| P8 | `docker-compose.yml` mempublikasikan Postgres 5432 ke semua antarmuka, memakai `image: ...:latest` milik upstream, dan entri `environment` tak terkutip (YAML menguraikannya sebagai map sehingga compose gagal). | Port DB tidak dipublikasikan, port web terikat 127.0.0.1, image wajib lewat `QBIZ_IMAGE` (digest), entri dikutip. | `docker-compose.yml` |
| P9 | Base image `denoland/deno:debian` mengambang. CI upstream mendorong `:latest` dari `main`. | Base image dikunci ke digest (`debian-2.9.8@sha256:a0d88a7f...`). Workflow upstream dihapus; `build-image.yml` baru, semua action dikunci ke SHA, dipicu manual atau tag `employr-v*`. `node_modules/` dan `.github/` masuk `.dockerignore`. | `Dockerfile`, `.github/`, `.dockerignore` |
| P10 | Ekstensi berkas logo diambil dari nama unggahan (`x.png/../../y` dapat keluar dari folder uploads). | `safeImageExt()` membatasi ekstensi. | `main.tsx` |

## Tes

- `deno task test`: 56 tes lulus (termasuk 11 tes validator QRIS dan 3 tes regresi patch di `src/utils/api.test.ts`).
- `src/utils/api.test.ts` tidak lagi memakai API key seed publik; kunci uji dibuat acak.
- Uji kotak hitam pada image hasil build (lihat `docs/rules/qbiz-integration.md` di repo Employr): akun demo ditolak, admin dari env bisa masuk, merchant tanpa/dengan QRIS rusak ditolak 400, invoice sah menghasilkan `qris_payload`, reconcile anonim 401 dan tidak mengubah status, `/docs` 404.

## Cara menjalankan tes lokal (tanpa Deno terpasang)

```
docker run --rm --network <net> -e DATABASE_URL=... -e COOKIE_SECRET=... -e JWT_SECRET=... \
  -v <path-fork>:/app -w /app denoland/deno:debian-2.9.8@sha256:a0d88a7fcbd44f062cba2748e19df67d30290ad12aa203c7c1e0b12462c483f0 task test
```

Perlu Postgres di jaringan yang sama dan `deno task db:migrate` sekali sebelumnya.

## Cara menaikkan versi upstream

1. `git fetch upstream --tags`, baca diff lengkap tag baru (bukan hanya changelog).
2. Cabang baru `employr/vX.Y.Z` dari tag itu, terapkan ulang patch ini (`git cherry-pick` atau manual).
3. Jalankan tes, build image lewat CI sendiri, uji di sandbox, baru ganti digest di server.
