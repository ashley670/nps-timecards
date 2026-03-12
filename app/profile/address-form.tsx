'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required').max(255),
  city: z.string().min(1, 'City is required').max(100),
  state: z
    .string()
    .length(2, 'State must be a 2-letter abbreviation')
    .toUpperCase(),
  zip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code (e.g. 06360 or 06360-1234)'),
})

type AddressFormValues = z.infer<typeof addressSchema>

interface AddressFormProps {
  /** Currently stored address string, e.g. "123 Main St, Norwich, CT 06360" */
  currentAddress: string | null
}

/** Parse a simple "street, city, state zip" string into form fields */
function parseAddress(address: string | null): Partial<AddressFormValues> {
  if (!address) return {}
  // Expected format: "123 Main St, Norwich, CT 06360"
  const parts = address.split(',').map((p) => p.trim())
  if (parts.length < 3) return { street: address }
  const stateZip = parts[2].trim().split(/\s+/)
  return {
    street: parts[0],
    city: parts[1],
    state: stateZip[0] ?? '',
    zip: stateZip[1] ?? '',
  }
}

export function AddressForm({ currentAddress }: AddressFormProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: parseAddress(currentAddress),
  })

  async function onSubmit(values: AddressFormValues) {
    setIsSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Failed to update address')
      }

      toast({
        title: 'Address updated',
        description: 'Your address has been saved successfully.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="street">Street Address</Label>
        <Input
          id="street"
          placeholder="123 Main Street"
          {...register('street')}
          aria-describedby={errors.street ? 'street-error' : undefined}
        />
        {errors.street && (
          <p id="street-error" className="text-sm text-destructive">
            {errors.street.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="Norwich"
            {...register('city')}
            aria-describedby={errors.city ? 'city-error' : undefined}
          />
          {errors.city && (
            <p id="city-error" className="text-sm text-destructive">
              {errors.city.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            placeholder="CT"
            maxLength={2}
            className="uppercase"
            {...register('state')}
            aria-describedby={errors.state ? 'state-error' : undefined}
          />
          {errors.state && (
            <p id="state-error" className="text-sm text-destructive">
              {errors.state.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="zip">ZIP Code</Label>
        <Input
          id="zip"
          placeholder="06360"
          {...register('zip')}
          aria-describedby={errors.zip ? 'zip-error' : undefined}
        />
        {errors.zip && (
          <p id="zip-error" className="text-sm text-destructive">
            {errors.zip.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto">
        {isSaving ? 'Saving…' : 'Save Address'}
      </Button>
    </form>
  )
}
