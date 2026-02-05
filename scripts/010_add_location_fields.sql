-- Add location fields to users table for customer addresses
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'Egypt',
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add location fields to orders table for delivery addresses
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_city TEXT,
ADD COLUMN IF NOT EXISTS delivery_state TEXT,
ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS delivery_company TEXT,
ADD COLUMN IF NOT EXISTS delivery_price DECIMAL(10, 2) DEFAULT 0;

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_location ON public.orders(delivery_latitude, delivery_longitude);

-- Comment on columns for documentation
COMMENT ON COLUMN public.users.latitude IS 'Customer location latitude for delivery';
COMMENT ON COLUMN public.users.longitude IS 'Customer location longitude for delivery';
COMMENT ON COLUMN public.orders.delivery_latitude IS 'Delivery destination latitude';
COMMENT ON COLUMN public.orders.delivery_longitude IS 'Delivery destination longitude';
