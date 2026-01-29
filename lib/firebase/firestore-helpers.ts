import type { DocumentSnapshot } from "firebase-admin/firestore"

export function cleanUndefined<T extends Record<string, any>>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>
}

export function mapDoc<T>(doc: DocumentSnapshot) {
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as object) } as T
}

export function chunkArray<T>(items: T[], size = 10) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
