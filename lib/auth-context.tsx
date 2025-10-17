"use client"

import { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { User as SupabaseUser, Session, AuthChangeEvent } from "@supabase/supabase-js"

interface User {
  id: string
  email: string
  name: string
  role: "customer" | "seller"
  phone?: string
}

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  login: (email: string, password: string, role: "customer" | "seller") => Promise<boolean>
  register: (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: { phone?: string; storeName?: string; address?: string; storeType?: string },
  ) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const loadingProfile = useRef(false)

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  )

  type ProfileRow = {
    id: string
    email: string | null
    full_name: string | null
    role: "customer" | "seller"
    phone: string | null
  }

  const upsertProfile = async (profileData: ProfileRow) => {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id" })
      .select("*")
      .maybeSingle<ProfileRow>()

    if (error) {
      console.error("[v0] Error creating user profile:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return null
    }

    return data ?? null
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        setSupabaseUser(session.user)
        loadUserProfile(session.user.id)
      } else {
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setSupabaseUser(session.user)
        if (!loadingProfile.current) {
          loadUserProfile(session.user.id)
        }
      } else {
        setSupabaseUser(null)
        setUser(null)
        setIsLoading(false)
        loadingProfile.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (userId: string) => {
    if (loadingProfile.current) return
    loadingProfile.current = true

    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle<ProfileRow>()

      if (error) {
        console.error("[v0] Error loading user profile:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
      }

      let profile = profileData

      if (!profile) {
        const { data: userResult } = await supabase.auth.getUser()
        const currentUser = userResult?.user

        if (currentUser) {
          const metadataRole = currentUser.user_metadata?.role
          const fallbackRole = metadataRole === "seller" ? "seller" : "customer"
          const fallbackProfile = await upsertProfile({
            id: currentUser.id,
            email: currentUser.email ?? null,
            full_name:
              (typeof currentUser.user_metadata?.full_name === "string"
                ? (currentUser.user_metadata.full_name as string)
                : currentUser.email?.split("@")[0]) ?? "",
            role: fallbackRole,
            phone: (typeof currentUser.user_metadata?.phone === "string"
              ? (currentUser.user_metadata.phone as string)
              : null),
          })

          profile = fallbackProfile ?? null
        }
      }

      if (profile) {
        const profileEmail = profile.email ?? supabaseUser?.email ?? ""
        const resolvedRole = profile.role === "seller" ? "seller" : "customer"

        setUser({
          id: profile.id,
          email: profileEmail,
          name: profile.full_name || profileEmail.split("@")[0] || "",
          role: resolvedRole,
          phone: profile.phone ?? undefined,
        })
      } else {
        setUser(null)
      }
    } catch (error: any) {
      console.error("[v0] Error loading user profile:", error)
    } finally {
      setIsLoading(false)
      loadingProfile.current = false
    }
  }

  const login = async (email: string, password: string, role: "customer" | "seller"): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("[v0] Login error:", error)
        // Handle specific error cases
        if (error.message.includes("Email not confirmed")) {
          throw new Error("Email not confirmed")
        }
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Invalid login credentials")
        }
        throw new Error(error.message)
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle()

        if (profileError) {
          console.error("[v0] Error fetching profile:", profileError)
        }

        if (profile?.role !== role) {
          await supabase.auth.signOut()
          throw new Error("Invalid role for this account type")
        }

        return true
      }

      return false
    } catch (error: any) {
      throw error
    }
  }

  const register = async (
    email: string,
    password: string,
    name: string,
    role: "customer" | "seller",
    sellerData?: { phone?: string; storeName?: string; address?: string; storeType?: string },
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role,
            phone: sellerData?.phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("[v0] Registration error:", error)
        throw error
      }

      const userId = data.user?.id ?? null
      
      // If email confirmation is required, user won't have a session
      if (!data.session && data.user) {
        // Return true to indicate successful registration
        // The user will need to check their email
        return true
      }

      // If we have a session, email confirmation is disabled
      const profilePayload = userId
        ? {
            id: userId,
            email,
            full_name: name,
            role,
            phone: sellerData?.phone ?? null,
          }
        : null

      let profileRecord = profilePayload ? await upsertProfile(profilePayload) : null
      let hasSession = !!data.session

      if (!hasSession && data.user) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          console.error("[v0] Auto sign-in after registration failed:", signInError.message)
        } else {
          hasSession = !!signInData.session
        }
      }

      if (!profileRecord && hasSession && profilePayload) {
        profileRecord = await upsertProfile(profilePayload)
      }

      if (role === "seller" && userId && hasSession && sellerData?.storeName) {
        const { error: storeError } = await supabase.from("stores").insert({
          seller_id: userId,
          name: sellerData.storeName,
          address: sellerData.address,
          phone: sellerData.phone,
          category: sellerData.storeType || "other",
        })

        if (storeError) {
          console.error("[v0] Error creating store record:", {
            message: storeError.message,
            details: storeError.details,
            hint: storeError.hint,
            code: storeError.code,
          })
        }
      }

      return true
    } catch (error: any) {
      console.error("[v0] Registration failed:", error)
      throw error
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

