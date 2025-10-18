"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getStores(category?: string) {
  const supabase = await createServerClient()

  let query = supabase.from("stores").select("*").order("created_at", { ascending: false })

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error fetching stores:", error)
    return []
  }

  return data || []
}

export async function getStore(id: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.from("stores").select("*").eq("id", id).single()

  if (error) {
    console.error("[v0] Error fetching store:", error)
    return null
  }

  return data
}

export async function getStoreByUserId(userId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.from("stores").select("*").eq("seller_id", userId).single()

  if (error) {
    console.error("[v0] Error fetching user store:", error)
    return null
  }

  return data
}

export async function updateStore(
  id: string,
  formData: Partial<{
    name: string
    description: string
    address: string
    phone: string
    image_url: string
    category: string
  }>,
) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("stores")
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating store:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/settings")
  revalidatePath(/store/${id})
  return { success: true, data }
}

export async function searchStores(query: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .ilike("name", %${query}%)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error searching stores:", error)
    return []
  }

  return data || []
}
