-- Add additional fields to stores table for working hours and customer service

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS open_time TIME,
ADD COLUMN IF NOT EXISTS close_time TIME,
ADD COLUMN IF NOT EXISTS working_days TEXT,
ADD COLUMN IF NOT EXISTS support_email TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS return_policy TEXT;

-- Add comment to document the new fields
COMMENT ON COLUMN stores.open_time IS 'Store opening time';
COMMENT ON COLUMN stores.close_time IS 'Store closing time';
COMMENT ON COLUMN stores.working_days IS 'Working days description (e.g., Saturday - Thursday)';
COMMENT ON COLUMN stores.support_email IS 'Customer support email address';
COMMENT ON COLUMN stores.whatsapp_number IS 'WhatsApp contact number';
COMMENT ON COLUMN stores.return_policy IS 'Store return policy description';
