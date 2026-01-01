"use strict";

"use client";

import { logout } from "@/actions/logout";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

interface LogoutButtonProps {
  children?: React.ReactNode;
}

export const LogoutButton = ({ children }: LogoutButtonProps) => {
  const [isPending, setIsPending] = useState(false);

  const onClick = async () => {
    setIsPending(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await logout();
    // No need to set false, redirect happens
  };

  return (
    <>
      <span onClick={onClick} className="cursor-pointer">
        {children}
      </span>
      {isPending && createPortal(
         <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-neutral-900 border border-white/10 p-8 flex flex-col items-center gap-4 shadow-2xl animate-in fade-in zoom-in duration-300">
               <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
               <p className="text-white font-serif text-xl tracking-wide">Logging out...</p>
            </div>
         </div>,
         document.body
      )}
    </>
  );
};
