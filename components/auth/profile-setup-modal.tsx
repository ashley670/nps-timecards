'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const profileSetupSchema = z.object({
  streetAddress: z
    .string()
    .min(3, 'Street address is required')
    .max(100, 'Address is too long'),
  city: z
    .string()
    .min(2, 'City is required')
    .max(60, 'City name is too long'),
  state: z
    .string()
    .length(2, 'Please enter a 2-letter state abbreviation (e.g. CT)')
    .regex(/^[A-Za-z]{2}$/, 'State must be 2 letters'),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code (e.g. 06360)'),
})

type ProfileSetupValues = z.infer<typeof profileSetupSchema>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProfileSetupModalProps {
  /** Called after the address has been successfully saved. */
  onComplete?: () => void
}

export function ProfileSetupModal({ onComplete }: ProfileSetupModalProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm<ProfileSetupValues>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
    },
  })

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form

  async function onSubmit(values: ProfileSetupValues) {
    setServerError(null)
    try {
      const res = await fetch('/api/profile/address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          street_address: values.streetAddress,
          city: values.city,
          state: values.state.toUpperCase(),
          zip_code: values.zipCode,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(body?.error ?? 'Failed to save your address. Please try again.')
        return
      }

      onComplete ? onComplete() : window.location.reload()
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    }
  }

  return (
    <Dialog
      open
      // Prevent dismissal — onOpenChange intentionally not wired
    >
      <DialogContent
        className="sm:max-w-md"
        // Remove the default close button behaviour: do not allow dismiss
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide the "×" close button by overriding the child slot
      >
        <DialogHeader>
          <DialogTitle>Complete your profile</DialogTitle>
          <DialogDescription>
            We need your home address to include on your timecards. This is a
            one-time setup — you can update it later in your profile settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Street Address */}
            <FormField
              control={form.control}
              name="streetAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City */}
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Norwich" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* State + ZIP — side by side */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="CT"
                        maxLength={2}
                        className="uppercase"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="06360" maxLength={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Server-side error */}
            {serverError && (
              <p className="text-sm font-medium text-destructive">{serverError}</p>
            )}

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" className="text-primary-foreground" />
                    Saving…
                  </span>
                ) : (
                  'Save and continue'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
