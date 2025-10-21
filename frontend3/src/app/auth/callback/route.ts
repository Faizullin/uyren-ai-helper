import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Create or sync user in backend database
 * This ensures the user exists in the backend after email verification
 * Matches backend User model: id (UUID), email, hashed_password, full_name, is_active, is_superuser
 */
async function syncUserToBackend(supabase: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return
    }
    // Check if user already exists in backend database
    const { data: existingUser } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingUser) {
      // User already exists, no need to sync
      return
    }

    // Create user in backend database matching the backend User model
    const now = new Date().toISOString()
    const { error: insertError } = await supabase.from('user').insert({
      id: user.id, // Use Supabase Auth UUID as backend user ID
      email: user.email,
      hashed_password: 'managed-by-supabase-auth', // Password managed by Supabase Auth
      full_name: user.user_metadata?.full_name || null,
      is_active: true,
      is_superuser: false,
      created_at: now,
      updated_at: now,
    })

    if (insertError) {
      // Ignore duplicate key errors (user already exists)
      if (!insertError.message.includes('duplicate') && !insertError.message.includes('already exists')) {
        console.error('Failed to sync user to backend:', insertError)
      }
    }
  } catch (error) {
    console.error('Error syncing user to backend:', error)
    // Don't fail the callback if backend sync fails
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('returnUrl') || searchParams.get('redirect') || '/dashboard'

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.error('Auth callback error:', error, errorDescription)
    return NextResponse.redirect(`${baseUrl}/auth?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createClient()

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Error exchanging code for session:', error)
        return NextResponse.redirect(`${baseUrl}/auth?error=${encodeURIComponent(error.message)}`)
      }

      // Sync user to backend database after successful email verification
      await syncUserToBackend(supabase)

      return NextResponse.redirect(`${baseUrl}${next}`)
    } catch (error) {
      console.error('Unexpected error in auth callback:', error)
      return NextResponse.redirect(`${baseUrl}/auth?error=unexpected_error`)
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth`)
}

