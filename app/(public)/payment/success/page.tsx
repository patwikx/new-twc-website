"use client";

import { CheckCircle2 } from "lucide-react";

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-serif">Payment Successful</h1>
        <p className="text-neutral-400">
          Your payment has been securely processed.
        </p>
        
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-sm text-neutral-300">
          <p>You can now close this tab and return to the booking page to see your confirmation.</p>
        </div>

        <button 
          onClick={() => window.close()}
          className="text-sm text-neutral-500 hover:text-white transition-colors underline"
        >
          Close this tab
        </button>
      </div>
    </div>
  );
}
