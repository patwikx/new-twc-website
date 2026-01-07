"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

interface ManagerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  onVerify: (pin: string) => Promise<{ success: boolean; managerId?: string; managerName?: string }>;
  onSuccess: (managerId: string, managerName: string) => void;
}

export function ManagerPinDialog({
  open,
  onOpenChange,
  title = "Manager Approval Required",
  description = "Enter manager PIN to authorize this action.",
  actionLabel = "Authorize",
  onVerify,
  onSuccess,
}: ManagerPinDialogProps) {
  const [pin, setPin] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset and focus on open
  React.useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await onVerify(pin);
      
      if (result.success && result.managerId && result.managerName) {
        toast.success(`Authorized by ${result.managerName}`);
        onSuccess(result.managerId, result.managerName);
        onOpenChange(false);
      } else {
        setError("Invalid PIN. Please try again.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-4">
            <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-orange-400" />
            </div>
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin" className="sr-only">Manager PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                ref={inputRef}
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setPin(value);
                  setError(null);
                }}
                placeholder="Enter PIN"
                className="pl-10 text-center text-2xl tracking-[0.5em] bg-neutral-800 border-white/10"
                autoComplete="off"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              type="submit"
              disabled={isVerifying || pin.length < 4}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {actionLabel}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
