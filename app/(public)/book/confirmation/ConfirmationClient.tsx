"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, Copy, Download, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { jsPDF } from "jspdf";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";

type BookingType = {
  id: string;
  shortRef: string;
  status: string;
  paymentStatus: string;
  totalAmount: any;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  items: any[];
  property?: any;
};

export default function ConfirmationClient({ booking: initialBooking }: { booking: BookingType }) {
  // Use state to track current status, initialized with server data
  const [currentStatus, setCurrentStatus] = useState(initialBooking.status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState(initialBooking.paymentStatus);
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);

  // Clear cart on mount to ensure no stale items remain after processing
  useEffect(() => {
     clearCart();
  }, [clearCart]);

  // Poll for status updates if payment is pending
  useEffect(() => {
    if (currentPaymentStatus === 'PAID' || currentPaymentStatus === 'FAILED') return;

    const pollInterval = setInterval(async () => {
       try {
          const res = await fetch(`/api/bookings/status?id=${initialBooking.id}`);
          if (res.ok) {
             const data = await res.json();
             // Update state if changed
             if (data.status !== currentStatus || data.paymentStatus !== currentPaymentStatus) {
                setCurrentStatus(data.status);
                setCurrentPaymentStatus(data.paymentStatus);
                
                // If finalized, stop polling
                if (data.paymentStatus === 'PAID' || data.paymentStatus === 'FAILED') {
                   clearInterval(pollInterval);
                   router.refresh(); // Refresh server components to ensure consistency
                }
             }
          }
       } catch (error) {
          console.error("Status polling failed", error);
       }
    }, 2000); // Check every 2s

    // Stop polling after 2 minutes
    const timeout = setTimeout(() => clearInterval(pollInterval), 120000);

    return () => {
       clearInterval(pollInterval);
       clearTimeout(timeout);
    };
  }, [currentPaymentStatus, currentStatus, initialBooking.id, router]);

  const fromDate = initialBooking.items[0]?.checkIn ? new Date(initialBooking.items[0].checkIn) : new Date();
  const toDate = initialBooking.items[0]?.checkOut ? new Date(initialBooking.items[0].checkOut) : new Date();
  const nights = Math.max(1, differenceInDays(toDate, fromDate));
  
  const roomName = initialBooking.items[0]?.room?.name || "Standard Room";
  const propertyName = initialBooking.property?.name || "Tropicana Hotel";
  const total = Number(initialBooking.totalAmount);

  // Derive UI state from current status
  const isPending = currentPaymentStatus === 'PENDING' || currentPaymentStatus === 'UNPAID';
  const isFailed = currentPaymentStatus === 'FAILED';
  const isPaid = currentPaymentStatus === 'PAID';

  const handleDownloadPDF = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;
    
    const guestName = `${initialBooking.guestFirstName} ${initialBooking.guestLastName}`.trim();
    
    // Header
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.text("INVOICE", margin, y);
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Reference: ${initialBooking.shortRef}`, pageWidth - margin, y, { align: "right" });
    y += 6;
    pdf.text(`Date: ${format(new Date(), "MMM dd, yyyy")}`, pageWidth - margin, y, { align: "right" });
    
    y += 4;
    pdf.setFontSize(9);
    pdf.text("Tropicana Worldwide Corp.", margin, y); y += 4;
    pdf.text("123 Luxury Ave, General Santos City", margin, y); y += 4;
    pdf.text("Philippines, 9500", margin, y);
    
    // Divider
    y += 10;
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 15;
    
    // Guest & Stay Details
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("BILLED TO", margin, y);
    pdf.text("STAY DETAILS", pageWidth / 2, y);
    y += 6;
    
    pdf.setFontSize(11);
    pdf.text(guestName, margin, y);
    pdf.text(propertyName, pageWidth / 2, y);
    y += 5;
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    if (initialBooking.guestEmail) { pdf.text(initialBooking.guestEmail, margin, y); y += 4; } else { y += 4; }
    pdf.text(roomName, pageWidth / 2, y - 4);
    if (initialBooking.guestPhone) { pdf.text(initialBooking.guestPhone, margin, y); y += 4; }
    pdf.text(`${format(fromDate, "MMM dd, yyyy")} - ${format(toDate, "MMM dd, yyyy")}`, pageWidth / 2, y - 4);
    pdf.text(`(${nights} Nights)`, pageWidth / 2, y - 4);
    
    // Divider
    y += 10;
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    // Line Items Header
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("DESCRIPTION", margin, y);
    pdf.text("AMOUNT", pageWidth - margin, y, { align: "right" });
    y += 3;
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    // Line Items
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Room Charges (${nights} nights)`, margin, y);
    pdf.text(`PHP ${total.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
    
    // Total
    y += 20;
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Total Paid", margin, y);
    pdf.text(`PHP ${total.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
    
    // Footer
    y += 30;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    pdf.text(`Thank you for choosing ${propertyName}.`, pageWidth / 2, y, { align: "center" });
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text("support@tropicana.com", pageWidth / 2, y, { align: "center" });
    
    pdf.save(`TWC-Invoice-${initialBooking.shortRef}.pdf`);
  };

  return (
      <div className="max-w-3xl mx-auto text-center space-y-12">
         {/* Status Header */}
         <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border ${
               isPaid ? "bg-green-500/10 border-green-500/20" : 
               isFailed ? "bg-red-500/10 border-red-500/20" : 
               "bg-yellow-500/10 border-yellow-500/20"
            }`}
         >
            {isPaid ? <Check className="h-10 w-10 text-green-500" /> :
             isFailed ? <XCircle className="h-10 w-10 text-red-500" /> :
             <Loader2 className="h-10 w-10 text-yellow-500 animate-spin" />}
         </motion.div>

         <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
         >
            <h1 className="text-5xl md:text-7xl font-serif font-light">
               {isPaid ? "Reservation Confirmed" : 
                isFailed ? "Payment Failed" : 
                "Processing Payment"}
            </h1>
            <p className="text-xl text-neutral-400 font-light max-w-xl mx-auto">
               {isPaid ? `Thank you for choosing ${propertyName}. Your booking has been successfully processed.` : 
                isFailed ? "There was an issue processing your payment. Please try again or contact support." : 
                "We are verifying your payment status. This usually takes a few seconds..."}
            </p>
         </motion.div>

         <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`bg-white/5 border border-white/10 p-8 md:p-12 space-y-8 rounded-none ${(isPaid || isFailed) ? 'block' : 'hidden'}`}
         >
            <div>
               <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Booking Reference</p>
               <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-serif tracking-in-expand">{initialBooking.shortRef}</span>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 hover:text-white" onClick={() => navigator.clipboard.writeText(initialBooking.shortRef)}>
                     <Copy className="h-4 w-4" />
                  </Button>
               </div>
               <div className="mt-4">
                   <Badge variant="outline" className={`rounded-none px-3 py-1 text-xs uppercase tracking-widest border ${
                      currentStatus === 'CONFIRMED' ? 'bg-green-900/50 text-green-300 border-green-800/50' : 
                      currentStatus === 'CANCELLED' ? 'bg-red-900/50 text-red-300 border-red-800/50' :
                      'bg-neutral-800 text-neutral-400 border-neutral-700'
                   }`}>
                      {currentStatus}
                   </Badge>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/10">
               <div>
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Check In</p>
                  <p className="font-medium text-lg">{format(fromDate, "MMM dd, yyyy")}</p>
               </div>
               <div>
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Check Out</p>
                  <p className="font-medium text-lg">{format(toDate, "MMM dd, yyyy")}</p>
               </div>
               <div>
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Payment Status</p>
                  <p className={`font-medium text-lg ${
                      currentPaymentStatus === 'PAID' ? 'text-green-500' : 
                      currentPaymentStatus === 'PARTIALLY_PAID' ? 'text-yellow-500' : 
                      currentPaymentStatus === 'FAILED' ? 'text-red-500' : 
                      'text-neutral-400'
                  }`}>
                      {currentPaymentStatus.replace('_', ' ')}
                  </p>
               </div>
            </div>

            {isPaid && (
               <div className="flex justify-center pt-4 print:hidden">
                  <Button onClick={handleDownloadPDF} variant="outline" className="rounded-none h-12 border-white/20 hover:bg-white hover:text-black uppercase tracking-widest text-xs">
                     <Download className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
               </div>
            )}
         </motion.div>

         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className={(isPaid || isFailed) ? 'block' : 'hidden'}
         >
            <Link href={`/bookings/${initialBooking.id}`}>
               <Button className="rounded-none h-14 px-8 bg-white text-black hover:bg-neutral-200 uppercase tracking-widest text-xs font-semibold">
                  View Booking Details
               </Button>
            </Link>
         </motion.div>
      </div>
  );
}
