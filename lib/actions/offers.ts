"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { cleanUndefined } from "../firebase/firestore-helpers"

type OfferRecord = Record<string, any>

export async function getStoreOffers(storeId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("offers").where("store_id", "==", storeId).get()
  const offers = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as OfferRecord) }))

  offers.sort((a: OfferRecord, b: OfferRecord) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
  return offers
}

export async function createOffer(formData: {
  store_id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
  product_id?: string
  category?: string
  quantity?: number
}) {
  const db = getAdminDb()
  const docRef = db.collection("offers").doc()
  const payload = {
    ...formData,
    created_at: new Date().toISOString(),
  }

  try {
    await docRef.set(payload)
  } catch (error: any) {
    console.error("[v0] Error creating offer:", error)
    return { success: false, error: error?.message || "Failed to create offer" }
  }

  revalidatePath("/seller/offers")
  return { success: true, data: { id: docRef.id, ...payload } }
}

export async function updateOffer(
  id: string,
  formData: Partial<{
    title: string
    description: string
    discount_percentage: number
    start_date: string
    end_date: string
    product_id?: string
    category?: string
    quantity?: number
  }>,
) {
  const db = getAdminDb()
  const docRef = db.collection("offers").doc(id)

  try {
    await docRef.set(cleanUndefined(formData), { merge: true })
  } catch (error: any) {
    console.error("[v0] Error updating offer:", error)
    return { success: false, error: error?.message || "Failed to update offer" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Offer not found" }
  }

  revalidatePath("/seller/offers")
  return { success: true, data: { id: updatedSnap.id, ...(updatedSnap.data() as OfferRecord) } }
}

export async function deleteOffer(id: string) {
  const db = getAdminDb()

  try {
    await db.collection("offers").doc(id).delete()
  } catch (error: any) {
    console.error("[v0] Error deleting offer:", error)
    return { success: false, error: error?.message || "Failed to delete offer" }
  }

  revalidatePath("/seller/offers")
  return { success: true }
}

// Get all active offers (for displaying discounts on products)
export async function getActiveOffers(): Promise<OfferRecord[]> {
  const db = getAdminDb()
  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]
  
  try {
    const snapshot = await db.collection("offers").get()
    const allOffers: OfferRecord[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    
    const offers = allOffers.filter((offer: OfferRecord) => {
      // Check if offer is active (between start and end date)
      const startDate = String(offer.start_date || "").split("T")[0]
      const endDate = String(offer.end_date || "").split("T")[0]
      return startDate <= todayStr && endDate >= todayStr
    })
    
    return offers
  } catch (error) {
    console.error("[v0] Error fetching active offers:", error)
    return []
  }
}

// Get active offer for a specific product
export async function getProductOffer(productId: string): Promise<OfferRecord | null> {
  const db = getAdminDb()
  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]
  
  try {
    // First check for product-specific offers
    const productSnapshot = await db.collection("offers")
      .where("product_id", "==", productId)
      .get()
    
    const allOffers: OfferRecord[] = productSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    
    const productOffers = allOffers.filter((offer: OfferRecord) => {
      const startDate = String(offer.start_date || "").split("T")[0]
      const endDate = String(offer.end_date || "").split("T")[0]
      return startDate <= todayStr && endDate >= todayStr
    })
    
    if (productOffers.length > 0) {
      // Return the highest discount
      return productOffers.reduce((max: OfferRecord, offer: OfferRecord) => 
        (Number(offer.discount_percentage) || 0) > (Number(max.discount_percentage) || 0) ? offer : max
      )
    }
    
    return null
  } catch (error) {
    console.error("[v0] Error fetching product offer:", error)
    return null
  }
}

// Get active offers map for multiple products (more efficient)
export async function getProductOffersMap(productIds: string[]): Promise<Record<string, { discount_percentage: number; title: string }>> {
  if (!productIds.length) return {}
  
  const db = getAdminDb()
  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]
  
  try {
    const snapshot = await db.collection("offers").get()
    const allOffers: OfferRecord[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    
    const activeOffers = allOffers.filter((offer: OfferRecord) => {
      const startDate = String(offer.start_date || "").split("T")[0]
      const endDate = String(offer.end_date || "").split("T")[0]
      return startDate <= todayStr && endDate >= todayStr
    })
    
    const offersMap: Record<string, { discount_percentage: number; title: string }> = {}
    
    for (const offer of activeOffers) {
      if (offer.product_id && productIds.includes(String(offer.product_id))) {
        // Product-specific offer
        const existing = offersMap[String(offer.product_id)]
        if (!existing || (Number(offer.discount_percentage) || 0) > existing.discount_percentage) {
          offersMap[String(offer.product_id)] = {
            discount_percentage: Number(offer.discount_percentage) || 0,
            title: String(offer.title) || ""
          }
        }
      }
    }
    
    return offersMap
  } catch (error) {
    console.error("[v0] Error fetching product offers map:", error)
    return {}
  }
}
