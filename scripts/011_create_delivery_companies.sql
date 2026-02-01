-- Create delivery companies table
CREATE TABLE IF NOT EXISTS public.delivery_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  logo_url TEXT,
  rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  estimated_days_min INTEGER DEFAULT 1,
  estimated_days_max INTEGER DEFAULT 3,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active companies
CREATE INDEX IF NOT EXISTS idx_delivery_companies_active ON public.delivery_companies(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_companies_rating ON public.delivery_companies(rating DESC);

-- Insert default delivery companies
INSERT INTO public.delivery_companies (name, name_en, description, description_en, rating, review_count, estimated_days_min, estimated_days_max, price, is_active)
VALUES 
  ('شحن سريع', 'Fast Shipping', 'توصيل سريع خلال يوم أو يومين', 'Fast delivery within 1-2 days', 4.8, 1250, 1, 2, 45, true),
  ('أرامكس', 'Aramex', 'شركة شحن عالمية موثوقة', 'Trusted global shipping company', 4.5, 3200, 2, 3, 35, true),
  ('فيديكس', 'FedEx', 'خدمة توصيل دولية ومحلية', 'International and local delivery service', 4.3, 2100, 2, 4, 40, true),
  ('بوسطة', 'Bosta', 'شحن محلي بأسعار مناسبة', 'Local shipping at affordable prices', 4.2, 890, 2, 3, 30, true),
  ('توصيل اقتصادي', 'Economy Delivery', 'أرخص خيار للتوصيل', 'Cheapest delivery option', 3.9, 560, 3, 5, 20, true)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.delivery_companies ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read delivery companies
CREATE POLICY "Anyone can view active delivery companies"
  ON public.delivery_companies FOR SELECT
  USING (is_active = true);
