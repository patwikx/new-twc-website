"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";

import { LoginSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
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
import { FormError } from "@/components/form-error";
import { FormSuccess } from "@/components/form-success";
import { login } from "@/actions/login";

export const LoginForm = () => {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState<string | undefined>("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof LoginSchema>) => {
    setError("");
    setSuccess("");

    startTransition(() => {
      login(values)
        .then((data) => {
          if (data && data.error) {
              setError(data.error);
          }
        });
    });
  };

  return (
    <CardWrapper
      headerLabel="Welcome back!"
      backButtonLabel="Don't have an account? Sign up"
      backButtonHref="/auth/register"
      showSocial
    >
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">Email Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="juandelacruz@example.com"
                      type="email"
                      className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors placeholder:text-neutral-600"
                    />
                  </FormControl>
                  <FormMessage className="font-light" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-neutral-500">Password</FormLabel>
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
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" className="border-white/20 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" />
                <label
                  htmlFor="remember"
                  className="text-xs text-neutral-400 font-light leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Remember me
                </label>
              </div>
              <Button
                size="sm"
                variant="link"
                asChild
                className="px-0 font-light text-xs text-neutral-400 hover:text-white"
              >
                <Link href="/auth/reset">
                  Forgot password?
                </Link>
              </Button>
            </div>
          </div>
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button
            disabled={isPending}
            type="submit"
            className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500 font-normal"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};
