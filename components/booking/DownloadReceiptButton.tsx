"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DownloadReceiptButtonProps {
  booking: {
    shortRef: string;
    items: any[];
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone: string;
    property?: any;
    totalAmount: any;
  };
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function DownloadReceiptButton({ booking, className, variant = "outline" }: DownloadReceiptButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    // Add small delay to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
        const fromDate = booking.items[0]?.checkIn ? new Date(booking.items[0].checkIn) : new Date();
        const toDate = booking.items[0]?.checkOut ? new Date(booking.items[0].checkOut) : new Date();
        const nights = Math.max(1, differenceInDays(toDate, fromDate));
        
        const roomName = booking.items[0]?.room?.name || "Standard Room";
        const propertyName = booking.property?.name || "Tropicana Hotel";
        const total = Number(booking.totalAmount);
        const guestName = `${booking.guestFirstName} ${booking.guestLastName}`.trim();

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
        pdf.text(`Reference: ${booking.shortRef}`, pageWidth - margin, y, { align: "right" });
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
        if (booking.guestEmail) { pdf.text(booking.guestEmail, margin, y); y += 4; } else { y += 4; }
        pdf.text(roomName, pageWidth / 2, y - 4);
        if (booking.guestPhone) { pdf.text(booking.guestPhone, margin, y); y += 4; }
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
        
        pdf.save(`TWC-Invoice-${booking.shortRef}.pdf`);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Button 
      variant={variant}
      onClick={handleDownloadPDF}
      disabled={isGenerating}
      className={cn("uppercase tracking-widest text-xs gap-2 rounded-none", className)}
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Download Receipt
    </Button>
  );
}
