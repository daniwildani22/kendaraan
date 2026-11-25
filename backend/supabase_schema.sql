-- =========================================================================
-- KENDARATRACK - SUPABASE POSTGRESQL SCHEMA (Phase 2 Migration)
-- =========================================================================
-- Cara Penggunaan di Supabase:
-- 1. Buat project baru di https://supabase.com
-- 2. Masuk ke menu "SQL Editor" di sidebar kiri.
-- 3. Paste seluruh isi script SQL ini lalu klik tombol "Run" (Ctrl + Enter).
-- 4. Buka Project Settings > API > Ambil Project URL dan anon / public key.
-- 5. Masukkan ke pengaturan aplikasi KendaraTrack di Tab [Analitik & Profil].
-- =========================================================================

-- Aktifkan ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABEL: vehicles (Master Kendaraan)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    brand VARCHAR(100),
    plate_number VARCHAR(20) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('motor', 'mobil', 'lainnya')) DEFAULT 'motor',
    year INT,
    color VARCHAR(50),
    current_odometer NUMERIC(10, 1) DEFAULT 0,
    fuel_tank_capacity NUMERIC(5, 2),
    oil_interval_km INT DEFAULT 3000,
    oil_interval_months INT DEFAULT 2,
    last_oil_odometer NUMERIC(10, 1) DEFAULT 0,
    last_oil_date DATE,
    last_oil_brand VARCHAR(150),
    tax_annual_date DATE,
    tax_5year_date DATE,
    sim_type VARCHAR(20) DEFAULT 'SIM C',
    sim_expiry_date DATE,
    photo_vehicle TEXT,
    photo_sim TEXT,
    photo_stnk TEXT,
    photo_bpkb TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrasi kolom foto jika tabel sudah ada sebelumnya
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photo_vehicle TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photo_sim TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photo_stnk TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photo_bpkb TEXT;

-- 2. TABEL: transactions (Kas Masuk & Keluar)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('pemasukan', 'pengeluaran')) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    odometer NUMERIC(10, 1),
    fuel_liters NUMERIC(6, 2),
    fuel_price_per_liter NUMERIC(10, 2),
    fuel_type VARCHAR(50),
    notes TEXT,
    bengkel_name VARCHAR(150),
    photo_receipt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS photo_receipt TEXT;

-- 3. TABEL: maintenance_logs (Riwayat Ganti Oli, Sparepart, Servis)
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    user_id REFERENCES auth.users(id) ON DELETE CASCADE,
    log_type VARCHAR(20) CHECK (log_type IN ('oli', 'sparepart', 'servis', 'lainnya')) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    part_code VARCHAR(100),
    odometer NUMERIC(10, 1),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    cost NUMERIC(15, 2) DEFAULT 0,
    workshop VARCHAR(150),
    workshop_address TEXT,
    workshop_maps_url TEXT,
    workshop_lat NUMERIC(10, 6),
    workshop_lng NUMERIC(10, 6),
    warranty_lifespan VARCHAR(100),
    photo_part TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS photo_part TEXT;
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS workshop_address TEXT;
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS workshop_maps_url TEXT;
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS workshop_lat NUMERIC(10, 6);
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS workshop_lng NUMERIC(10, 6);

-- 4. TABEL: schedules (Jadwal Pengingat Pajak, SIM, Servis, Cicilan)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    due_date DATE NOT NULL,
    target_odometer NUMERIC(10, 1),
    est_cost NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT TRUE,
    recurring_interval_months INT DEFAULT 12,
    recurring_interval_km INT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL: trips (Riwayat Pelacakan GPS & Rute Armada)
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    purpose VARCHAR(100),
    driver VARCHAR(100),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time VARCHAR(20),
    end_time VARCHAR(20),
    duration_minutes INT DEFAULT 0,
    distance_km NUMERIC(10, 2) DEFAULT 0,
    avg_speed_kmh NUMERIC(6, 1) DEFAULT 0,
    max_speed_kmh NUMERIC(6, 1) DEFAULT 0,
    start_address TEXT,
    end_address TEXT,
    start_lat NUMERIC(10, 6),
    start_lng NUMERIC(10, 6),
    end_lat NUMERIC(10, 6),
    end_lng NUMERIC(10, 6),
    status VARCHAR(20) DEFAULT 'completed',
    visits JSONB DEFAULT '[]'::jsonb,
    path JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vehicle_date ON public.transactions(vehicle_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_date ON public.maintenance_logs(vehicle_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_vehicle_due ON public.schedules(vehicle_id, due_date ASC);
CREATE INDEX IF NOT EXISTS idx_schedules_completed ON public.schedules(is_completed);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_date ON public.trips(vehicle_id, date DESC);

-- AUTO-UPDATE updated_at TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trigger_update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON public.transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - DATA ISOLATION PER USER
-- =========================================================================
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS TO ANON & AUTHENTICATED
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Policy Multi-User: Pengguna hanya dapat membaca dan menulis data miliknya sendiri (user_id = auth.uid())
-- Jika data sampel awal (user_id IS NULL), dapat dilihat bersama sebagai referensi umum.
DROP POLICY IF EXISTS "Multi-user access vehicles" ON public.vehicles;
CREATE POLICY "Multi-user access vehicles" ON public.vehicles 
FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Multi-user access transactions" ON public.transactions;
CREATE POLICY "Multi-user access transactions" ON public.transactions 
FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Multi-user access maintenance" ON public.maintenance_logs;
CREATE POLICY "Multi-user access maintenance" ON public.maintenance_logs 
FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Multi-user access schedules" ON public.schedules;
CREATE POLICY "Multi-user access schedules" ON public.schedules 
FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Multi-user access trips" ON public.trips;
CREATE POLICY "Multi-user access trips" ON public.trips 
FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- SEED DATA (Sampel Data Kendaraan Indonesia)
INSERT INTO public.vehicles (
    id, name, model, brand, plate_number, type, year, color,
    current_odometer, fuel_tank_capacity, oil_interval_km, oil_interval_months,
    last_oil_odometer, last_oil_date, last_oil_brand,
    tax_annual_date, tax_5year_date, sim_type, sim_expiry_date,
    photo_vehicle, photo_sim, photo_stnk, photo_bpkb
) VALUES (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Honda Vario 160 CBS', 'Vario 160', 'Honda', 'L 1234 AB', 'motor', 2023, 'Matte Black',
    14250, 5.5, 3000, 2,
    12000, '2026-09-25', 'AHM Oil MPX2 10W-30 (0.8L)',
    '2026-12-15', '2028-03-10', 'SIM C', '2027-08-14',
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&q=80', '', '', ''
), (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Toyota Avanza 1.5 G CVT', 'Avanza 1.5 G', 'Toyota', 'B 2345 CDE', 'mobil', 2022, 'Silver Metallic',
    42600, 43.0, 10000, 6,
    35000, '2026-06-18', 'Toyota Motor Oil (TMO) 5W-30 Synthetic (4L)',
    '2027-02-18', '2027-02-18', 'SIM A', '2027-08-14',
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&q=80', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transactions (
    id, vehicle_id, type, category, amount, date, odometer,
    fuel_liters, fuel_price_per_liter, fuel_type, notes, bengkel_name
) VALUES 
(
    'b1b2c3d4-0001-4000-8000-000000000101', 'a1b2c3d4-0001-4000-8000-000000000001',
    'pengeluaran', 'bbm', 45000, '2026-11-22', 14250, 3.6, 12500, 'Pertamax (RON 92)',
    'Isi bensin di SPBU Pertamina Merr Rungkut', ''
),
(
    'b1b2c3d4-0002-4000-8000-000000000102', 'a1b2c3d4-0001-4000-8000-000000000001',
    'pemasukan', 'pendapatan', 350000, '2026-11-21', 14190, NULL, NULL, '',
    'Uang transport & dinas operasional kantor', ''
),
(
    'b1b2c3d4-0003-4000-8000-000000000103', 'a1b2c3d4-0001-4000-8000-000000000001',
    'pengeluaran', 'cuci', 25000, '2026-11-20', 14120, NULL, NULL, '',
    'Cuci motor salju + semir ban', 'Snow Wash Barokah'
),
(
    'b1b2c3d4-0004-4000-8000-000000000104', 'a1b2c3d4-0001-4000-8000-000000000001',
    'pengeluaran', 'cicilan', 980000, '2026-11-05', 13850, NULL, NULL, '',
    'Cicilan ke-18 FIF Honda Vario 160', 'FIFGROUP'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.schedules (
    id, vehicle_id, title, category, due_date, target_odometer, est_cost, notes,
    is_recurring, recurring_interval_months, recurring_interval_km, is_completed
) VALUES
(
    'c1b2c3d4-0001-4000-8000-000000000201', 'a1b2c3d4-0001-4000-8000-000000000001',
    'Ganti Oli Mesin Rutin', 'oli', '2026-12-10', 15000, 70000,
    'Interval 3.000 KM (Terakhir ganti pada 12.000 KM)', true, 2, 3000, false
),
(
    'c1b2c3d4-0002-4000-8000-000000000202', 'a1b2c3d4-0001-4000-8000-000000000001',
    'Pajak STNK Tahunan (Samsat)', 'pajak', '2026-12-15', NULL, 365000,
    'PKB + SWDKLLJ Plat L Surabaya Timur', true, 12, NULL, false
),
(
    'c1b2c3d4-0003-4000-8000-000000000203', 'a1b2c3d4-0001-4000-8000-000000000001',
    'Cicilan Bulanan FIF Vario 160', 'cicilan', '2026-12-05', NULL, 980000,
    'Angsuran ke-19 dari 35 bulan', true, 1, NULL, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (
    id, vehicle_id, title, purpose, driver, date, start_time, end_time,
    duration_minutes, distance_km, avg_speed_kmh, max_speed_kmh,
    start_address, end_address, start_lat, start_lng, end_lat, end_lng,
    status, visits, path, notes
) VALUES (
    'd1b2c3d4-0001-4000-8000-000000000301',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Pengiriman Dokumen & Kunjungan Klien', 'dinas', 'Driver Utama',
    '2026-11-23', '08:30', '11:15', 165, 21.4, 31, 54,
    'Kantor Pusat - Jl. Pemuda No. 10, Surabaya', 'Kantor Pusat - Jl. Pemuda No. 10, Surabaya',
    -7.2655, 112.7483, -7.2655, 112.7483,
    'completed',
    '[{"id":"vis-101","place_name":"Toko Sparepart Surya Motor","category":"kunjungan_toko","time":"09:15","address":"Jl. Rungkut Madya No. 45, Surabaya","lat":-7.321,"lng":112.775,"notes":"Serah terima dokumen dan invoice","photo":""},{"id":"vis-102","place_name":"Klien PT Maju Bersama","category":"klien","time":"10:30","address":"Kawasan SIER Rungkut Industri, Surabaya","lat":-7.332,"lng":112.76,"notes":"Meeting progres kerja sama","photo":""}]'::jsonb,
    '[[-7.2655,112.7483],[-7.28,112.755],[-7.301,112.768],[-7.321,112.775],[-7.332,112.76],[-7.31,112.75],[-7.2655,112.7483]]'::jsonb,
    'Rute dinas operasional lancar tanpa hambatan'
) ON CONFLICT (id) DO NOTHING;
