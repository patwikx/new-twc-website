"use client";

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
import { Button } from "@/components/ui/button";
import { cancelBooking } from "@/actions/booking";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface CancelBookingButtonProps {
  bookingId: string;
  checkInDate: Date;
  status: string;
  amountPaid: number;
  paymentStatus: string;
}

export const CancelBookingButton = ({ bookingId, checkInDate, status, amountPaid, paymentStatus }: CancelBookingButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Quick client-side check for 48h policy to disable button if obviously too late?
  // User asked for UI policy enforcement - server is source of truth, but UI hints are good.
  // Let's rely on server for strictness, but maybe show warning in text.
  
  const handleCancel = () => {
    startTransition(() => {
      cancelBooking(bookingId)
        .then((data) => {
          if (data.error) {
            toast.error(data.error);
          } else {
            toast.success(data.success);
            setIsOpen(false);
            router.refresh();
          }
        })
        .catch(() => toast.error("Something went wrong."));
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/10 h-12 rounded-none px-4 uppercase tracking-widest text-xs gap-2">
            <XCircle className="h-4 w-4" /> Cancel Booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-neutral-900 border-white/10 rounded-none text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">Cancel Booking?</AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-400 space-y-2" asChild>
            <div>
              <p>Are you sure you want to cancel this reservation?</p>
              {status === 'CONFIRMED' && (
                  <div className="bg-red-900/20 border border-red-900/50 p-3 text-xs text-red-200 mt-2">
                      <p className="font-bold mb-1">CANCELLATION POLICY</p>
                      <p>Confirmed bookings can only be cancelled 48 hours prior to check-in.</p>
                  </div>
              )}
              {(status === 'CONFIRMED' && (paymentStatus === 'PAID' || amountPaid > 0)) && (
                <p className="text-xs mt-2 italic">
                  Note: Refunds for paid bookings typically take up to 45 business days to process depending on your bank.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isPending} className="border-white/10 bg-transparent text-white hover:bg-white/10 rounded-none h-10 uppercase tracking-widest text-xs">
             Keep Booking
          </AlertDialogCancel>
          <AlertDialogAction 
             disabled={isPending}
             onClick={(e) => {
                e.preventDefault();
                handleCancel();
             }}
             className="bg-red-600 hover:bg-red-700 text-white border-0 rounded-none h-10 uppercase tracking-widest text-xs"
          >
             {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
             Yes, Cancel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
