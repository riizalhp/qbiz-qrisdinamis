// [EMPLOYR PATCH P1] Skrip seed demo upstream dinonaktifkan.
// Isinya membuat akun dengan kata sandi publik ("admin123"), API key publik, dan merchant tiruan.
// Akun admin pertama dibuat otomatis saat boot dari INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD (lihat main.tsx).
console.error("[Seed] db/seed.ts dinonaktifkan di fork Employr. Gunakan INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD.");
Deno.exit(1);
