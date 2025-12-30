"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, Copy, Download, Home } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import jsPDF from "jspdf";

function ConfirmationContent() {
   const searchParams = useSearchParams();

   const ref = searchParams.get("ref") || "TWC-88219";
   const checkIn = searchParams.get("checkIn");
   const checkOut = searchParams.get("checkOut");

   // Financials
   const roomTotal = Number(searchParams.get("roomTotal") || 0);
   const discount = Number(searchParams.get("discount") || 0);
   const tax = Number(searchParams.get("tax") || 0);
   const serviceCharge = Number(searchParams.get("serviceCharge") || 0);
   const total = Number(searchParams.get("total") || 0);
   const roomName = searchParams.get("roomName") || "Standard Room";
   const propertyName = searchParams.get("propertyName") || "Tropicana Hotel";
   const guests = searchParams.get("guests") || "2";
   const firstName = searchParams.get("firstName") || "";
   const lastName = searchParams.get("lastName") || "";
   const email = searchParams.get("email") || "";
   const phone = searchParams.get("phone") || "";

   const fromDate = checkIn ? parseISO(checkIn) : new Date();
   const toDate = checkOut ? parseISO(checkOut) : new Date();
   const nights = Math.max(1, differenceInDays(toDate, fromDate));

   const handleDownloadPDF = () => {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let y = 25;
      
      const guestName = `${firstName} ${lastName}`.trim() || "Valued Guest";
      
      // Header
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("INVOICE", margin, y);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Reference: ${ref}`, pageWidth - margin, y, { align: "right" });
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
      
      // Guest & Stay Details (two columns)
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
      if (email) { pdf.text(email, margin, y); y += 4; } else { y += 4; }
      pdf.text(roomName, pageWidth / 2, y - 4);
      if (phone) { pdf.text(phone, margin, y); y += 4; }
      pdf.text(`${format(fromDate, "MMM dd, yyyy")} - ${format(toDate, "MMM dd, yyyy")}`, pageWidth / 2, y - 4);
      pdf.text(`${guests} Guests`, margin, y); y += 4;
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
      pdf.text(`PHP ${roomTotal.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
      y += 7;
      
      if (discount > 0) {
         pdf.text("Discount Applied", margin, y);
         pdf.text(`-PHP ${discount.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
         y += 7;
      }
      
      pdf.text("Service Charge (10%)", margin, y);
      pdf.text(`PHP ${serviceCharge.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
      y += 7;
      
      pdf.text("VAT (12%)", margin, y);
      pdf.text(`PHP ${tax.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
      y += 5;
      
      // Total
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
      
      pdf.save(`TWC-Invoice-${ref}.pdf`);
   };

   return (
      <div className="max-w-3xl mx-auto text-center space-y-12">
         <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20"
         >
            <Check className="h-10 w-10 text-green-500" />
         </motion.div>

         <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
         >
            <h1 className="text-5xl md:text-7xl font-serif font-light">Reservation Confirmed</h1>
            <p className="text-xl text-neutral-400 font-light max-w-xl mx-auto">
               Thank you for choosing {propertyName}. Your booking has been successfully processed. A confirmation email has been sent to your inbox.
            </p>
         </motion.div>

         <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 border border-white/10 p-8 md:p-12 space-y-8 rounded-none"
         >
            <div>
               <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Booking Reference</p>
               <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-serif tracking-in-expand">{ref}</span>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10 hover:text-white">
                     <Copy className="h-4 w-4" />
                  </Button>
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
                  <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Status</p>
                  <p className="font-medium text-lg text-green-500">Paid</p>
               </div>
            </div>

            <div className="flex justify-center pt-4 print:hidden">
               <Button onClick={handleDownloadPDF} variant="outline" className="rounded-none h-12 border-white/20 hover:bg-white hover:text-black uppercase tracking-widest text-xs">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
               </Button>
            </div>
         </motion.div>

         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
         >
            <Link href="/">
               <Button className="rounded-none h-14 px-8 bg-white text-black hover:bg-neutral-200 uppercase tracking-widest text-xs font-semibold">
                  Return to Home
               </Button>
            </Link>
         </motion.div>
      </div>
   );
}

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24">
       <div className="container mx-auto px-4">
          <Suspense fallback={<div>Loading...</div>}>
             <ConfirmationContent />
          </Suspense>
       </div>
    </div>
  );
}
