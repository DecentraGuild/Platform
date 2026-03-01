-- Allow 'registration' payment type for one-time dGuild creation fee.
DO $$
BEGIN
  ALTER TABLE billing_payments DROP CONSTRAINT IF EXISTS billing_payments_payment_type_check;
  ALTER TABLE billing_payments ADD CONSTRAINT billing_payments_payment_type_check
    CHECK (payment_type IN ('initial', 'upgrade_prorate', 'renewal', 'extend', 'registration'));
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Constraint already exists from prior run
END $$;
