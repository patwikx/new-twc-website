"use client";

import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Users,
  CreditCard,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DownloadReceiptButton } from "@/components/booking/DownloadReceiptButton";
import { 
  getCancellationPolicyDescription, 
  DEFAULT_CANCELLATION_POLICY,
  calculateCancellationFee 
} from "@/lib/booking/cancellation";
import type { BookingDetails } from "@/lib/booking/lookup";

interface BookingDetailsCardProps {
  booking: BookingDetails;
  /** Verification token for guest cancellation (optional) */
  verificationToken?: string;
}

/**
 * Get badge variant and label for booking status
 */
function getStatusBadge(status: string): { variant: "default" | "secondary" | "destructive" | "outline"; label: string } {
  switch (status) {
    case "CONFIRMED":
      return { variant: "default", label: "Confirmed" };
    case "PENDING":
      return { variant: "secondary", label: "Pending" };
    case "CANCELLED":
      return { variant: "destructive", label: "Cancelled" };
    case "COMPLETED":
      return { variant: "outline", label: "Completed" };
    default:
      return { variant: "outline", label: status };
  }
}

/**
 * Get badge variant and label for payment status
 */
function getPaymentBadge(status: string): { variant: "default" | "secondary" | "destructive" | "outline"; label: string } {
  switch (status) {
    case "PAID":
      return { variant: "default", label: "Paid" };
    case "UNPAID":
      return { variant: "secondary", label: "Unpaid" };
    case "PARTIALLY_PAID":
      return { variant: "secondary", label: "Partially Paid" };
    case "REFUNDED":
      return { variant: "outline", label: "Refunded" };
    case "FAILED":
      return { variant: "destructive", label: "Failed" };
    default:
      return { variant: "outline", label: status };
  }
}

/**
 * BookingDetailsCard Component
 * 
 * Displays all booking information including property, room, dates, guests, and amount.
 * Shows booking status with appropriate styling and provides PDF download for CONFIRMED bookings.
 * Supports guest cancellation with verification token.
 * 
 * Requirements: 1.6, 2.1, 2.2, 2.3, 2.4, 10.1
 */
export function BookingDetailsCard({ booking, verificationToken }: BookingDetailsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const statusBadge = getStatusBadge(booking.status);
  const paymentBadge = getPaymentBadge(booking.paymentStatus);

  // Calculate stay details from first booking item
  const firstItem = booking.items[0];
  const checkIn = firstItem ? new Date(firstItem.checkIn) : null;
  const checkOut = firstItem ? new Date(firstItem.checkOut) : null;
  const nights = checkIn && checkOut ? Math.max(1, differenceInDays(checkOut, checkIn)) : 0;
  const totalGuests = booking.items.reduce((sum, item) => sum + item.guests, 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: booking.currency || "PHP",
    }).format(amount);
  };

  // Check if cancellation is allowed (guest with token, booking not cancelled/completed)
  const canCancel = verificationToken && 
    booking.status !== "CANCELLED" && 
    booking.status !== "COMPLETED";

  // Calculate estimated cancellation fee for display
  const cancellationFeeInfo = checkIn 
    ? calculateCancellationFee(
        booking.totalAmount,
        checkIn,
        new Date(),
        DEFAULT_CANCELLATION_POLICY
      )
    : null;

  // Handle guest cancellation via API
  const handleCancelBooking = async () => {
    if (!verificationToken) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/bookings/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingId: booking.id,
            verificationToken,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error || "Failed to cancel booking");
          return;
        }

        toast.success("Booking cancelled successfully. A confirmation email has been sent.");
        setIsDialogOpen(false);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header with Reference and Status */}
      <div className="text-center space-y-4">
        <div>
          <p className="text-neutral-400 text-xs uppercase tracking-widest mb-1">
            Booking Reference
          </p>
          <h1 className="text-3xl font-serif text-white">{booking.shortRef}</h1>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Badge
            variant={statusBadge.variant}
            className="rounded-none uppercase tracking-widest text-xs px-3 py-1"
          >
            {statusBadge.label}
          </Badge>
          <Badge
            variant={paymentBadge.variant}
            className="rounded-none uppercase tracking-widest text-xs px-3 py-1"
          >
            {paymentBadge.label}
          </Badge>
        </div>
      </div>

      {/* Property & Room Details */}
      <Card className="bg-neutral-900 border-white/10 rounded-none">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white font-serif text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-orange-500" />
            Stay Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {booking.property && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">{booking.property.name}</p>
                <p className="text-neutral-400 text-sm">{booking.property.location}</p>
              </div>
            </div>
          )}

          {booking.items.map((item) => (
            <div key={item.id} className="pl-8 space-y-2">
              <p className="text-white">{item.room.name}</p>
              <p className="text-neutral-400 text-sm">{item.room.description}</p>
            </div>
          ))}

          <Separator className="bg-white/10" />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-widest">Check-in</p>
                <p className="text-white">
                  {checkIn ? format(checkIn, "MMM dd, yyyy") : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-widest">Check-out</p>
                <p className="text-white">
                  {checkOut ? format(checkOut, "MMM dd, yyyy") : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-neutral-400 text-xs uppercase tracking-widest">Guests</p>
                <p className="text-white">{totalGuests} Guest{totalGuests !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div>
              <p className="text-neutral-400 text-xs uppercase tracking-widest">Duration</p>
              <p className="text-white">{nights} Night{nights !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest Information */}
      <Card className="bg-neutral-900 border-white/10 rounded-none">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white font-serif text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Guest Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          <p className="text-white font-medium">
            {booking.guestFirstName} {booking.guestLastName}
          </p>
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <Mail className="h-4 w-4" />
            {booking.guestEmail}
          </div>
          {booking.guestPhone && (
            <div className="flex items-center gap-2 text-neutral-400 text-sm">
              <Phone className="h-4 w-4" />
              {booking.guestPhone}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card className="bg-neutral-900 border-white/10 rounded-none">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white font-serif text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-500" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          {booking.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-neutral-400">
                {item.room.name} × {differenceInDays(new Date(item.checkOut), new Date(item.checkIn))} nights
              </span>
              <span className="text-white">
                {formatCurrency(item.pricePerNight * differenceInDays(new Date(item.checkOut), new Date(item.checkIn)))}
              </span>
            </div>
          ))}

          {booking.serviceCharge > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Service Charge</span>
              <span className="text-white">{formatCurrency(booking.serviceCharge)}</span>
            </div>
          )}

          {booking.taxAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Tax</span>
              <span className="text-white">{formatCurrency(booking.taxAmount)}</span>
            </div>
          )}

          <Separator className="bg-white/10" />

          <div className="flex justify-between">
            <span className="text-white font-medium">Total</span>
            <span className="text-white font-bold text-lg">
              {formatCurrency(booking.totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Property Policies (Requirement 2.3) */}
      {booking.policies && booking.policies.length > 0 && (
        <Card className="bg-neutral-900 border-white/10 rounded-none">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-white font-serif text-lg">
              Property Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {booking.policies.map((policy, index) => (
              <div key={index}>
                <p className="text-white font-medium text-sm">{policy.title}</p>
                <p className="text-neutral-400 text-sm">{policy.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cancellation Policy (Requirement 10.1) */}
      {canCancel && (
        <Card className="bg-neutral-900 border-white/10 rounded-none">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-white font-serif text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Cancellation Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <p className="text-neutral-400 text-sm">
              {getCancellationPolicyDescription(DEFAULT_CANCELLATION_POLICY)}
            </p>
            {cancellationFeeInfo && (
              <div className="bg-white/5 border border-white/10 p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  If you cancel now:
                </p>
                {cancellationFeeInfo.isFreeCancellation ? (
                  <p className="text-green-400 text-sm">
                    You will receive a full refund of {formatCurrency(cancellationFeeInfo.refundAmount)}
                  </p>
                ) : (
                  <>
                    <p className="text-yellow-400 text-sm">
                      Cancellation fee: {formatCurrency(cancellationFeeInfo.fee)}
                    </p>
                    <p className="text-neutral-300 text-sm">
                      Refund amount: {formatCurrency(cancellationFeeInfo.refundAmount)}
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* PDF Download for CONFIRMED bookings (Requirement 2.2) */}
        {booking.status === "CONFIRMED" && (
          <DownloadReceiptButton
            booking={booking}
            variant="default"
            className="flex-1 h-12 bg-white text-black hover:bg-neutral-200"
          />
        )}

        {/* Cancel button for guest bookings with valid token (Requirement 10.1) */}
        {canCancel && (
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-none border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 uppercase tracking-widest text-xs"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Booking
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-neutral-900 border-white/10 rounded-none text-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif text-xl">
                  Cancel Booking?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-neutral-400 space-y-3" asChild>
                  <div>
                    <p>Are you sure you want to cancel this reservation?</p>
                    
                    <div className="bg-white/5 border border-white/10 p-4 space-y-2 mt-4">
                      <p className="text-xs uppercase tracking-widest text-neutral-500 font-bold">
                        Cancellation Policy
                      </p>
                      <p className="text-sm text-neutral-300">
                        {getCancellationPolicyDescription(DEFAULT_CANCELLATION_POLICY)}
                      </p>
                    </div>

                    {cancellationFeeInfo && (
                      <div className={`p-4 border mt-4 ${
                        cancellationFeeInfo.isFreeCancellation 
                          ? "bg-green-900/20 border-green-900/50" 
                          : "bg-yellow-900/20 border-yellow-900/50"
                      }`}>
                        {cancellationFeeInfo.isFreeCancellation ? (
                          <p className="text-green-300 text-sm">
                            ✓ You are within the free cancellation window. 
                            You will receive a full refund of {formatCurrency(cancellationFeeInfo.refundAmount)}.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-yellow-300 text-sm font-medium">
                              ⚠ You are outside the free cancellation window.
                            </p>
                            <p className="text-yellow-200 text-sm">
                              Cancellation fee: {formatCurrency(cancellationFeeInfo.fee)}
                            </p>
                            <p className="text-yellow-200 text-sm">
                              Refund amount: {formatCurrency(cancellationFeeInfo.refundAmount)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-neutral-500 mt-4 italic">
                      A confirmation email will be sent to {booking.guestEmail}
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel 
                  disabled={isPending} 
                  className="border-white/10 bg-transparent text-white hover:bg-white/10 rounded-none h-10 uppercase tracking-widest text-xs"
                >
                  Keep Booking
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    handleCancelBooking();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white border-0 rounded-none h-10 uppercase tracking-widest text-xs"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Link to lookup another booking (Requirement 2.4) */}
        <Button
          variant="outline"
          asChild
          className="flex-1 h-12 rounded-none border-white/20 text-white hover:bg-white/10 uppercase tracking-widest text-xs"
        >
          <Link href="/bookings/lookup">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Look Up Another Booking
          </Link>
        </Button>
      </div>
    </div>
  );
}
