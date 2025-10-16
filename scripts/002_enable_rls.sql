-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Stores policies
CREATE POLICY "Anyone can view stores"
  ON public.stores FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Sellers can insert their own stores"
  ON public.stores FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own stores"
  ON public.stores FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own stores"
  ON public.stores FOR DELETE
  USING (auth.uid() = seller_id);

-- Products policies
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Sellers can insert products for their stores"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update products for their stores"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete products for their stores"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

-- Orders policies
CREATE POLICY "Customers can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Sellers can view orders for their stores"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Sellers can update orders for their stores"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

-- Order items policies
CREATE POLICY "Users can view order items for their orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id AND orders.customer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.orders
      JOIN public.stores ON orders.store_id = stores.id
      WHERE orders.id = order_id AND stores.seller_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id AND orders.customer_id = auth.uid()
    )
  );

-- Reviews policies
CREATE POLICY "Anyone can view reviews"
  ON public.reviews FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Customers can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = customer_id);

-- Offers policies
CREATE POLICY "Anyone can view offers"
  ON public.offers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Sellers can create offers for their stores"
  ON public.offers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update offers for their stores"
  ON public.offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete offers for their stores"
  ON public.offers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_id AND stores.seller_id = auth.uid()
    )
  );
