-- Type-first rule engine: single JSONB payload per condition. Refactor from mint_or_group, threshold, trait_key, trait_value.
-- Idempotent: safe when run after 013 (mint_or_group already dropped).

ALTER TABLE discord_role_conditions
  ADD COLUMN IF NOT EXISTS payload JSONB;

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
    SET payload = jsonb_build_object('collection_or_mint', mint_or_group)
    WHERE type = 'NFT' AND (payload IS NULL OR payload = '{}'::jsonb);

    UPDATE discord_role_conditions
    SET payload = jsonb_build_object(
      'collection_or_mint', mint_or_group,
      'trait_key', COALESCE(trait_key, ''),
      'trait_value', COALESCE(trait_value, '')
    )
    WHERE type = 'TRAIT' AND (payload IS NULL OR payload = '{}'::jsonb);

    UPDATE discord_role_conditions SET payload = '{}'::jsonb WHERE payload IS NULL;

    ALTER TABLE discord_role_conditions ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
    ALTER TABLE discord_role_conditions ALTER COLUMN payload SET NOT NULL;
    ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS mint_or_group;
    ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS threshold;
    ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS trait_key;
    ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS trait_value;
  END IF;
END $$;

UPDATE discord_role_conditions SET payload = '{}'::jsonb WHERE payload IS NULL;
ALTER TABLE discord_role_conditions ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
ALTER TABLE discord_role_conditions ALTER COLUMN payload SET NOT NULL;

ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS mint_or_group;
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS threshold;
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS trait_key;
ALTER TABLE discord_role_conditions DROP COLUMN IF EXISTS trait_value;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'discord_role_conditions'::regclass AND c.contype = 'c' AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE discord_role_conditions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE discord_role_conditions
  ADD CONSTRAINT discord_role_conditions_type_check
  CHECK (type IN ('SPL', 'NFT', 'TRAIT', 'DISCORD'));
