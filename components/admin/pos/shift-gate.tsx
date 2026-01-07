"use client";

import * as React from "react";
import { usePOSStore, ActiveShift } from "@/store/usePOSStore";
import { OpenShiftDialog } from "./open-shift-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  User, 
  Store, 
  Banknote, 
  LogOut,
  ShieldAlert,
  PlayCircle,
  FileText 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CloseShiftWizard } from "./close-shift-wizard";
import { XReadingDialog } from "./x-reading-dialog";
import { 
  getShiftSummary, 
  closeShift, 
  handoverShift,
  generateXReading 
} from "@/lib/pos/shift-reading";
import { toast } from "sonner";

interface Outlet {
  id: string;
  name: string;
}

interface Cashier {
  id: string;
  name: string | null;
}

interface ShiftGateProps {
  children: React.ReactNode;
  outlets: Outlet[];
  selectedOutletId?: string;
  cashierId: string;
  cashierName: string;
  userRole: string;
  currentShift?: {
    id: string;
    outletId: string;
    outletName: string;
    type: "DAY" | "NIGHT";
    startingCash: number;
    openedAt: Date;
  } | null;
  onCloseShift?: () => void;
  availableCashiers?: Cashier[];
}

const ALLOWED_ROLES = ["ADMIN", "CASHIER", "MANAGER", "Super Admin"];

export function ShiftGate({
  children,
  outlets,
  selectedOutletId,
  cashierId,
  cashierName,
  userRole,
  currentShift,
  onCloseShift,
  availableCashiers = [],
}: ShiftGateProps) {
  const { activeShift, setShift, clearShift } = usePOSStore();
  const [showOpenDialog, setShowOpenDialog] = React.useState(false);
  
  // Close Shift & X Reading state
  const [showCloseWizard, setShowCloseWizard] = React.useState(false);
  const [showXReading, setShowXReading] = React.useState(false);
  const [shiftSummary, setShiftSummary] = React.useState<any>(null);
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(false);
  const [shiftSales, setShiftSales] = React.useState<number>(0);

  // Fetch shift sales on mount and every 30 seconds
  React.useEffect(() => {
    const shiftId = activeShift?.id || currentShift?.id;
    
    // Reset sales if no active shift
    if (!shiftId) {
      setShiftSales(0);
      return;
    }

    let isCancelled = false;

    const fetchSales = async () => {
      try {
        const summary = await getShiftSummary(shiftId);
        if (!isCancelled && summary) {
          setShiftSales(summary.totalSales || 0);
        }
      } catch (error) {
        // Silently ignore "Shift is already closed" errors
        // This happens when the shift is closed but the interval hasn't been cleared yet
        if (error instanceof Error && error.message.includes('closed')) {
          return;
        }
        console.error('Failed to fetch shift sales:', error);
      }
    };

    fetchSales(); // Initial fetch
    const interval = setInterval(fetchSales, 30000); // Refresh every 30 seconds
    
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [activeShift?.id, currentShift?.id]);

  // Sync server-side shift with store on mount
  React.useEffect(() => {
    if (currentShift && !activeShift) {
      setShift({
        id: currentShift.id,
        outletId: currentShift.outletId,
        outletName: currentShift.outletName,
        cashierId,
        cashierName,
        type: currentShift.type,
        startingCash: currentShift.startingCash,
        openedAt: currentShift.openedAt,
      });
    } else if (!currentShift && activeShift) {
      // If server says no shift but client has one, clear it (session expired/closed elsewhere)
      clearShift();
    }
  }, [currentShift, activeShift, setShift, clearShift, cashierId, cashierName]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (date: Date) => {
    return format(new Date(date), "h:mm a");
  };

  const formatDuration = (startDate: Date) => {
    const now = new Date();
    const start = new Date(startDate);
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleOpenCloseWizard = async () => {
    if (!activeShift) return;
    
    setIsLoadingSummary(true);
    try {
      const summary = await getShiftSummary(activeShift.id);
      setShiftSummary(summary);
      setShowCloseWizard(true);
    } catch {
      toast.error("Failed to load shift summary");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleCloseShift = async (data: any) => {
    if (!activeShift) return;
    
    const result = await closeShift({
      shiftId: activeShift.id,
      endingCash: data.endingCash,
      variance: data.variance,
      notes: data.notes,
    });

    if (!result.success) {
      toast.error(result.error || "Failed to close shift");
      return;
    }
    
    toast.success("Shift closed successfully");
    clearShift();
    if (onCloseShift) onCloseShift();
  };

  const handleHandoverShift = async (data: any) => {
    if (!activeShift) return;

    await handoverShift({
      shiftId: activeShift.id,
      endingCash: data.endingCash,
      variance: data.variance,
      notes: data.notes,
      handoverToId: data.handoverToId,
      handoverNotes: data.handoverNotes,
    });

    clearShift();
    if (onCloseShift) onCloseShift();
  };

  // Check if user has permission to access POS
  const hasPermission = ALLOWED_ROLES.includes(userRole);

  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Card className="bg-red-500/10 border-red-500/20 max-w-md">
          <CardHeader>
            <div className="mx-auto mb-4">
              <ShieldAlert className="h-12 w-12 text-red-400" />
            </div>
            <CardTitle className="text-red-400">Access Denied</CardTitle>
            <CardDescription className="text-red-400/70">
              You don&apos;t have permission to access the POS terminal.
              Only Cashiers, Managers, and Admins can use this feature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-400">
              Current role: <Badge variant="outline" className="ml-1">{userRole}</Badge>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if no outlets available
  if (outlets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Card className="bg-neutral-900/50 border-white/10 max-w-md">
          <CardHeader>
            <div className="mx-auto mb-4">
              <Store className="h-12 w-12 text-neutral-600" />
            </div>
            <CardTitle>No Sales Outlets</CardTitle>
            <CardDescription>
              There are no active sales outlets configured for this property.
              Please contact an administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Check if shift is open
  const shift = activeShift || (currentShift ? {
    id: currentShift.id,
    outletId: currentShift.outletId,
    outletName: currentShift.outletName,
    cashierId,
    cashierName,
    type: currentShift.type,
    startingCash: currentShift.startingCash,
    openedAt: currentShift.openedAt,
  } : null);

  if (!shift) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Card className="bg-neutral-900/50 border-white/10 max-w-md">
            <CardHeader>
              <div className="mx-auto mb-4">
                <Clock className="h-12 w-12 text-orange-400" />
              </div>
              <CardTitle>No Active Shift</CardTitle>
              <CardDescription>
                You need to open a shift before you can use the POS terminal.
                Count your starting cash drawer and select an outlet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setShowOpenDialog(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Open Shift
              </Button>
              <p className="text-xs text-neutral-500">
                Opening a shift will record your starting cash and track all transactions.
              </p>
            </CardContent>
          </Card>
        </div>

        <OpenShiftDialog
          open={showOpenDialog}
          onOpenChange={setShowOpenDialog}
          outlets={outlets}
          defaultOutletId={selectedOutletId}
          cashierId={cashierId}
          cashierName={cashierName}
        />
      </>
    );
  }

  // Shift is active - show shift info bar and children
  return (
    <div className="space-y-4">
      {/* Shift Info Bar */}
      <div className="flex items-center justify-between p-3 bg-neutral-900/50 border border-white/10 rounded-lg">
        <div className="flex items-center gap-6">
          {/* Shift Status */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-400">
              Shift Active
            </span>
          </div>

          {/* Outlet */}
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Store className="h-4 w-4" />
            <span>{shift?.outletName || "No Shift"}</span>
          </div>

          {/* Shift Type */}
          {shift && (
              <Badge 
                variant="outline" 
                className={cn(
                "text-xs",
                shift.type === "DAY" 
                    ? "border-yellow-500/30 text-yellow-400" 
                    : "border-blue-500/30 text-blue-400"
                )}
              >
                {shift.type} SHIFT
              </Badge>
          )}

          {/* Cashier */}
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <User className="h-4 w-4" />
            <span>{shift?.cashierName || cashierName}</span>
          </div>

          {/* Started At */}
          {shift && (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Clock className="h-4 w-4" />
                <span>Started {formatTime(shift.openedAt)}</span>
                <span className="text-neutral-600">•</span>
                <span>{formatDuration(shift.openedAt)}</span>
            </div>
          )}

          {/* Starting Cash & Sales */}
          {shift && (
            <div className="flex items-center gap-2 text-sm">
                <Banknote className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-400">{formatCurrency(shift.startingCash)}</span>
                {shiftSales > 0 && (
                  <>
                    <span className="text-neutral-600">•</span>
                    <span className="text-green-400 font-medium">+{formatCurrency(shiftSales)}</span>
                  </>
                )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-neutral-400 hover:text-white"
            onClick={() => setShowXReading(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            X Reading
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={handleOpenCloseWizard}
            disabled={isLoadingSummary}
          >
            {isLoadingSummary ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            Close Shift
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      {children}

      {/* Dialogs */}
      {shiftSummary && (
        <CloseShiftWizard
          open={showCloseWizard}
          onOpenChange={setShowCloseWizard}
          shiftId={shift.id}
          cashierId={cashierId}
          cashierName={cashierName}
          shiftSummary={shiftSummary}
          availableCashiers={availableCashiers}
          onCloseShift={handleCloseShift}
          onHandoverShift={handleHandoverShift}
        />
      )}

      <XReadingDialog
        open={showXReading}
        onOpenChange={setShowXReading}
        shiftId={shift.id}
        onGenerateReading={() => generateXReading(shift.id).then(r => r.data!)}
      />
    </div>
  );
}
