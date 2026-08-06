"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react"
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth"
import { doc, getDoc, type Firestore } from "firebase/firestore"
import { useTranslation } from "react-i18next"
import { createStore, uploadStoreImage, updateStore } from "./actions/stores"
import { createSession, destroySession, ensureUserProfile } from "./actions/auth-session"
import { finalizePhoneVerification } from "./actions/profile"
import { getFirebaseAuth, getFirestoreClient } from "./firebase/client"
import { normalizeEgyptPhone } from "./utils/phone"
import { clearBlockedStoresCache } from "./hooks/use-blocked-stores"

interface User {
  id: string
  email: string
  name: string
  // يعكس ما تحمله users/{uid}.role فعلًا. كان الاتحاد "customer" | "seller" فقط بينما
  // حسابات الإدارة تحمل "admin"/"superAdmin"، فيُسنَد الدور الحقيقي وقت التشغيل ويظنّه
  // النوع مستحيلًا — أي فحص `role === "seller" ? A : B` كان يعامل الأدمن كعميل صامتًا.
  role: "customer" | "seller" | "driver" | "admin" | "superAdmin"
  phone?: string
  // optional address fields (some rows use different column names)
  address?: string
  street?: string
  city?: string
  country?: string
  state?: string
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  login: (email: string, password: string, role: "customer" | "seller") => Promise<boolean>
  signInWithGoogle: () => Promise<"customer" | "seller">
  register: (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: {
      phone?: string
      storeName?: string
      storeDescription?: string
      address?: string
      storeType?: string
      storeTypeId?: string
      storeLogo?: File | null
      storeLogoUrl?: string | null
      latitude?: number
      longitude?: number
      ownerIdNumber?: string
      idCardImageUrl?: string | null
      idCardImageBackUrl?: string | null
      commercialRegisterImageUrl?: string | null
      taxCardImageUrl?: string | null
      taxCardImageBackUrl?: string | null
    },
    street?: string,
    city?: string,
    country?: string,
    phone?: string,
    phoneVerified?: boolean,
    phoneIdToken?: string,
  ) => Promise<boolean>
  logout: () => void
  refreshProfile: () => Promise<void>
  isLoading: boolean
  error: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const loadingProfile = useRef(false)
  const { t } = useTranslation()
  const firebaseClients = useMemo(() => {
    try {
      return {
        auth: getFirebaseAuth() as Auth | null,
        db: getFirestoreClient() as Firestore | null,
        error: null as Error | null,
      }
    } catch (error) {
      return {
        auth: null,
        db: null,
        error: error instanceof Error ? error : new Error("Firebase web configuration is missing"),
      }
    }
  }, [])

  const auth = firebaseClients.auth
  const db = firebaseClients.db

  useEffect(() => {
    if (!firebaseClients.error) {
      return
    }

    console.error("[auth/context] Firebase web configuration error:", firebaseClients.error.message)
    setIsLoading(false)
  }, [firebaseClients.error])

  const loadUserProfile = useCallback(async (currentUser: FirebaseUser) => {
    if (!db) {
      setUser(null)
      setIsLoading(false)
      loadingProfile.current = false
      return
    }

    // Force reload if requested or if loading is not in progress
    loadingProfile.current = true
    setIsLoading(true)

    try {
      const profileRef = doc(db, "users", currentUser.uid)
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        const profile = profileSnap.data()

        setUser({
          id: profileSnap.id,
          email: profile.email || currentUser.email || "",
          name:
            profile.full_name ||
            profile.email?.split("@")[0] ||
            currentUser.email?.split("@")[0] ||
            "",
          role: profile.role || "customer",
          phone: profile.phone,
          street: profile.street ?? profile.address_street ?? profile.address ?? undefined,
          city: profile.city ?? profile.address_city ?? undefined,
          state: profile.state ?? profile.address_state ?? undefined,
          country: profile.country ?? undefined,
          address: profile.address ?? undefined,
        })
      } else {
        console.warn("[v0] No profile found for user:", currentUser.uid)
        setUser(null)
      }
    } catch (error) {
      console.error("[v0] Error loading user profile:", error)
    } finally {
      setIsLoading(false)
      loadingProfile.current = false
    }
  }, [db])

  useEffect(() => {
    if (!auth || !db) {
      setFirebaseUser(null)
      setUser(null)
      setIsLoading(false)
      loadingProfile.current = false
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setFirebaseUser(currentUser)
        // إنشاء/تحديث كوكي الجلسة الموثّق ليتمكّن السيرفر من التحقق من الهوية
        try {
          await createSession(await currentUser.getIdToken())
        } catch {
          // فشل إنشاء الجلسة لا يمنع تحميل الملف الشخصي
        }
        await loadUserProfile(currentUser)
      } else {
        setFirebaseUser(null)
        setUser(null)
        setIsLoading(false)
        loadingProfile.current = false
      }
    })

    return () => unsubscribe()
  }, [auth, db, loadUserProfile])

  // FCM web-push: نسجّل للإشعارات بعد تسجيل الدخول. استيراد ديناميكي محروس بمفتاح VAPID —
  // بلا NEXT_PUBLIC_FIREBASE_VAPID_KEY لا تُحمَّل messaging-client (ولا firebase/messaging) إطلاقًا،
  // فيبقى SDK الرسائل خارج حزمة العميل العامة تمامًا.
  useEffect(() => {
    if (!firebaseUser) return
    if (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && firebaseUser) {
      import("./firebase/messaging-client")
        .then((m) => {
          m.registerForPush()
          m.listenForegroundPush()
        })
        .catch(() => {})
    }
  }, [firebaseUser])

  const login = useCallback(async (email: string, password: string, role: "customer" | "seller"): Promise<boolean> => {
    if (!auth || !db) {
      const message = "Firebase auth is not configured"
      setError(t("خدمة تسجيل الدخول غير مهيأة حالياً", "Authentication is not configured right now"))
      throw new Error(message)
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const profileRef = doc(db, "users", credential.user.uid)
      const profileSnap = await getDoc(profileRef)
      const profileData = profileSnap.exists() ? profileSnap.data() : null

      if (profileSnap.exists()) {
        const profileRole = (profileData?.role as "customer" | "seller") || "customer"
        if (profileRole !== role) {
          await signOut(auth)
          throw new Error("Invalid role for this account type")
        }
      }

      // إنشاء كوكي الجلسة (__session) وانتظاره قبل الرجوع — يضمن وجود الكوكي قبل التنقّل لمسار محميّ
      // بالـmiddleware، تفاديًا لإعادة التوجيه لـ/auth بسبب سباق ضبط الكوكي عبر مستمع onAuthStateChanged.
      await createSession(await credential.user.getIdToken())

      if (!profileSnap.exists()) {
        // إنشاء الملف سيرفر-سايد (role مُعقَّم) — لا كتابة role من العميل
        await ensureUserProfile({
          email,
          full_name: credential.user.displayName || email.split("@")[0],
          role,
        })
      }

      // Manually trigger profile load to ensure state is updated immediately
      await loadUserProfile(credential.user)
      return true
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        throw new Error("Invalid login credentials")
      }
      throw error
    }
  }, [auth, db, loadUserProfile, t])

  const signInWithGoogle = useCallback(async (): Promise<"customer" | "seller"> => {
    if (!auth || !db) {
      const message = "Firebase auth is not configured"
      setError(t("خدمة تسجيل الدخول غير مهيأة حالياً", "Authentication is not configured right now"))
      throw new Error(message)
    }

    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: "select_account" })

    try {
      const credential = await signInWithPopup(auth, provider)
      const profileRef = doc(db, "users", credential.user.uid)
      const profileSnap = await getDoc(profileRef)

      // إنشاء كوكي الجلسة (__session) وانتظاره قبل الرجوع — يمنع سباق الـmiddleware (نفس سبب login)
      await createSession(await credential.user.getIdToken())

      if (!profileSnap.exists()) {
        // Create profile server-side (role مُعقَّم إلى customer) — لا كتابة من العميل
        await ensureUserProfile({
          email: credential.user.email || "",
          full_name: credential.user.displayName || credential.user.email?.split("@")[0] || "",
          role: "customer",
        })
      }

      await loadUserProfile(credential.user)

      const profileData = profileSnap.exists() ? profileSnap.data() : null
      return ((profileData?.role as "customer" | "seller" | undefined) || "customer")
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        throw new Error("Google sign-in cancelled")
      }
      throw error
    }
  }, [auth, db, loadUserProfile, t])

  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: {
      phone?: string
      storeName?: string
      storeDescription?: string
      address?: string
      storeType?: string
      storeTypeId?: string
      storeLogo?: File | null
      storeLogoUrl?: string | null
      latitude?: number
      longitude?: number
      ownerIdNumber?: string
      idCardImageUrl?: string | null
      idCardImageBackUrl?: string | null
      commercialRegisterImageUrl?: string | null
      taxCardImageUrl?: string | null
      taxCardImageBackUrl?: string | null
    },
    street?: string,
    city?: string,
    country?: string,
    phone?: string,
    phoneVerified?: boolean,
    phoneIdToken?: string,
  ): Promise<boolean> => {
    if (!auth || !db) {
      const message = "Firebase auth is not configured"
      setError(t("خدمة إنشاء الحساب غير مهيأة حالياً", "Registration is not configured right now"))
      throw new Error(message)
    }

    try {
      if (auth.currentUser) {
        try { await signOut(auth) } catch {}
      }
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      // إنشاء جلسة موثّقة فورًا حتى تنجح أكشنز إنشاء/تحديث المتجر التالية
      try {
        await createSession(await credential.user.getIdToken())
      } catch {}
      const normalizedProfilePhone = sellerData?.phone
        ? normalizeEgyptPhone(sellerData.phone)
        : phone
          ? normalizeEgyptPhone(phone)
          : null

      try {
        await updateFirebaseProfile(credential.user, { displayName: name })
      } catch {
        // ignore profile update errors
      }

      // إنشاء الملف الشخصي سيرفر-سايد (Admin SDK، role مُعقَّم) بدل الكتابة من العميل.
      // phone_verified يُكتب false دائمًا ثم يُرفع سيرفر-سايد عبر finalizePhoneVerification.
      await ensureUserProfile({
        email,
        full_name: name,
        role,
        phone: normalizedProfilePhone,
        street: street ?? null,
        city: city ?? null,
        country: country ?? null,
      })

      // تأكيد التحقق من الهاتف سيرفر-سايد: يضبط phone_verified=true فقط إذا أثبت idToken ملكية الرقم
      if (phoneVerified && phoneIdToken) {
        try {
          await finalizePhoneVerification(phoneIdToken)
        } catch {
          // غير حرج — يبقى phone_verified=false إن فشل التحقق
        }
      }

      if (role === "seller" && credential.user && sellerData?.storeName) {
        const normalizedSellerPhone = sellerData.phone ? normalizeEgyptPhone(sellerData.phone) : null
        const result = await createStore({
          seller_id: credential.user.uid,
          name: sellerData.storeName,
          description: sellerData.storeDescription || "",
          address: sellerData.address || "",
          phone: normalizedSellerPhone || "",
          category: sellerData.storeType || "خدمات أخرى",
          category_id: sellerData.storeTypeId || "",
          latitude: sellerData.latitude,
          longitude: sellerData.longitude,
          whatsapp_number: normalizedSellerPhone || "",
          support_email: email,
          owner_id_number: sellerData.ownerIdNumber || "",
          id_card_image_url: sellerData.idCardImageUrl || undefined,
          id_card_image_back_url: sellerData.idCardImageBackUrl || undefined,
          commercial_register_image_url: sellerData.commercialRegisterImageUrl || undefined,
          tax_card_image_url: sellerData.taxCardImageUrl || undefined,
          tax_card_image_back_url: sellerData.taxCardImageBackUrl || undefined,
        })

        if (!result.success) {
          console.error("[v0] Failed to create store:", result.error)
          await signOut(auth)
          throw new Error("Failed to create store: " + result.error)
        }

        // Use pre-uploaded URL if available, otherwise upload the File
        if (sellerData.storeLogoUrl && result.data) {
          const updateResult = await updateStore(result.data.id, { image_url: sellerData.storeLogoUrl })
          if (!updateResult.success) {
            console.error("[v0] Failed to update store with image URL:", updateResult.error)
          }
        } else if (sellerData.storeLogo && result.data) {
          const storeId = result.data.id
          const formData = new FormData()
          formData.append("file", sellerData.storeLogo)
          formData.append("storeId", storeId)

          const uploadRes = await uploadStoreImage(formData)
          if (uploadRes.success && uploadRes.url) {
            const updateResult = await updateStore(storeId, { image_url: uploadRes.url })
            if (!updateResult.success) {
              console.error("[v0] Failed to update store with image URL:", updateResult.error)
            }
          } else {
            console.error("[v0] Logo upload failed:", uploadRes.error)
          }
        }
      }

      // Manually trigger profile load to ensure state is updated immediately
      await loadUserProfile(credential.user)
      return true
    } catch (error: any) {
      const code = error?.code as string | undefined
      if (code === "auth/email-already-in-use") {
        setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
        throw new Error("already registered")
      }

      console.error("[v0] Registration error:", error)
      setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
      throw error
    }
  }, [auth, db, t, loadUserProfile])

  const logout = useCallback(async () => {
    if (auth) {
      await signOut(auth)
    }
    try {
      await destroySession()
    } catch {
      // تجاهل فشل حذف الجلسة
    }
    // النسخة المحفوظة من المتاجر المحظورة تخصّ المستخدم الخارج — على جهاز مشترك كان المستخدم
    // التالي سيرث حظر غيره حتى يصله رد الخادم.
    clearBlockedStoresCache()
    setUser(null)
    setFirebaseUser(null)
  }, [auth])

  // إعادة تحميل ملف المستخدم من Firestore بعد تعديل البروفايل — router.refresh() وحده لا يحدّث
  // حالة user المحفوظة في السياق (تُضبط فقط عبر مستمع onAuthStateChanged).
  const refreshProfile = useCallback(async () => {
    const current = auth?.currentUser
    if (current) {
      await loadUserProfile(current)
    }
  }, [auth, loadUserProfile])

  const contextValue = useMemo(
    () => ({ user, firebaseUser, login, signInWithGoogle, register, logout, refreshProfile, isLoading, error }),
    [user, firebaseUser, login, signInWithGoogle, register, logout, refreshProfile, isLoading, error],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
