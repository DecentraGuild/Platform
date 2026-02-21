-- Seller fee basis points for royalty display
ALTER TABLE mint_metadata ADD COLUMN IF NOT EXISTS seller_fee_basis_points INTEGER DEFAULT NULL;
