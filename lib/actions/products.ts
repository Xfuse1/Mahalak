"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getProducts(category?: string) {
  const supabase = await createServerClient()

  let query = supabase
    .from("products")
    .select(
      `
      *,
      stores (
        id,
        name,
        category
      )
    `,
    )
    .order("rating", { ascending: false })

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error fetching products:", error)
    return []
  }

  return data || []
}

export async function getProduct(id: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      stores (
        id,
        name,
        category,
        phone,
        address
      )
    `,
    )
    .eq("id", id)
    .single()

  if (error) {
    console.error("[v0] Error fetching product:", error)
    return null
  }

  return data
}

export async function createProduct(formData: {
  name: string
  description: string
  price: number
  category: string
  stock: number
  image_url?: string
  store_id: string
}) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.from("products").insert(formData).select().single()

  if (error) {
    console.error("[v0] Error creating product:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/products")
  return { success: true, data }
}

export async function updateProduct(
  id: string,
  formData: Partial<{
    name: string
    description: string
    price: number
    category: string
    stock: number
    image_url: string
    rating: number
  }>,
) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("products")
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating product:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/products")
  revalidatePath(`/product/${id}`)
  return { success: true, data }
}

export async function deleteProduct(id: string) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting product:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/products")
  return { success: true }
}

export async function getProductsByStoreId(storeId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("rating", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching products by store:", error)
    return []
  }

  return data || []
}

export async function searchProducts(query: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      stores (
        id,
        name,
        category
      )
    `,
    )
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order("rating", { ascending: false })

  if (error) {
    console.error("[v0] Error searching products:", error)
    return []
  }

  // Also filter by store name on the client side since we can't do it in the query
  const filtered = data?.filter(
    (product) =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.description.toLowerCase().includes(query.toLowerCase()) ||
      (product.stores && product.stores.name.toLowerCase().includes(query.toLowerCase())),
  )

  return filtered || []
}

export async function getRelatedProducts(productId: string, category: string, limit = 4) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      stores (
        id,
        name
      )
    `,
    )
    .eq("category", category)
    .neq("id", productId)
    .limit(limit)
    .order("rating", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching related products:", error)
    return []
  }

  return data || []
}
