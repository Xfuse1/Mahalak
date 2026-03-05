import { getFirestoreClient } from "./client"
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore"

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

/**
 * Fetch subcategories by searching category names that include any of the given keywords.
 * Useful when the store's category field is "other" or doesn't match any real category.
 */
export async function fetchSubcategoriesByKeywords(keywords: string[]): Promise<SubcategoryItem[]> {
  if (!keywords.length) return []

  try {
    const db = getFirestoreClient()
    const categoriesRef = collection(db, "categories")
    const allCatsSnapshot = await getDocs(categoriesRef)

    // Find first category whose name includes any of the keywords
    const matchedDoc = allCatsSnapshot.docs.find((d) => {
      const catName = ((d.data().name as string) || "").toLowerCase()
      return keywords.some((kw) => catName.includes(kw.toLowerCase()))
    })

    if (!matchedDoc) return [{ id: "other", name: "أخرى" }]

    // Fetch subcategories from the matched category
    const subcategoriesRef = collection(db, "categories", matchedDoc.id, "subcategories")
    const subcategoriesSnapshot = await getDocs(subcategoriesRef)

    const subcategories: SubcategoryItem[] = subcategoriesSnapshot.docs
      .map((d) => ({
        id: d.id,
        name: (d.data().name as string) || "",
      }))
      .filter((sub) => sub.name)

    subcategories.push({ id: "other", name: "أخرى" })
    return subcategories
  } catch (err) {
    console.error("[categories] Error fetching subcategories by keywords:", err)
    return [{ id: "other", name: "أخرى" }]
  }
}

/**
 * Fetch subcategories directly by category document ID.
 */
export async function fetchSubcategoriesByCategoryId(categoryId: string): Promise<SubcategoryItem[]> {
  if (!categoryId) return []

  try {
    const db = getFirestoreClient()

    // Verify the category exists
    const catDoc = await getDoc(doc(db, "categories", categoryId))
    if (!catDoc.exists()) return [{ id: "other", name: "أخرى" }]

    const subcategoriesRef = collection(db, "categories", categoryId, "subcategories")
    const subcategoriesSnapshot = await getDocs(subcategoriesRef)

    const subcategories: SubcategoryItem[] = subcategoriesSnapshot.docs
      .map((d) => ({
        id: d.id,
        name: (d.data().name as string) || "",
      }))
      .filter((sub) => sub.name)

    subcategories.push({ id: "other", name: "أخرى" })
    return subcategories
  } catch (err) {
    console.error("[categories] Error fetching subcategories by ID:", err)
    return [{ id: "other", name: "أخرى" }]
  }
}
