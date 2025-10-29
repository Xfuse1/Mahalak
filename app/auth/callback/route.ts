import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = await createClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get the user to determine redirect
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check user role from metadata
        const role = user.user_metadata?.role
        const redirectTo = role === 'seller' ? '/seller/dashboard' : '/'
        
        return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
      }
      
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // If there's an error or no code, redirect to auth page
  return NextResponse.redirect(new URL('/auth?error=confirmation_failed', requestUrl.origin))
}
