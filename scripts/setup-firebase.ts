/**
 * Firebase Setup Script
 * Creates all required collections with sample/placeholder documents
 * Run with: npx ts-node scripts/setup-firebase.ts
 * Or: pnpm run setup:firebase
 */

import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

// Initialize Firebase Admin
function initAdmin() {
  if (getApps().length) {
    return getApps()[0]
  }

  // Try to load from service account JSON file first
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    console.log("📁 Using service account JSON file:", serviceAccountPath)
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }

  // Fallback to environment variables
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n")
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1)
    }
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Missing Firebase Admin credentials!")
    console.error("Required: GOOGLE_APPLICATION_CREDENTIALS (service account JSON path)")
    console.error("Or: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY")
    process.exit(1)
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  })
}

const app = initAdmin()
const db = getFirestore(app)

// Collection definitions with their structure
const collections = {
  // المستخدمون والملفات الشخصية
  profiles: {
    description: "ملفات المستخدمين الشخصية",
    sampleDoc: {
      _placeholder: true,
      email: "placeholder@example.com",
      name: "Placeholder User",
      role: "customer",
      created_at: FieldValue.serverTimestamp(),
    }
  },

  users: {
    description: "بيانات المستخدمين الإضافية",
    sampleDoc: {
      _placeholder: true,
      email: "placeholder@example.com",
      created_at: FieldValue.serverTimestamp(),
    }
  },

  admins: {
    description: "مديري النظام",
    sampleDoc: {
      _placeholder: true,
      email: "admin@example.com",
      role: "admin",
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // المتاجر
  stores: {
    description: "المتاجر",
    sampleDoc: {
      _placeholder: true,
      name: "Sample Store",
      name_en: "Sample Store",
      category: "grocery",
      rating: 0,
      seller_id: "placeholder",
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // المنتجات
  products: {
    description: "المنتجات",
    sampleDoc: {
      _placeholder: true,
      name: "Sample Product",
      name_en: "Sample Product",
      price: 0,
      store_id: "placeholder",
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // الطلبات
  orders: {
    description: "الطلبات",
    sampleDoc: {
      _placeholder: true,
      customer_id: "placeholder",
      store_id: "placeholder",
      status: "pending",
      total: 0,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  order_items: {
    description: "عناصر الطلبات",
    sampleDoc: {
      _placeholder: true,
      order_id: "placeholder",
      product_id: "placeholder",
      quantity: 1,
      price: 0,
    }
  },

  // العروض
  offers: {
    description: "العروض والخصومات",
    sampleDoc: {
      _placeholder: true,
      store_id: "placeholder",
      discount_percentage: 0,
      is_active: false,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // التقييمات
  reviews: {
    description: "تقييمات المنتجات",
    sampleDoc: {
      _placeholder: true,
      product_id: "placeholder",
      customer_id: "placeholder",
      rating: 5,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  store_reviews: {
    description: "تقييمات المتاجر",
    sampleDoc: {
      _placeholder: true,
      store_id: "placeholder",
      customer_id: "placeholder",
      rating: 5,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  order_reviews: {
    description: "تقييمات الطلبات (سائق + منتجات)",
    sampleDoc: {
      _placeholder: true,
      order_id: "placeholder",
      customer_id: "placeholder",
      driver_rating: 5,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // الإشعارات
  notifications: {
    description: "الإشعارات",
    sampleDoc: {
      _placeholder: true,
      user_id: "placeholder",
      title: "Welcome!",
      message: "Welcome to our platform",
      type: "general",
      is_read: false,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // السائقين وشركات التوصيل
  drivers: {
    description: "السائقين",
    sampleDoc: {
      _placeholder: true,
      name: "Sample Driver",
      phone: "+20000000000",
      rating: 5,
      total_deliveries: 0,
      is_available: true,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  delivery_companies: {
    description: "شركات التوصيل",
    sampleDoc: {
      _placeholder: true,
      name: "Sample Delivery Company",
      is_active: true,
      created_at: FieldValue.serverTimestamp(),
    }
  },

  // الإعدادات
  settings: {
    description: "إعدادات النظام",
    sampleDoc: {
      _placeholder: true,
      key: "app_settings",
      value: {},
      updated_at: FieldValue.serverTimestamp(),
    }
  },

  // تخطيط السوبرماركت 3D
  supermarket_layouts: {
    description: "تخطيطات السوبرماركت ثلاثية الأبعاد",
    sampleDoc: {
      _placeholder: true,
      store_id: "placeholder",
      layout_data: {},
      created_at: FieldValue.serverTimestamp(),
    }
  },
}

async function setupCollections() {
  console.log("🚀 Starting Firebase Collections Setup...\n")

  const results = {
    created: [] as string[],
    existed: [] as string[],
    errors: [] as string[],
  }

  for (const [collectionName, config] of Object.entries(collections)) {
    try {
      // Check if collection has any documents
      const snapshot = await db.collection(collectionName).limit(1).get()

      if (snapshot.empty) {
        // Create placeholder document
        const docRef = await db.collection(collectionName).add(config.sampleDoc)
        console.log(`✅ Created: ${collectionName} (${config.description})`)
        console.log(`   📄 Placeholder doc ID: ${docRef.id}`)
        results.created.push(collectionName)
      } else {
        console.log(`⏭️  Exists: ${collectionName} (${config.description})`)
        results.existed.push(collectionName)
      }
    } catch (error: any) {
      console.error(`❌ Error: ${collectionName} - ${error.message}`)
      results.errors.push(collectionName)
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log("📊 Setup Summary:")
  console.log("=".repeat(50))
  console.log(`✅ Created: ${results.created.length} collections`)
  console.log(`⏭️  Existed: ${results.existed.length} collections`)
  console.log(`❌ Errors:  ${results.errors.length} collections`)

  if (results.created.length > 0) {
    console.log("\n📝 New Collections:")
    results.created.forEach(c => console.log(`   - ${c}`))
  }

  if (results.errors.length > 0) {
    console.log("\n⚠️  Failed Collections:")
    results.errors.forEach(c => console.log(`   - ${c}`))
  }

  console.log("\n✨ Setup complete!")
  console.log("💡 Note: Placeholder documents have _placeholder: true")
  console.log("   You can delete them after adding real data.\n")
}

async function cleanupPlaceholders() {
  console.log("🧹 Cleaning up placeholder documents...\n")

  let deleted = 0

  for (const collectionName of Object.keys(collections)) {
    try {
      const snapshot = await db
        .collection(collectionName)
        .where("_placeholder", "==", true)
        .get()

      for (const doc of snapshot.docs) {
        await doc.ref.delete()
        deleted++
        console.log(`🗑️  Deleted placeholder from: ${collectionName}`)
      }
    } catch (error: any) {
      // Ignore errors for collections that don't exist
    }
  }

  console.log(`\n✨ Cleanup complete! Deleted ${deleted} placeholder documents.`)
}

// Main execution
const args = process.argv.slice(2)

if (args.includes("--cleanup")) {
  cleanupPlaceholders()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
} else {
  setupCollections()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
