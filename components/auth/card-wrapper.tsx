"use client";

import { CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Header } from "@/components/auth/header";
import { Social } from "@/components/auth/social";
import { BackButton } from "@/components/auth/back-button";

interface CardWrapperProps {
  children: React.ReactNode;
  headerLabel: string;
  backButtonLabel: string;
  backButtonHref: string;
  showSocial?: boolean;
}

export const CardWrapper = ({
  children,
  headerLabel,
  backButtonLabel,
  backButtonHref,
  showSocial,
}: CardWrapperProps) => {
  return (
    <div className="w-full max-w-[400px]">
      <CardHeader className="pb-8 px-0">
        <Header label={headerLabel} />
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-6">{children}</CardContent>
      {showSocial && (
        <CardFooter className="flex flex-col gap-6 px-0 pb-6">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-transparent px-4 text-neutral-500">
                Or continue with
              </span>
            </div>
          </div>
          <Social />
        </CardFooter>
      )}
      <CardFooter className="pt-2 px-0">
        <BackButton label={backButtonLabel} href={backButtonHref} />
      </CardFooter>
    </div>
  );
};
