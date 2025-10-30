-- Deduplicate existing duplicate reviews (keep the oldest by created_at), then add
-- a unique constraint on (product_id, customer_id) to enforce one review per user per product.

BEGIN;

-- Preview duplicates (run manually first):
-- SELECT product_id, customer_id, COUNT(*) FROM public.reviews GROUP BY product_id, customer_id HAVING COUNT(*) > 1;

-- Delete duplicate rows, keeping the earliest created_at (or lowest id when created_at ties)
WITH duplicates AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY product_id, customer_id ORDER BY created_at ASC, id ASC) AS rn
    FROM public.reviews
  ) t
  WHERE t.rn > 1
)
DELETE FROM public.reviews WHERE id IN (SELECT id FROM duplicates);

-- Add unique constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_customer_unique'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_product_customer_unique UNIQUE (product_id, customer_id);
  END IF;
END$$;

COMMIT;

-- After running this migration, the DB will prevent inserting a second review for the same
-- (product_id, customer_id). The application already performs an upsert-like flow (checks
-- for existing review and updates it), so this constraint enforces it at the DB level as
-- a safety net.
