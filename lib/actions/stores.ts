"use server"

import { createServerClient, createAdminClient } from "@/lib/supabase/server"
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

export async function createStore(storeData: {
  seller_id: string
  name: string
  address: string
  phone: string
  category: string
  description?: string
}) {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from("stores")
    .insert({
      seller_id: storeData.seller_id,
      name: storeData.name,
      address: storeData.address,
      phone: storeData.phone,
      category: storeData.category,
      description: storeData.description || "",
      rating: 0,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating store:", error)
    return { success: false, error: error.message }
  }

  console.log("[v0] Store created successfully:", data)
  return { success: true, data }
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
    open_time: string
    close_time: string
    working_days: string
    support_email: string
    whatsapp_number: string
    return_policy: string
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
  revalidatePath(`/store/${id}`)
  return { success: true, data }
}

export async function searchStores(query: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error searching stores:", error)
    return []
  }

  return data || []
}
