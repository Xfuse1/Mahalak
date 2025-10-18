"use server"

import { createServerClient } from "@/lib/supabase/server"

export async function getDashboardAnalytics(storeId: string) {
  const supabase = await createServerClient()

  // Get total products
  const { count: totalProducts } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)

  // Get total orders and revenue
  const { data: orders } = await supabase.from("orders").select("total, status").eq("store_id", storeId)

  const totalOrders = orders?.length || 0
  const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0

  // Get low stock products (stock < 10)
  const { count: lowStockProducts } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .lt("stock", 10)

  // Get top selling product
  const { data: orderItems } = await supabase
    .from("order_items")
    .select(
      `
      product_id,
      quantity,
      products (
        id,
        name,
        store_id
      )
    `,
    )
    .eq("products.store_id", storeId)

  // Calculate top product by quantity sold
  const productSales: Record<string, { name: string; quantity: number }> = {}
  orderItems?.forEach((item: any) => {
    if (item.products && item.products.store_id === storeId) {
      const productId = item.product_id
      if (!productSales[productId]) {
        productSales[productId] = { name: item.products.name, quantity: 0 }
      }
      productSales[productId].quantity += item.quantity
    }
  })

  const topProduct = Object.values(productSales).sort((a, b) => b.quantity - a.quantity)[0] || {
    name: "لا يوجد",
    quantity: 0,
  }

  // Get reviews for store products
  const { data: storeProducts } = await supabase.from("products").select("id").eq("store_id", storeId)

  const productIds = storeProducts?.map((p) => p.id) || []

  let averageRating = 0
  let totalReviews = 0

  if (productIds.length > 0) {
    const { data: reviews } = await supabase.from("reviews").select("rating").in("product_id", productIds)

    totalReviews = reviews?.length || 0
    if (totalReviews > 0) {
      const sumRatings = reviews?.reduce((sum, review) => sum + (review.rating || 0), 0) || 0
      averageRating = sumRatings / totalReviews
    }
  }

  // For messages, we'll use reviews count as a proxy since there's no messages table
  const totalMessages = totalReviews

  return {
    totalRevenue,
    totalOrders,
    totalProducts: totalProducts || 0,
    totalMessages,
    topProduct: topProduct.name,
    topProductSales: topProduct.quantity,
    lowStockProducts: lowStockProducts || 0,
    averageRating: Number(averageRating.toFixed(1)),
    totalReviews,
  }
}

export async function getRecentOrders(storeId: string, limit = 3) {
  const supabase = await createServerClient()

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `
      id,
      total,
      status,
      created_at,
      profiles (
        full_name
      )
    `,
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (
    orders?.map((order: any) => ({
      id: order.id.substring(0, 8).toUpperCase(),
      customer: order.profiles?.full_name || "عميل",
      total: Number(order.total || 0),
      status: order.status || "pending",
      date: new Date(order.created_at).toLocaleDateString("en-CA"),
    })) || []
  )
}
