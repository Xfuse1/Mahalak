"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getCustomerOrders(customerId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      stores (
        id,
        name
      ),
      order_items (
        *,
        products (
          id,
          name,
          image_url
        )
      )
    `,
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching customer orders:", error)
    return []
  }

  return data || []
}

export async function getStoreOrders(storeId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      profiles (
        id,
        full_name,
        email,
        phone
      ),
      order_items (
        *,
        products (
          id,
          name,
          image_url
        )
      )
    `,
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching store orders:", error)
    return []
  }

  return data || []
}

export async function updateOrderStatus(orderId: string, status: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating order status:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/seller/orders")
  revalidatePath("/account")
  return { success: true, data }
}

export async function createOrder(orderData: {
  customer_id: string
  store_id: string
  total: number
  delivery_address: string
  items: { product_id: string; quantity: number; price: number }[]
}) {
  const supabase = await createServerClient()

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: orderData.customer_id,
      store_id: orderData.store_id,
      total: orderData.total,
      delivery_address: orderData.delivery_address,
      status: "pending",
    })
    .select()
    .single()

  if (orderError) {
    console.error("[v0] Error creating order:", orderError)
    return { success: false, error: orderError.message }
  }

  // Create order items
  const orderItems = orderData.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
  }))

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

  if (itemsError) {
    console.error("[v0] Error creating order items:", itemsError)
    return { success: false, error: itemsError.message }
  }

  revalidatePath("/account")
  return { success: true, data: order }
}
