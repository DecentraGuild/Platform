-- Ensure discord_role_conditions has payload column (fix when 012 never applied or rolled back).
-- Idempotent: safe to run even if 012 already ran.

-- 1. Add column if missing
ALTER TABLE discord_role_conditions
  ADD COLUMN IF NOT EXISTS payload JSONB;

-- 2. Backfill from legacy columns (only when payload is null and legacy columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_role_conditions' AND column_name = 'mint_or_group'
  ) THEN
    UPDATE discord_role_conditions
    SET payload = jsonb_build_object(
      'mint', mint_or_group,
      'threshold_raw', COALESCE((threshold::bigint)::int, 1)
    )
    WHERE type = 'SPL' AND (payload IS NULL OR payload = '{}'::jsonb);

    UPDATE discord_role_conditions
    SET payload = jsonb_build_object('collection_or_mint', COALESCE(mint_or_group, ''))
    WHERE type = 'NFT' AND (payload IS NULL OR payload = '{}'::jsonb);

    UPDATE discord_role_conditions
    SET payload = jsonb_build_object(
      'collection_or_mint', COALESCE(mint_or_group, ''),
      'trait_key', COALESCE(trait_key, ''),
      'trait_value', COALESCE(trait_value, '')
    )
    WHERE type = 'TRAIT' AND (payload IS NULL OR payload = '{}'::jsonb);
  END IF;
END $$;

-- 3. Fill any remaining nulls
UPDATE discord_role_conditions SET payload = '{}'::jsonb WHERE payload IS NULL;

-- 4. Enforce NOT NULL and default (skip if already set)
ALTER TABLE discord_role_conditions
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
UPDATE discord_role_conditions SET payload = '{}'::jsonb WHERE payload IS NULL;
ALTER TABLE discord_role_conditions
  ALTER COLUMN payload SET NOT NULL;

-- 5. Drop legacy columns if they exist
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS mint_or_group;
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS threshold;
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS trait_key;
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS trait_value;

-- 6. Replace type check with one that includes DISCORD (drop by finding actual constraint name)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'discord_role_conditions'::regclass
      AND c.contype = 'c'
      AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE discord_role_conditions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE discord_role_conditions
  ADD CONSTRAINT discord_role_conditions_type_check
  CHECK (type IN ('SPL', 'NFT', 'TRAIT', 'DISCORD'));
