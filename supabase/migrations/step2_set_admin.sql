-- ============================================================
-- STEP 2: Set first admin (RUN BEFORE STEP 3)
-- GANTI EMAIL DI BAWAH INI DENGAN EMAIL ANDA
-- ============================================================
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your-email@example.com';
