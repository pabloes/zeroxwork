-- Migrate all tag names to UPPERCASE.
-- No duplicates exist after normalization (verified before running).
-- If duplicates did exist, this would fail on the unique constraint,
-- which is the safe behavior — run the backfill script instead.
UPDATE tags SET name = UPPER(TRIM(name));
