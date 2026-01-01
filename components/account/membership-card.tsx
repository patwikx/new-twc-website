"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Crown, Star, Award, Gem } from "lucide-react";

interface MembershipCardProps {
  membership?: {
    tier: "STANDARD" | "SILVER" | "GOLD" | "PLATINUM";
    points: number;
  } | null;
  userName?: string | null;
  oderId?: string;
}

const tierConfig = {
  STANDARD: {
    label: "Standard Member",
    subtitle: "Welcome to Tropicana Rewards",
    icon: Star,
    gradient: "from-neutral-700 via-neutral-600 to-neutral-700",
    iconBg: "from-neutral-400 to-neutral-500",
    iconShadow: "shadow-neutral-500/20",
    accentColor: "text-neutral-400",
  },
  SILVER: {
    label: "Silver Member",
    subtitle: "1,000+ Points",
    icon: Award,
    gradient: "from-slate-600 via-slate-500 to-slate-600",
    iconBg: "from-slate-300 to-slate-400",
    iconShadow: "shadow-slate-400/20",
    accentColor: "text-slate-300",
  },
  GOLD: {
    label: "Gold Member",
    subtitle: "5,000+ Points",
    icon: Crown,
    gradient: "from-neutral-900 via-neutral-800 to-neutral-900",
    iconBg: "from-yellow-400 to-yellow-600",
    iconShadow: "shadow-yellow-500/20",
    accentColor: "text-yellow-500/80",
  },
  PLATINUM: {
    label: "Platinum Member",
    subtitle: "10,000+ Points",
    icon: Gem,
    gradient: "from-neutral-900 via-neutral-800 to-neutral-900",
    iconBg: "from-purple-300 to-purple-500",
    iconShadow: "shadow-purple-400/20",
    accentColor: "text-purple-300",
  },
};

export const MembershipCard = ({ membership, userName, oderId }: MembershipCardProps) => {
  const tier = membership?.tier || "STANDARD";
  const points = membership?.points || 0;
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <Card className={`w-full overflow-hidden relative border-none rounded-xl bg-gradient-to-br ${config.gradient} shadow-2xl`}>
      {/* Glow Effect Overlay */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

      <CardContent className="p-8 relative z-10">
        <div className="flex justify-between items-start mb-12">
          <div className="space-y-1">
            <h3 className={`text-sm font-medium ${config.accentColor} tracking-[0.2em] uppercase`}>Tropicana Rewards</h3>
            <p className="text-2xl font-serif text-white tracking-wide">{config.label}</p>
          </div>
          <div className={`bg-gradient-to-br ${config.iconBg} p-3 rounded-full shadow-lg ${config.iconShadow}`}>
            <Icon className="text-neutral-950 h-5 w-5" />
          </div>
        </div>

        <div className="flex flex-col gap-1 mb-6">
           <span className="text-5xl font-light text-white tracking-tight">{points.toLocaleString()}</span>
           <span className="text-xs uppercase tracking-widest text-neutral-400">Points Available</span>
        </div>

        <div className="flex justify-between items-end pt-6 border-t border-white/5">
           <div>
             <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Member Name</p>
             <p className="font-medium text-white tracking-wider">{userName || "Guest"}</p>
           </div>
           <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Member ID</p>
              <p className="font-mono text-xs text-neutral-300">TWC-{oderId?.slice(0, 8).toUpperCase() || "XXXXXXXX"}</p>
           </div>
        </div>
      </CardContent>
    </Card>
  );
};
