"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { CardWrapper } from "@/components/auth/card-wrapper";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-error";
import { FormSuccess } from "@/components/form-success";
import { newVerification } from "@/actions/new-verification";

const COOLDOWN_SECONDS = 300; // 5 minutes

interface NewVerificationFormProps {
  email?: string;
}

export const NewVerificationForm = ({ email }: NewVerificationFormProps) => {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [otp, setOtp] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);
  const router = useRouter();

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const [isVerifying, setIsVerifying] = useState(false);
  // ...

  const onOtpComplete = async (value: string) => {
    setOtp(value);
    if (value.length === 6) {
      setIsVerifying(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsVerifying(false);
      onSubmit(value);
    }
  };

  const onSubmit = (token: string) => {
    startTransition(() => {
      newVerification(token)
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setOtp("");
          }
          if (data.success) {
            setSuccess(data.success);
            // Redirect to login after successful verification
            setTimeout(() => {
              router.push("/auth/login");
            }, 2000);
          }
        })
        .catch(() => {
          setError("Something went wrong!");
        });
    });
  };

  return (
    <CardWrapper
      headerLabel="Verify your email"
      backButtonLabel="Back to login"
      backButtonHref="/auth/login"
    >
      <div className="space-y-6">
        <p className="text-neutral-400 text-sm text-center">
          Enter the 6-digit code we sent to<br />
          <span className="text-white">{email || "your email"}</span>
        </p>
        
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={onOtpComplete}
            disabled={isPending || isVerifying}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="w-12 h-14 text-lg bg-neutral-950 border-white/20 text-white rounded-none" />
              <InputOTPSlot index={1} className="w-12 h-14 text-lg bg-neutral-950 border-white/20 text-white rounded-none" />
              <InputOTPSlot index={2} className="w-12 h-14 text-lg bg-neutral-950 border-white/20 text-white rounded-none" />
              <InputOTPSlot index={3} className="w-12 h-14 text-lg bg-neutral-950 border-white/20 text-white rounded-none" />
              <InputOTPSlot index={4} className="w-12 h-14 text-lg bg-neutral-950 border-white/20 text-white rounded-none" />
              <InputOTPSlot index={5} className="w-12 h-14 text-lg bg-neutral-950 border-white/20 text-white rounded-none" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <FormError message={error} />
        <FormSuccess message={success} />
        
        {cooldown > 0 && (
          <p className="text-xs text-neutral-400 text-center">
            Resend code in {formatTime(cooldown)}
          </p>
        )}
        
        <Button
          disabled={isPending || isVerifying || otp.length !== 6}
          onClick={() => onSubmit(otp)}
          className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500 font-normal disabled:opacity-50"
        >
          {isPending || isVerifying ? "Verifying..." : "Verify Email"}
        </Button>
      </div>
    </CardWrapper>
  );
};
