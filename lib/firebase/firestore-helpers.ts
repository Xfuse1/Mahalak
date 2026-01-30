import type { DocumentSnapshot } from "firebase-admin/firestore"

export function cleanUndefined<T extends Record<string, any>>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>
}

export function mapDoc<T>(doc: DocumentSnapshot) {
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as object) } as T
}

export function serializeData<T>(data: T): T {
  if (data === null || data === undefined) return data

  // Handle Firestore Timestamp
  if (typeof data === 'object' && 'seconds' in data && '_nanoseconds' in data) {
    return new Date((data as any).seconds * 1000).toISOString() as any
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeData(item)) as any
  }

  if (typeof data === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeData(value)
    }
    return result as T
  }

  return data
}

export function chunkArray<T>(items: T[], size = 10) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
