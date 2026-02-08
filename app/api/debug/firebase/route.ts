import { NextResponse } from "next/server"

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {}
  }

  // Check 1: Environment variables presence (not values for security)
  diagnostics.checks.envVars = {
    FIREBASE_ADMIN_PROJECT_ID: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    FIREBASE_ADMIN_PRIVATE_KEY_LENGTH: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length || 0,
    FIREBASE_ADMIN_PRIVATE_KEY_STARTS_WITH: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.substring(0, 30) || "NOT SET",
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  // Check 2: Private key format
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  if (privateKey) {
    diagnostics.checks.privateKeyFormat = {
      hasBeginMarker: privateKey.includes("-----BEGIN PRIVATE KEY-----"),
      hasEndMarker: privateKey.includes("-----END PRIVATE KEY-----"),
      hasLiteralNewlines: privateKey.includes("\\n"),
      hasRealNewlines: privateKey.includes("\n"),
      startsWithQuote: privateKey.startsWith('"'),
      endsWithQuote: privateKey.endsWith('"'),
    }
  }

  // Check 3: Try to initialize Firebase Admin
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin")
    const db = getAdminDb()
    diagnostics.checks.firebaseAdmin = {
      initialized: true,
      dbType: typeof db,
    }

    // Check 4: Try a simple Firestore operation
    try {
      const testDoc = await db.collection("_test").doc("_ping").get()
      diagnostics.checks.firestoreConnection = {
        success: true,
        docExists: testDoc.exists,
      }
    } catch (firestoreError: any) {
      diagnostics.checks.firestoreConnection = {
        success: false,
        error: firestoreError.message,
        code: firestoreError.code,
      }
    }
  } catch (adminError: any) {
    diagnostics.checks.firebaseAdmin = {
      initialized: false,
      error: adminError.message,
      stack: adminError.stack?.substring(0, 500),
    }
  }

  // Check 5: Try to initialize Supabase
  try {
    const { createAdminClient } = await import("@/lib/supabase/server")
    const supabase = await createAdminClient()
    diagnostics.checks.supabase = {
      initialized: true,
    }

    // Check storage bucket
    try {
      const { data, error } = await supabase.storage.getBucket("product-images")
      diagnostics.checks.supabaseStorage = {
        bucketExists: !!data,
        error: error?.message || null,
      }
    } catch (storageError: any) {
      diagnostics.checks.supabaseStorage = {
        bucketExists: false,
        error: storageError.message,
      }
    }
  } catch (supabaseError: any) {
    diagnostics.checks.supabase = {
      initialized: false,
      error: supabaseError.message,
    }
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
