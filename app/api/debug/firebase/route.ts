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
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_LENGTH: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    SUPABASE_SERVICE_ROLE_KEY_STARTS_WITH: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || "NOT SET",
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

    // List all buckets
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      diagnostics.checks.supabaseBuckets = {
        success: !listError,
        buckets: buckets?.map(b => ({ id: b.id, name: b.name, public: b.public })) || [],
        error: listError?.message || null,
      }
    } catch (listBucketsError: any) {
      diagnostics.checks.supabaseBuckets = {
        success: false,
        error: listBucketsError.message,
      }
    }

    // Check storage bucket
    try {
      const { data, error } = await supabase.storage.getBucket("product-images")
      diagnostics.checks.supabaseStorage = {
        bucketExists: !!data,
        bucketData: data ? { id: data.id, name: data.name, public: data.public } : null,
        error: error?.message || null,
      }
    } catch (storageError: any) {
      diagnostics.checks.supabaseStorage = {
        bucketExists: false,
        error: storageError.message,
      }
    }

    // Try to list files in bucket
    try {
      const { data: files, error: filesError } = await supabase.storage
        .from("product-images")
        .list("", { limit: 1 })
      diagnostics.checks.supabaseListFiles = {
        success: !filesError,
        fileCount: files?.length || 0,
        error: filesError?.message || null,
      }
    } catch (filesError: any) {
      diagnostics.checks.supabaseListFiles = {
        success: false,
        error: filesError.message,
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
