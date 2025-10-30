"use server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Get a specific user's review for a product (or null).
 */
export async function getUserReview(productId: string, customerId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.warn("[reviews] getUserReview error:", error);
    return null;
  }

  return data ?? null;
}

/**
 * Upsert a user's rating for a product.
 * DB trigger keeps products.rating as the AVG (to 1 decimal) and products.rating_count in sync.
 */
export async function upsertReview(
  productId: string,
  customerId: string,
  rating: number
) {
  const supabase = await createServerClient();

  // Clamp + round to the 1..5 scale
  const r = Math.max(1, Math.min(5, Math.round(rating)));

  // Check if a review already exists for (product, customer)
  const { data: existing, error: findErr } = await supabase
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (findErr) {
    console.error("[reviews] find existing error:", findErr);
    return { success: false };
  }

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("reviews")
      .update({ rating: r })
      .eq("id", existing.id);

    if (updErr) {
      console.error("[reviews] update review error:", updErr);
      return { success: false };
    }
  } else {
    const { error: insErr } = await supabase.from("reviews").insert({
      product_id: productId,
      customer_id: customerId,
      rating: r,
    });

    if (insErr) {
      console.error("[reviews] insert review error:", insErr);
      return { success: false };
    }
  }

  // The DB trigger has recomputed products.rating and products.rating_count.
  // Fetch fresh values for optimistic UI updates.
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .select("rating, rating_count")
    .eq("id", productId)
    .maybeSingle();

  if (prodErr) {
    console.warn("[reviews] fetch product after upsert error:", prodErr);
  }

  return {
    success: true,
    average: prod?.rating ?? null,   // numeric(3,1) AVG set by trigger
    count: prod?.rating_count ?? 0,  // total reviews set by trigger
  };
}

/**
 * (Optional) Get the current average rating & count for a product.
 */
export async function getProductRating(productId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("rating, rating_count")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    console.warn("[reviews] getProductRating error:", error);
    return { rating: null, rating_count: 0 };
  }

  return { rating: data?.rating ?? null, rating_count: data?.rating_count ?? 0 };
}
