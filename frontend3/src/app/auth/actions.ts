'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !email.includes('@')) {
    return { message: 'Please enter a valid email address' }
  }

  if (!password || password.length < 6) {
    return { message: 'Password must be at least 6 characters' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { message: error.message || 'Could not authenticate user' }
  }

  return { success: true, redirectTo: '/dashboard' }
}

export async function signUp(prevState: any, formData: FormData) {
  const origin = formData.get('origin') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const fullName = formData.get('fullName') as string

  if (!email || !email.includes('@')) {
    return { message: 'Please enter a valid email address' }
  }

  if (!password || password.length < 8) {
    return { message: 'Password must be at least 8 characters' }
  }

  if (password !== confirmPassword) {
    return { message: 'Passwords do not match' }
  }

  const supabase = await createClient()

  // Step 1: Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName || null,
      },
    },
  })

  if (authError) {
    return { message: authError.message || 'Could not create account' }
  }

  // Step 2: Sync user to backend database
  // The auth callback will also sync this after email verification
  // But we try here as well for immediate registration
  if (authData?.user) {
    try {
      // Use Supabase Auth user ID as the backend user ID
      const now = new Date().toISOString()
      await supabase.from('user').insert({
        id: authData.user.id, // Use Supabase Auth UUID
        email: authData.user.email,
        hashed_password: 'managed-by-supabase-auth', // Password managed by Supabase Auth
        full_name: fullName || null,
        is_active: true,
        is_superuser: false,
        created_at: now,
        updated_at: now,
      }).select().single()
    } catch (error: any) {
      console.error('Error syncing user to backend database:', error)
      // Continue with signup - the callback will retry the sync
    }
  }

  return {
    success: true,
    message: 'Check your email to confirm your registration.',
  }
}

export async function forgotPassword(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const origin = formData.get('origin') as string

  if (!email || !email.includes('@')) {
    return { message: 'Please enter a valid email address' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    return { message: error.message || 'Could not send password reset email' }
  }

  return {
    success: true,
    message: 'Check your email for a password reset link',
  }
}

export async function resetPassword(prevState: any, formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 6) {
    return { message: 'Password must be at least 6 characters' }
  }

  if (password !== confirmPassword) {
    return { message: 'Passwords do not match' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { message: error.message || 'Could not update password' }
  }

  return {
    success: true,
    message: 'Password updated successfully',
  }
}

export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return { message: error.message || 'Could not sign out' }
  }

  return redirect('/auth')
}

