"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { ResetSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CardWrapper } from "@/components/auth/card-wrapper";
import { Button } from "@/components/ui/button";
import { reset } from "@/actions/reset";
import { newPassword } from "@/actions/new-password";

const COOLDOWN_SECONDS = 300; // 5 minutes

const NewPasswordSchema = z.object({
  password: z.string().min(6, {
    message: "Minimum 6 characters required",
  }),
  confirmPassword: z.string().min(6, {
    message: "Minimum 6 characters required",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const ResetForm = () => {
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState<number>(0);
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const router = useRouter();

  const emailForm = useForm<z.infer<typeof ResetSchema>>({
    resolver: zodResolver(ResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const passwordForm = useForm<z.infer<typeof NewPasswordSchema>>({
    resolver: zodResolver(NewPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

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

  const onEmailSubmit = (values: z.infer<typeof ResetSchema>) => {
    startTransition(() => {
      reset(values)
        .then((data) => {
          if (data?.error) {
            toast.error(data.error);
          }
          if (data?.success) {
            toast.success(data.success);
            setEmail(values.email);
            setCooldown(COOLDOWN_SECONDS);
            setStep("otp");
          }
        });
    });
  };

  const [isVerifying, setIsVerifying] = useState(false);
  // ...

  const onOtpComplete = async (value: string) => {
    setOtp(value);
    if (value.length === 6) {
      setIsVerifying(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsVerifying(false);
      setStep("password");
    }
  };

  const onPasswordSubmit = (values: z.infer<typeof NewPasswordSchema>) => {
    startTransition(() => {
      newPassword(values, otp)
        .then((data) => {
          if (data?.error) {
            toast.error(data.error);
            setStep("otp");
            setOtp("");
          }
          if (data?.success) {
            toast.success(data.success);
            router.push("/auth/login");
          }
        });
    });
  };

  const isDisabled = isPending || cooldown > 0;

  // Step 1: Email Input
  if (step === "email") {
    return (
      <CardWrapper
        headerLabel="Forgot your password?"
        backButtonLabel="Back to login"
        backButtonHref="/auth/login"
      >
        <Form {...emailForm}>
          <form 
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            className="space-y-4"
          >
            <div className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder="name@example.com"
                        type="email"
                        className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors placeholder:text-neutral-600"
                      />
                    </FormControl>
                    <FormMessage className="font-light" />
                  </FormItem>
                )}
              />
            </div>
            
            <Button
              disabled={isPending}
              type="submit"
              className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500 font-normal disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send reset code"}
            </Button>
          </form>
        </Form>
      </CardWrapper>
    );
  }

  // Step 2: OTP Input
  if (step === "otp") {
    return (
      <CardWrapper
        headerLabel="Enter verification code"
        backButtonLabel="Back to login"
        backButtonHref="/auth/login"
      >
        <div className="space-y-6">
          <p className="text-neutral-400 text-sm text-center">
            We sent a 6-digit code to<br />
            <span className="text-white">{email}</span>
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

          {cooldown > 0 && (
            <p className="text-xs text-neutral-400 text-center">
              Resend code in {formatTime(cooldown)}
            </p>
          )}
          
          <Button
            disabled={isDisabled}
            onClick={() => onEmailSubmit({ email })}
            variant="ghost"
            className="w-full text-xs text-neutral-400 hover:text-white"
          >
            {cooldown > 0 ? `Resend in ${formatTime(cooldown)}` : "Resend code"}
          </Button>
        </div>
      </CardWrapper>
    );
  }

  // Step 3: New Password
  return (
    <CardWrapper
      headerLabel="Create new password"
      backButtonLabel="Back to login"
      backButtonHref="/auth/login"
    >
      <Form {...passwordForm}>
        <form 
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
          className="space-y-4"
        >
          <div className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">New Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="••••••••"
                      type="password"
                      className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors placeholder:text-neutral-600"
                    />
                  </FormControl>
                  <FormMessage className="font-light" />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="••••••••"
                      type="password"
                      className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors placeholder:text-neutral-600"
                    />
                  </FormControl>
                  <FormMessage className="font-light" />
                </FormItem>
              )}
            />
          </div>
          <Button
            disabled={isPending}
            type="submit"
            className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500 font-normal"
          >
            {isPending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};
