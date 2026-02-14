import { getFirestoreClient } from "./client"
import { collection, getDocs, query, where } from "firebase/firestore"

export interface SubcategoryItem {
  id: string
  name: string
}

/**
 * Fetch subcategories for a store from Firestore.
 * Goes to categories collection, finds the doc matching the store's category name,
 * then reads its "subcategories" subcollection.
 */
export async function fetchStoreSubcategories(storeCategory: string): Promise<SubcategoryItem[]> {
  if (!storeCategory) return []

  try {
    const db = getFirestoreClient()

    // Find the category document that matches the store's category name
    const categoriesRef = collection(db, "categories")
    const q = query(categoriesRef, where("name", "==", storeCategory))
    const categorySnapshot = await getDocs(q)

    if (categorySnapshot.empty) {
      console.warn(`[categories] No category found for: ${storeCategory}`)
      return []
    }

    // Get the first matching category document
    const categoryDoc = categorySnapshot.docs[0]

    // Fetch subcategories subcollection
    const subcategoriesRef = collection(db, "categories", categoryDoc.id, "subcategories")
    const subcategoriesSnapshot = await getDocs(subcategoriesRef)

    const subcategories: SubcategoryItem[] = subcategoriesSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        name: (doc.data().name as string) || "",
      }))
      .filter((sub) => sub.name) // Filter out any without name

    // Always add "أخرى" (Other) option at the end
    subcategories.push({ id: "other", name: "أخرى" })

    return subcategories
  } catch (err) {
    console.error("[categories] Error fetching subcategories:", err)
    return [{ id: "other", name: "أخرى" }]
  }
}
