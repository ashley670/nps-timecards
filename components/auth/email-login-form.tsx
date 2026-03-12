'use client'

import * as React from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

interface EmailLoginFormProps {
  error?: string
  message?: string
}

export function EmailLoginForm({ error, message }: EmailLoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(error ?? null)
  const [formMessage, setFormMessage] = React.useState<string | null>(message ?? null)
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormMessage(null)
    setLoading(true)

    if (mode === 'signup') {
      // Create account then upsert profile
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: email.split('@')[0] },
        },
      })

      if (signUpError) {
        setFormError(signUpError.message)
        setLoading(false)
        return
      }

      // Upsert into users table via our API
      if (data.user) {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            full_name: email.split('@')[0],
          }),
        })
      }

      setFormMessage('Account created! You can now sign in.')
      setMode('signin')
      setLoading(false)
      return
    }

    // Sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setFormError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      )}
      {formMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {formMessage}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@norwichpublicschools.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          minLength={6}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
          </span>
        ) : mode === 'signup' ? (
          'Create Account'
        ) : (
          'Sign In'
        )}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        {mode === 'signin' ? (
          <>
            No account yet?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setFormError(null); setFormMessage(null) }}
              className="text-blue-600 hover:underline font-medium"
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('signin'); setFormError(null); setFormMessage(null) }}
              className="text-blue-600 hover:underline font-medium"
            >
              Sign in
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground pt-2 border-t">
        Use any email for sandbox testing.<br />
        Production is restricted to <strong>@norwichpublicschools.org</strong>
      </p>
    </form>
  )
}
