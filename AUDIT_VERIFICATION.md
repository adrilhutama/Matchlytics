# Database Audit Verification Guide

## Status: Migration 20261007 Applied ✅

## Langkah Verifikasi (Jalankan di Supabase SQL Editor)

### 1. Verifikasi RLS Policies
```sql
SELECT tablename, policyname, cmd, roles,
  CASE when using is not null then 'YES' else 'NO' end as has_using,
  CASE when with_check is not null then 'YES' else 'NO' end as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected:**
- `profiles` → "Users can update own profile, entitlement columns frozen" → has USING + WITH CHECK
- `user_notifications` → has SELECT policy dengan USING clause
- `admin_audit_log` → "Only admins can read audit log" → filtered by is_admin

### 2. Verifikasi Grants
```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_notifications', 'profiles', 'admin_audit_log')
ORDER BY table_name, grantee;
```

**Expected:**
- `user_notifications`: anon=SELECT, authenticated=SELECT, service_role=INSERT,UPDATE
- `profiles`: authenticated=SELECT, service_role=INSERT,UPDATE

### 3. Verifikasi Type Fix
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('fixtures', 'user_notifications')
  AND column_name IN ('id', 'fixture_id');
```

**Expected:**
- `fixtures.id` → bigint
- `user_notifications.fixture_id` → bigint (bukan uuid!)

### 4. Verifikasi Foreign Key
```sql
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

**Expected:** `user_notifications_fixture_id_fkey` → fixtures(id)

### 5. Verifikasi is_admin Column
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'is_admin';
```

**Expected:** boolean, default false

### 6. Verifikasi Indexes Baru
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_portfolio_user_status_created', 'idx_profiles_created');
```

**Expected:** 2 indexes found

### 7. Verifikasi Redundant Index Dropped
```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_fixtures_match_date', 'idx_fixtures_status');
```

**Expected:** 0 rows (indexes sudah dihapus)

### 8. Set Admin User
```sql
-- Ganti dengan email admin Anda
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your-admin-email@example.com';

-- Verifikasi
SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;
```

## Checklist Keamanan

| Check | Status |
|-------|--------|
| RLS enabled on all tables | ✅ |
| No default grants to anon on write tables | ✅ |
| profiles UPDATE has WITH CHECK clause | ✅ |
| user_notifications has SELECT grant | ✅ |
| fixture_id type matches fixtures.id | ✅ |
| Admin audit log restricted to admins | ✅ |
| Redundant indexes removed | ✅ |
| Composite indexes added | ✅ |

## Troubleshooting

### Jika user_notifications SELECT masih 403:
```sql
-- Cek apakah grant sudah diterapkan
SELECT has_table_privilege('anon', 'user_notifications', 'SELECT');
SELECT has_table_privilege('authenticated', 'user_notifications', 'SELECT');

-- Jika false, jalankan ulang:
grant select on public.user_notifications to anon;
grant select on public.user_notifications to authenticated;
```

### Jika admin audit log tidak bisa dibaca:
```sql
-- Pastikan user punya is_admin = true
SELECT id, email, is_admin FROM public.profiles WHERE email = 'your@email.com';

-- Jika false, update:
UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com';
```
