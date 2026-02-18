"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { cleanUndefined } from "../firebase/firestore-helpers"

type OfferRecord = {
  id: string
  store_id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
  product_id?: string
  category?: string
  quantity?: number
  duration_hours?: number
  created_at: string
  [key: string]: unknown
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }

  return undefined
}

export async function getStoreOffers(storeId: string, callerId?: string) {
  if (callerId && callerId !== storeId) {
    return []
  }
  const db = getAdminDb()
  const snapshot = await db
    .collection("offers")
    .where("store_id", "==", storeId)
    .get()
  const offers: OfferRecord[] = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as OfferRecord))
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
  duration_hours?: number
}, callerId?: string) {
  // التحقق من أن المتصل هو صاحب المتجر
  if (callerId && callerId !== formData.store_id) {
    return { success: false, error: "ليس لديك صلاحية لإنشاء عرض لهذا المتجر" }
  }

  // التحقق من نسبة الخصم
  if (formData.discount_percentage <= 0 || formData.discount_percentage > 100) {
    return { success: false, error: "نسبة الخصم يجب أن تكون بين 1 و 100" }
  }

  // التحقق من التواريخ
  if (formData.end_date < formData.start_date) {
    return { success: false, error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" }
  }

  const db = getAdminDb()
  const docRef = db.collection("offers").doc()
  const payload = {
    ...formData,
    created_at: new Date().toISOString(),
  }

  try {
    await docRef.set(payload)
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) || "Failed to create offer" }
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
    duration_hours?: number
  }>,
  callerId?: string,
) {
  const db = getAdminDb()
  const docRef = db.collection("offers").doc(id)

  if (
    typeof formData.discount_percentage === "number" &&
    (!Number.isFinite(formData.discount_percentage) ||
      formData.discount_percentage <= 0 ||
      formData.discount_percentage > 100)
  ) {
    return { success: false, error: "نسبة الخصم يجب أن تكون بين 1 و 100" }
  }

  // التحقق من الملكية
  if (callerId) {
    const offerDoc = await docRef.get()
    if (!offerDoc.exists) {
      return { success: false, error: "العرض غير موجود" }
    }
    if (offerDoc.data()?.store_id !== callerId) {
      return { success: false, error: "ليس لديك صلاحية لتعديل هذا العرض" }
    }
  }

  try {
    await docRef.set(cleanUndefined(formData), { merge: true })
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) || "Failed to update offer" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Offer not found" }
  }

  revalidatePath("/seller/offers")
  return {
    success: true,
    data: { id: updatedSnap.id, ...(updatedSnap.data() as Record<string, unknown>) } as OfferRecord,
  }
}

export async function deleteOffer(id: string, callerId?: string) {
  const db = getAdminDb()

  try {
    if (callerId) {
      const offerDoc = await db.collection("offers").doc(id).get()
      if (!offerDoc.exists) {
        return { success: false, error: "العرض غير موجود" }
      }
      if (offerDoc.data()?.store_id !== callerId) {
        return { success: false, error: "ليس لديك صلاحية لحذف هذا العرض" }
      }
    }
    await db.collection("offers").doc(id).delete()
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) || "Failed to delete offer" }
  }

  revalidatePath("/seller/offers")
  return { success: true }
}
