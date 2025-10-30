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

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("store_reviews")
      .select("id")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .maybeSingle()

    if (fetchErr) {
      console.error("[v0] Error checking existing store review:", fetchErr)
    }

    if (existing && existing.id) {
      const { error: updateErr } = await supabase
        .from("store_reviews")
        .update({ rating, comment })
        .eq("id", existing.id)

      if (updateErr) {
        console.error("[v0] Error updating store review:", updateErr)
      }
    } else {
      const { error: insertErr } = await supabase.from("store_reviews").insert({
        store_id: storeId,
        customer_id: customerId,
        rating,
        comment,
      })

      if (insertErr) {
        console.error("[v0] Error inserting store review:", insertErr)
      }
    }

    // Recompute average rating for the store
    const { data: rows, error: rowsErr } = await supabase
      .from("store_reviews")
      .select("rating")
      .eq("store_id", storeId)

    if (rowsErr) {
      console.error("[v0] Error fetching store reviews for average:", rowsErr)
      return { average: null }
    }

    const ratings = (rows || []).map((r: any) => Number(r.rating) || 0)
    const sum = ratings.reduce((a: number, b: number) => a + b, 0)
    const avg = ratings.length > 0 ? Math.round((sum / ratings.length) * 10) / 10 : 0

    // Persist average into stores.rating
    try {
      await updateStore(storeId, { rating: avg })
    } catch (e) {
      console.error("[v0] Error updating store rating:", e)
    }

    return { average: avg }
  } catch (error) {
    console.error("[v0] Unexpected error in upsertStoreReview:", error)
    return { average: null }
  }
}
