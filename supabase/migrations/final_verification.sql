-- Check grants on user_notifications
SELECT 'GRANTS' as section;
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'user_notifications';

-- Check fixture_id type
SELECT 'TYPE' as section;
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'fixture_id';

-- Check admin profiles
SELECT 'ADMINS' as section;
SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;

-- Check trigger
SELECT 'TRIGGER' as section;
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'validate_profile_update_trigger';

-- Check indexes
SELECT 'INDEXES' as section;
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
