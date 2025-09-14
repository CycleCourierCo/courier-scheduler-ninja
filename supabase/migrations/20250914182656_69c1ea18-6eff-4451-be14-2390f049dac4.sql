-- Try using crypto.digest instead or check available crypto functions
SELECT 
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_catalog.pg_proc p
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname LIKE '%digest%' OR p.proname LIKE '%sha%' OR p.proname LIKE '%hash%'
  AND n.nspname NOT IN ('information_schema')
ORDER BY p.proname;