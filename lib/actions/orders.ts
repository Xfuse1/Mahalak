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

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      *,
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

  if (!orders || orders.length === 0) {
    return []
  }

  const customerIds = [...new Set(orders.map((order:any) => order.customer_id))]

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", customerIds)

  if (profilesError) {
    console.error("[v0] Error fetching profiles:", profilesError)
  }


  const ordersWithProfiles = orders.map((order: any) => {
    //const profile = profiles?.find((profile: any) => profile.id ==='41e20adb-7e07-47c1-bc1a-ccb913ef0dbe');
    const profile = profiles?.find((profile: any) => profile.id === order.customer_id);
    // Log the customer ID and profile information
    return {
      ...order,
      profiles: profile || null,
    };
  });

  return ordersWithProfiles
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

export async function createContactInquiry(inquiryData: {
  customer_id: string
  product_id: string
  store_id: string
  price: number
  contact_method: "whatsapp" | "call"
}) {
  const supabase = await createServerClient()

  // Create order with contact method as delivery address
  const deliveryAddress = inquiryData.contact_method === "whatsapp" ? "Contact via WhatsApp" : "Contact via Phone"

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: inquiryData.customer_id,
      store_id: inquiryData.store_id,
      total: inquiryData.price,
      delivery_address: deliveryAddress,
      status: "pending",
    })
    .select()
    .single()

  if (orderError) {
    console.error("[v0] Error creating contact inquiry:", orderError)
    return { success: false, error: orderError.message }
  }

  // Create order item
  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: inquiryData.product_id,
    quantity: 1,
    price: inquiryData.price,
  })

  if (itemError) {
    console.error("[v0] Error creating order item:", itemError)
    return { success: false, error: itemError.message }
  }

  revalidatePath("/account")
  revalidatePath("/seller/orders")
  return { success: true, data: order }
}
