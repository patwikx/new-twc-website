"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, CreditCard, Building, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { processPayment } from "@/lib/pos/payment";
import { PaymentMethod } from "@prisma/client";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  totalAmount: number;
  customerName?: string | null;
  onPaymentComplete: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  totalAmount,
  customerName,
  onPaymentComplete
}: PaymentDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("cash");
  const [isLoading, setIsLoading] = useState(false);
  
  // Payment States
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardReference, setCardReference] = useState<string>("");
  const [roomNumber, setRoomNumber] = useState<string>("");

  const handlePayment = async () => {
    setIsLoading(true);
    let method: PaymentMethod = "CASH";
    let amount = totalAmount; // Default to full amount
    let reference = undefined;

    try {
        if (activeTab === "cash") {
            method = "CASH";
            const tendered = parseFloat(cashAmount);
            if (isNaN(tendered) || tendered < totalAmount) {
                toast.error("Insufficient cash amount");
                setIsLoading(false);
                return;
            }
            amount = tendered; // Pass tendered amount to backend? 
            // Backend treats amount as "Payment Amount". If > total, it's just recorded.
            // Logic: Record the PAYMENT as the Total Due, or the Tendered?
            // Usually we record the payment for the bill amount. Change is separate.
            // But let's pass the tendered amount to the action to handle "change" calculation if needed.
            // Actually, backend logic I wrote sums payments. 
            // If I pay 1000 for 500 bill, I shouldn't record 1000 revenue.
            // I should record 500.
            // Frontend should determine "Payment Amount" vs "Tendered".
            amount = totalAmount; 
            // But wait, what if partial payment?
            // User might want to split bill.
            // For now, assume full payment only for simplicity as per "PAY" button context.
            // So we send `totalAmount`.
        } else if (activeTab === "card") {
            method = "CREDIT_CARD";
            reference = cardReference;
            amount = totalAmount;
        } else if (activeTab === "room") {
            method = "ROOM_CHARGE";
            reference = roomNumber || customerName || "Guest";
            amount = totalAmount;
        }

        const result = await processPayment({
            orderId,
            amount,
            method,
            reference
        });

        if (result.error) {
            toast.error(result.error);
        } else if (result.success) {
            if (activeTab === "cash") {
                 const change = parseFloat(cashAmount) - totalAmount;
                 if (change > 0) {
                     toast.success(`Payment Successful! Change: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(change)}`, {
                         duration: 5000,
                         icon: <CheckCircle2 className="h-5 w-5 text-green-500" />
                     });
                 } else {
                     toast.success("Payment Successful");
                 }
            } else {
                toast.success("Payment Successful");
            }
            onPaymentComplete();
            onOpenChange(false);
        }
    } catch (error) {
        toast.error("Payment failed");
    } finally {
        setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Select payment method to complete order.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg mb-6 border border-white/10">
                <span className="text-neutral-300 font-medium">Total Due</span>
                <span className="text-2xl font-bold text-green-400">{formatCurrency(totalAmount)}</span>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-neutral-800">
                    <TabsTrigger value="cash"><Banknote className="h-4 w-4 mr-2"/> Cash</TabsTrigger>
                    <TabsTrigger value="card"><CreditCard className="h-4 w-4 mr-2"/> Card</TabsTrigger>
                    <TabsTrigger value="room"><Building className="h-4 w-4 mr-2"/> Room</TabsTrigger>
                </TabsList>

                <TabsContent value="cash" className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Amount Tendered</Label>
                        <Input 
                            type="number" 
                            className="bg-neutral-800 border-white/10 text-lg h-12" 
                            placeholder="0.00"
                            value={cashAmount}
                            onChange={(e) => setCashAmount(e.target.value)}
                            autoFocus
                        />
                    </div>
                    {cashAmount && !isNaN(parseFloat(cashAmount)) && (
                        <div className="flex justify-between items-center px-2">
                            <span className="text-sm text-neutral-400">Change</span>
                            <span className={`font-bold ${parseFloat(cashAmount) >= totalAmount ? "text-orange-400" : "text-red-400"}`}>
                                {formatCurrency(Math.max(0, parseFloat(cashAmount) - totalAmount))}
                            </span>
                        </div>
                    )}
                     <div className="grid grid-cols-4 gap-2 mt-2">
                         {[100, 200, 500, 1000].map(amt => (
                             <Button 
                                key={amt} 
                                variant="outline" 
                                size="sm"
                                className="border-white/10 hover:bg-white/10"
                                onClick={() => setCashAmount(amt.toString())}
                             >
                                 {amt}
                             </Button>
                         ))}
                     </div>
                </TabsContent>

                <TabsContent value="card" className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Reference Number (Optional)</Label>
                        <Input 
                            className="bg-neutral-800 border-white/10" 
                            placeholder="Terminal receipt no."
                            value={cardReference}
                            onChange={(e) => setCardReference(e.target.value)}
                        />
                    </div>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-200">
                        Please process the card on the terminal first.
                    </div>
                </TabsContent>

                <TabsContent value="room" className="space-y-4 py-4">
                    <div className="space-y-2">
                         <Label>Guest Name / Room</Label>
                         <Input 
                            className="bg-neutral-800 border-white/10" 
                            value={customerName || ""}
                            placeholder="Room Number or Guest Name"
                            onChange={(e) => setRoomNumber(e.target.value)} // Just visual for now unless we override
                            readOnly={!!customerName}
                         />
                    </div>
                    {customerName ? (
                         <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-sm text-green-200">
                             Charge to registered guest: {customerName}
                         </div>
                    ) : (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-200">
                            No registered guest assigned to this order.
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-neutral-400">Cancel</Button>
          <Button 
            onClick={handlePayment} 
            disabled={isLoading || (activeTab === 'cash' && parseFloat(cashAmount || "0") < totalAmount)}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
