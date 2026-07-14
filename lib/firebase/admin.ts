import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { getMessaging } from "firebase-admin/messaging"

function getMissingFirebaseAdminEnv() {
  const missing: string[] = []

  if (!process.env.FIREBASE_ADMIN_PROJECT_ID && !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    missing.push("FIREBASE_ADMIN_PROJECT_ID")
  }
  if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
    missing.push("FIREBASE_ADMIN_CLIENT_EMAIL")
  }
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    missing.push("FIREBASE_ADMIN_PRIVATE_KEY")
  }

  return missing
}

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
      return initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      })
    } catch (error) {
      console.error("[v0] Firebase Admin initialization error (cert):", error)
    }
  }

  try {
    const missing = getMissingFirebaseAdminEnv()
    if (missing.length) {
      console.error(`[auth/admin] Missing Firebase Admin env vars: ${missing.join(", ")}`)
    }

    return initializeApp({
      credential: applicationDefault(),
      projectId,
    })
  } catch (error) {
    console.error("[v0] Firebase Admin initialization error (default):", error)
    throw error
  }
}

export function getAdminDb() {
  return getFirestore(initAdminApp())
}

export function getAdminAuth() {
  return getAuth(initAdminApp())
}

export function getAdminMessaging() {
  return getMessaging(initAdminApp())
}
