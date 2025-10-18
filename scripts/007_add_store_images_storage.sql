-- Create storage policies for store images in the product-images bucket
-- We'll use a 'stores' folder within the product-images bucket

-- Policy: Allow authenticated users to upload store images
CREATE POLICY "Authenticated users can upload store images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'stores');

-- Policy: Allow authenticated users to update their store images
CREATE POLICY "Authenticated users can update store images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'stores');

-- Policy: Allow authenticated users to delete their store images
CREATE POLICY "Authenticated users can delete store images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'stores');
