import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  searchParams: { message?: string }
}

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  domain: {
    title: 'Access Denied',
    description:
      'Access is restricted to @norwichpublicschools.org accounts. Please sign in with your district Google account.',
  },
  exchange_failed: {
    title: 'Authentication Failed',
    description:
      'We could not complete the sign-in process. The login link may have expired. Please try signing in again.',
  },
  no_code: {
    title: 'Invalid Sign-In Link',
    description:
      'This sign-in link is invalid or has already been used. Please return to the login page and try again.',
  },
}

const FALLBACK_ERROR = {
  title: 'Something Went Wrong',
  description:
    'An unexpected error occurred during sign-in. Please try again. If the problem persists, contact your district IT administrator.',
}

export const metadata = {
  title: 'Sign In Error | NPS Timesheet Management',
}

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const messageKey = searchParams.message ?? ''
  const error = ERROR_MESSAGES[messageKey] ?? FALLBACK_ERROR

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white text-2xl font-bold shadow-md">
            NPS
          </div>
          <h1 className="text-xl font-bold text-blue-700 tracking-tight">
            Norwich Public Schools
          </h1>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4 text-center">
            {/* Red warning icon */}
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>

            <CardTitle className="text-xl font-bold text-foreground">
              {error.title}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground leading-relaxed">
              {error.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/auth/login">Return to Sign In</Link>
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Norwich Public Schools. All rights reserved.
        </p>
      </div>
    </main>
  )
}
