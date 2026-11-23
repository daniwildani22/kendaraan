/**
 * KendaraTrack - Global Cloud Configuration
 * =========================================================================
 * Mengapa berkas ini penting?
 * Pengaturan di bawah ini menjadi nilai bawaan (default) untuk SELURUH perangkat
 * (HP Android, iPhone, Tablet, Laptop, Komputer).
 * 
 * Dengan mengisi URL dan Key di sini, Anda TIDAK PERLU mengetikkan kembali
 * URL dan API Key secara manual setiap kali membuka aplikasi di HP baru!
 * =========================================================================
 */

window.APP_CONFIG = {
  // Provider aktif: 'SUPABASE' | 'GAS' | 'LOCAL_DEMO'
  // Ubah ke 'SUPABASE' agar aplikasi di HP & Web langsung otomatis terhubung ke Supabase
  DEFAULT_PROVIDER: "SUPABASE",

  // URL Instance Project Supabase Anda
  DEFAULT_SUPABASE_URL: "https://uodgaxtsovdrrnfuohfv.supabase.co",

  // Kunci Anon (Public Key) Supabase Anda
  // (Dapat diambil dari Supabase Dashboard: Project Settings > API > Project API keys > 'anon / public')
  DEFAULT_SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZGdheHRzb3ZkcnJuZnVvaGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MDg3NTMsImV4cCI6MjExMDk4NDc1M30.mk-IbsH5BYWevNvuLg0j3XwBWQJgWWWvf7Ocla1Y4Mc",

  // (Opsional) URL Web App Google Apps Script jika menggunakan Google Spreadsheet
  DEFAULT_GAS_URL: ""
};
