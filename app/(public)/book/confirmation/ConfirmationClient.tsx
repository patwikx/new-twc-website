"use client";

import { Booking, BookingItem, Payment, BookingStatus, PaymentStatus } from "@prisma/client";
import { format } from "date-fns";
import { CheckCircle2, Download, Printer, Clock, AlertCircle, Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Define the serialized booking type passed from the server component
interface SerializedBooking {
  id: string;
  shortRef: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  taxAmount: number;
  serviceCharge: number;
  amountPaid: number;
  amountDue: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  items: {
    id: string;
    guests: number;
    pricePerNight: number;
    checkIn: string;
    checkOut: string;
    room: {
      name: string;
      image: string;
    } | null;
  }[];
  property?: {
    name: string;
    location: string;
  } | null;
}

export default function ConfirmationClient({ 
  booking: initialBooking,
  config = { taxRate: 0.12, serviceChargeRate: 0.10 }, // Default fallback
  verificationToken
}: { 
  booking: SerializedBooking;
  config?: { taxRate: number; serviceChargeRate: number };
  verificationToken?: string;
}) {
  // Use state to track current status, initialized with server data
  const [currentStatus, setCurrentStatus] = useState(initialBooking.status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState(initialBooking.paymentStatus);
  const router = useRouter();

  useEffect(() => {
    // Poll for status updates every 5 seconds if pending
    if (currentStatus === 'PENDING' || currentPaymentStatus === 'UNPAID') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/bookings/status?id=${initialBooking.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status !== currentStatus || data.paymentStatus !== currentPaymentStatus) {
              setCurrentStatus(data.status);
              setCurrentPaymentStatus(data.paymentStatus);
              router.refresh(); // Refresh server components
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentStatus, currentPaymentStatus, initialBooking.id, router]);

  const handleDownloadPDF = async () => {
    const fromDate = initialBooking.items[0]?.checkIn ? new Date(initialBooking.items[0].checkIn) : new Date();
    const toDate = initialBooking.items[0]?.checkOut ? new Date(initialBooking.items[0].checkOut) : new Date();
    const nights = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    const roomName = initialBooking.items[0]?.room?.name || "Standard Room";
    const propertyName = initialBooking.property?.name || "Tropicana Hotel";
    const total = Number(initialBooking.totalAmount);
    const guestName = `${initialBooking.guestFirstName} ${initialBooking.guestLastName}`.trim();

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;
    
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

    // Reverse calc for display since we only have total
    const serviceAmount = total * (config.serviceChargeRate / (1 + config.taxRate + config.serviceChargeRate));
    const taxAmount = total * (config.taxRate / (1 + config.taxRate + config.serviceChargeRate));
    const baseAmount = total - serviceAmount - taxAmount;

    pdf.text(`Room Charges (${nights} nights)`, margin, y);
    pdf.text(`PHP ${baseAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, pageWidth - margin, y, { align: "right" });
    y += 6;
    
    pdf.text(`Service Charge (${(config.serviceChargeRate * 100).toFixed(0)}%)`, margin, y);
    pdf.text(`PHP ${serviceAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, pageWidth - margin, y, { align: "right" });
    y += 6;
    
    pdf.text(`VAT (${(config.taxRate * 100).toFixed(0)}%)`, margin, y);
    pdf.text(`PHP ${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, pageWidth - margin, y, { align: "right" });
    
    // Total
    y += 20;
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Total Paid", margin, y);
    pdf.text(`PHP ${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, pageWidth - margin, y, { align: "right" });
    
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
    <div className="max-w-3xl mx-auto text-center space-y-8">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Status Icon */}
        {currentStatus === 'CONFIRMED' ? (
           <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">
             <CheckCircle2 className="h-12 w-12 text-green-500" />
           </div>
        ) : (
           <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/50 animate-pulse">
             <Clock className="h-12 w-12 text-orange-500" />
           </div>
        )}

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-4xl font-serif italic">
            {currentStatus === 'CONFIRMED' ? 'Payment Successful' : 'Processing Payment'}
          </h1>
          <p className="text-neutral-400">
             Ref: <span className="text-white font-mono">{initialBooking.shortRef}</span>
          </p>
        </div>

        {/* Message */}
        <div className="bg-white/5 border border-white/10 p-8 max-w-xl w-full text-left space-y-4">
           {currentStatus === 'CONFIRMED' ? (
             <>
               <p className="text-lg">Your reservation at <span className="text-white font-medium">{initialBooking.property?.name}</span> is confirmed.</p>
               <p className="text-neutral-400 text-sm">A confirmation email has been sent to {initialBooking.guestEmail}.</p>
             </>
           ) : (
             <>
               <p className="text-lg">We are verifying your transaction.</p>
               <p className="text-neutral-400 text-sm">This typically takes a few moments. This page will update automatically.</p>
             </>
           )}

           <div className="border-t border-white/10 pt-4 mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-500 block text-xs uppercase tracking-widest mb-1">Total Paid</span>
                <span className="text-xl">₱{Number(initialBooking.totalAmount).toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-500 block text-xs uppercase tracking-widest mb-1">Status</span>
                <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-sm ${
                   currentPaymentStatus === 'PAID' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                   {currentPaymentStatus}
                </span>
              </div>
           </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
           <Link href="/">
             <Button variant="outline" className="border-white/20 hover:bg-white hover:text-black rounded-none uppercase tracking-widest text-xs h-12 px-8">
               Back to Home
             </Button>
           </Link>
           
           {currentStatus === 'CONFIRMED' && (
             <Button 
               onClick={handleDownloadPDF}
               className="bg-white text-black hover:bg-neutral-200 rounded-none uppercase tracking-widest text-xs h-12 px-8"
             >
               <Download className="h-4 w-4 mr-2" /> Download Receipt
             </Button>
           )}
        </div>

        {/* Save This Link Section (Requirement 5.3) */}
        <div className="bg-neutral-900/50 border border-white/10 p-6 max-w-xl w-full mt-8">
          <div className="flex items-start gap-3">
            <Bookmark className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-left">
              <h3 className="text-white font-medium">Save Your Booking Details</h3>
              <p className="text-neutral-400 text-sm">
                Didn't create an account? You can always look up your booking using your reference number 
                <span className="text-white font-mono mx-1">{initialBooking.shortRef}</span> 
                and email address.
              </p>
              <Link 
                href="/bookings/lookup" 
                className="inline-flex items-center gap-1 text-orange-500 hover:text-orange-400 text-sm transition-colors"
              >
                Go to Booking Lookup <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
