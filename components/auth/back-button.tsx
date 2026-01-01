"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

interface BackButtonProps {
  href: string;
  label: string;
}

export const BackButton = ({ href, label }: BackButtonProps) => {
  return (
    <Button
      variant="link"
      className="font-normal w-full text-neutral-500 hover:text-white uppercase text-xs tracking-widest transition-colors"
      size="sm"
      asChild
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
};
