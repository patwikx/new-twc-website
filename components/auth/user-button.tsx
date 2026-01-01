"use strict";

"use client";

import { User, LogOut, CalendarDays, Bell } from "lucide-react";
import Link from "next/link"; // Add Link import

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button"; // Use button triggers or just avatar?
// import { useCurrentUser } from "@/hooks/use-current-user"; // If using hook, or pass protected user as prop?
import { LogoutButton } from "@/components/auth/logout-button";

interface UserButtonProps {
    user?: {
        name?: string | null;
        image?: string | null;
        email?: string | null;
    }
}

export const UserButton = ({ user } : UserButtonProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-9 w-9 rounded-none border border-white/20 transition hover:border-white">
          <AvatarImage src={user?.image || ""} className="rounded-none object-cover" />
          <AvatarFallback className="bg-sky-500 rounded-none text-white font-bold">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 rounded-none bg-neutral-950 border-white/10 p-0" align="end">
        <div className="flex items-center justify-start gap-3 p-3 border-b border-white/10 bg-white/5">
          <Avatar className="h-9 w-9 border border-white/10 rounded-none">
            <AvatarImage src={user?.image || ""} className="rounded-none object-cover" />
            <AvatarFallback className="bg-orange-500 rounded-none text-black font-bold">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-0.5 leading-none">
            {user?.name && (
              <p className="font-medium text-xs text-white tracking-wide">
                {user.name}
              </p>
            )}
            {user?.email && (
              <p className="w-[160px] truncate text-[10px] text-neutral-400 font-mono">
                {user.email}
              </p>
            )}
          </div>
        </div>
        
        <div className="p-1">
          <DropdownMenuItem asChild className="cursor-pointer rounded-none focus:bg-white/10 focus:text-white mb-0.5">
            <Link href="/account" className="flex items-center w-full py-2 px-2">
              <User className="h-3.5 w-3.5 mr-3 text-neutral-400" />
              <span className="text-xs tracking-widest uppercase text-white/80">Account</span>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild className="cursor-pointer rounded-none focus:bg-white/10 focus:text-white mb-0.5">
             <Link href="/bookings" className="flex items-center w-full py-2 px-2">
              <CalendarDays className="h-3.5 w-3.5 mr-3 text-neutral-400" />
              <span className="text-xs tracking-widest uppercase text-white/80">Booking History</span>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem className="cursor-pointer rounded-none focus:bg-white/10 focus:text-white mb-0.5 py-2 px-2">
            <Bell className="h-3.5 w-3.5 mr-3 text-neutral-400" />
            <span className="text-xs tracking-widest uppercase text-white/80">Notifications</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10 my-1" />
          
          <LogoutButton>
            <DropdownMenuItem className="text-red-500 focus:text-red-400 focus:bg-red-500/10 cursor-pointer rounded-none py-2 px-2">
              <LogOut className="h-3.5 w-3.5 mr-3" />
              <span className="text-xs tracking-widest uppercase">Log out</span>
            </DropdownMenuItem>
          </LogoutButton>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
