"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getStoreOffers(storeId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching offers:", error)
    return []
  }

  return data || []
}

export async function createOffer(formData: {
  store_id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
}) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.from("offers").insert(formData).select().single()

  if (error) {
    console.error("[v0] Error creating offer:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/offers")
  return { success: true, data }
}

export async function updateOffer(
  id: string,
  formData: Partial<{
    title: string
    description: string
    discount_percentage: number
    start_date: string
    end_date: string
  }>,
) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.from("offers").update(formData).eq("id", id).select().single()

  if (error) {
    console.error("[v0] Error updating offer:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/offers")
  return { success: true, data }
}

export async function deleteOffer(id: string) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("offers").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting offer:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/offers")
  return { success: true }
}
