import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

function initAdminApp() {
  if (getApps().length) {
    return getApps()[0]
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (privateKey) {
    // Replace literal \n with real newline characters
    privateKey = privateKey.replace(/\\n/g, "\n")

    // Remove wrapping quotes if they exist
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1)
    }
  }

  if (clientEmail && privateKey) {
    try {
      console.log("[v0] Initializing Firebase Admin with JSON cert")
      return initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      })
    } catch (error) {
      console.error("[v0] Firebase Admin initialization error (cert):", error)
    }
  }

  try {
    console.log("[v0] Initializing Firebase Admin with applicationDefault")
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    })
  } catch (error) {
    console.error("[v0] Firebase Admin initialization error (default):", error)
    // Return a dummy app or throw a more specific error if needed
    throw error
  }
}

export function getAdminDb() {
  try {
    return getFirestore(initAdminApp())
  } catch (error) {
    console.error("[v0] Error getting Firestore instance:", error)
    throw error
  }
}

export function getAdminAuth() {
  return getAuth(initAdminApp())
}
