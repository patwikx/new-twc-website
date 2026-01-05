"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CompletePaymentButtonProps {
  bookingId: string;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  verificationToken?: string;
}

export function CompletePaymentButton({ bookingId, className, variant = "default", verificationToken }: CompletePaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
       console.error("Payment initiation error:", error);
       toast.error("Failed to initiate payment. Please try again or contact support.");
       setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePayment} 
      disabled={isLoading} 
      variant={variant}
      className={cn("uppercase tracking-widest text-xs gap-2 rounded-none", className)}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Processing...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4" /> Complete Payment
        </>
      )}
    </Button>
  );
}
