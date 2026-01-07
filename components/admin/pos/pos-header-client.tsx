"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Outlet {
  id: string;
  name: string;
}

interface POSHeaderClientProps {
  outlets: Outlet[];
  selectedOutletId: string;
}

export function POSHeaderClient({ outlets, selectedOutletId }: POSHeaderClientProps) {
  const router = useRouter();

  const handleOutletChange = (value: string) => {
    if (value !== selectedOutletId) {
      router.push(`/admin/pos?outlet=${value}`);
    }
  };

  return (
    <Select value={selectedOutletId} onValueChange={handleOutletChange}>
      <SelectTrigger className="w-[200px] bg-neutral-900 border-white/10 text-white">
        <SelectValue placeholder="Select outlet" />
      </SelectTrigger>
      <SelectContent>
        {outlets.map((outlet) => (
          <SelectItem key={outlet.id} value={outlet.id}>
            {outlet.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
