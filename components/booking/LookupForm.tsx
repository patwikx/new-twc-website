"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { Search, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-error";
import { lookupBooking, type LookupResult } from "@/actions/booking-lookup";
import type { BookingDetails } from "@/lib/booking/lookup";

/**
 * Validation schema for booking lookup form
 * Requirements: 1.1, 1.5
 */
const LookupSchema = z.object({
  shortRef: z.string().min(1, {
    message: "Reference number is required",
  }),
  email: z.string().email({
    message: "Valid email address is required",
  }),
});

type LookupFormValues = z.infer<typeof LookupSchema>;

interface LookupFormProps {
  /** Callback when booking is successfully found */
  onSuccess?: (booking: BookingDetails) => void;
  /** Message to display (e.g., for expired token redirect) */
  message?: string;
}

/**
 * LookupForm Component
 * 
 * Client component for guest booking lookup with reference and email inputs.
 * Includes form validation, loading state, and error display.
 * 
 * Requirements: 1.1, 1.5
 */
export function LookupForm({ onSuccess, message }: LookupFormProps) {
  const [error, setError] = useState<string | undefined>("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<LookupFormValues>({
    resolver: zodResolver(LookupSchema),
    defaultValues: {
      shortRef: "",
      email: "",
    },
  });

  const onSubmit = (values: LookupFormValues) => {
    setError("");

    startTransition(async () => {
      const result: LookupResult = await lookupBooking(
        values.shortRef,
        values.email
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.booking && onSuccess) {
        onSuccess(result.booking);
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-serif text-white mb-2">Look Up Your Booking</h1>
        <p className="text-neutral-400 text-sm">
          Enter your booking reference and email to view your reservation details.
        </p>
      </div>

      {message && (
        <div className="bg-amber-500/15 p-3 rounded-md mb-6 text-sm text-amber-500">
          {message}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="shortRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">
                  Booking Reference
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isPending}
                    placeholder="TWC-ABC123"
                    className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors placeholder:text-neutral-600"
                  />
                </FormControl>
                <FormMessage className="font-light" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isPending}
                    placeholder="juandelacruz@example.com"
                    type="email"
                    className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors placeholder:text-neutral-600"
                  />
                </FormControl>
                <FormMessage className="font-light" />
              </FormItem>
            )}
          />

          <FormError message={error} />

          <Button
            disabled={isPending}
            type="submit"
            className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500 font-normal gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Find My Booking
              </>
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-neutral-500 text-xs mt-6">
        Your booking reference can be found in your confirmation email.
      </p>
    </div>
  );
}
