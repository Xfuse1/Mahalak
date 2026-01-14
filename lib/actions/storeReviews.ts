"use server"

import { createServerClient } from "@/lib/supabase/server"
import { updateStore } from "./stores"

export async function getUserStoreReview(storeId: string, customerId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("store_reviews")
    .select("*")
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .maybeSingle()

  if (error) {
    console.error("[v0] Error fetching user store review:", error)
    return null
  }

  return data
}

export async function upsertStoreReview(storeId: string, customerId: string, rating: number, comment?: string) {
  const supabase = await createServerClient()
  const r = Math.max(1, Math.min(5, Math.round(rating)))

  try {
    const { data: existing } = await supabase
      .from("store_reviews")
      .select("id")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .maybeSingle()

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("store_reviews")
        .update({ rating: r, comment })
        .eq("id", existing.id)

      if (updateErr) throw updateErr
    } else {
      const { error: insertErr } = await supabase.from("store_reviews").insert({
        store_id: storeId,
        customer_id: customerId,
        rating: r,
        comment,
      })

      if (insertErr) throw insertErr
    }

    // Recompute average rating for the store (Ideally this should be a DB trigger)
    const { data: rows, error: rowsErr } = await supabase
      .from("store_reviews")
      .select("rating")
      .eq("store_id", storeId)

    if (rowsErr) throw rowsErr

    const ratings = (rows || []).map((row: any) => Number(row.rating) || 0)
    const avg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0

    await updateStore(storeId, { rating: avg })
    return { average: avg }
  } catch (error) {
    console.error("[storeReviews] upsertStoreReview error:", error)
    return { average: null }
  }
}
