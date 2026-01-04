"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ShiftsTable } from "@/components/admin/pos/shifts-table";
import { OpenShiftDialog } from "@/components/admin/pos/open-shift-dialog";
import { CloseShiftDialog } from "@/components/admin/pos/close-shift-dialog";
import { ShiftReport } from "@/components/admin/pos/shift-report";
import { ShiftStatus } from "@prisma/client";
import { Clock, PlayCircle, StopCircle, Store } from "lucide-react";
import Link from "next/link";

interface ShiftData {
  id: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string | null;
  startingCash: number;
  endingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  status: ShiftStatus;
  openedAt: Date;
  closedAt: Date | null;
  orderCount: number;
}

interface Outlet {
  id: string;
  name: string;
}

interface CurrentShift {
  id: string;
  outletId: string;
  outletName: string;
  startingCash: number;
  openedAt: Date;
}

interface ShiftsPageClientProps {
  shifts: ShiftData[];
  outlets: Outlet[];
  currentUserId: string;
  currentUserName: string;
  currentShift: CurrentShift | null;
}

export function ShiftsPageClient({
  shifts,
  outlets,
  currentUserId,
  currentUserName,
  currentShift,
}: ShiftsPageClientProps) {
  const [openShiftDialogOpen, setOpenShiftDialogOpen] = React.useState(false);
  const [closeShiftDialogOpen, setCloseShiftDialogOpen] = React.useState(false);
  const [reportShiftId, setReportShiftId] = React.useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDuration = (start: Date) => {
    const diff = Date.now() - new Date(start).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // If no outlets, show setup message
  if (outlets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Store className="h-16 w-16 text-neutral-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No Sales Outlets</h2>
        <p className="text-neutral-400 mb-6 max-w-md">
          You need to create at least one sales outlet before you can manage shifts.
        </p>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link href="/admin/pos/outlets/new">Create Outlet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Shift Management</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage cashier shifts and cash reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentShift ? (
            <Button
              onClick={() => setCloseShiftDialogOpen(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Close Shift
            </Button>
          ) : (
            <Button
              onClick={() => setOpenShiftDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Open Shift
            </Button>
          )}
        </div>
      </div>

      {/* Current Shift Banner */}
      {currentShift && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-400">
                  Your shift is currently open
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {currentShift.outletName} • Started {formatDuration(currentShift.openedAt)} ago •
                  Starting cash: {formatCurrency(currentShift.startingCash)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-green-500/30 text-green-400 hover:bg-green-500/20"
              onClick={() => setCloseShiftDialogOpen(true)}
            >
              Close Shift
            </Button>
          </div>
        </div>
      )}

      {/* Shifts Table */}
      <ShiftsTable
        shifts={shifts}
        outlets={outlets}
        onViewReport={(shiftId) => setReportShiftId(shiftId)}
      />

      {/* Open Shift Dialog */}
      <OpenShiftDialog
        open={openShiftDialogOpen}
        onOpenChange={setOpenShiftDialogOpen}
        outlets={outlets}
        cashierId={currentUserId}
        cashierName={currentUserName}
      />

      {/* Close Shift Dialog */}
      {currentShift && (
        <CloseShiftDialog
          open={closeShiftDialogOpen}
          onOpenChange={setCloseShiftDialogOpen}
          shiftId={currentShift.id}
          outletName={currentShift.outletName}
          startingCash={currentShift.startingCash}
          openedAt={currentShift.openedAt}
        />
      )}

      {/* Shift Report Dialog */}
      {reportShiftId && (
        <ShiftReport
          open={!!reportShiftId}
          onOpenChange={(open) => !open && setReportShiftId(null)}
          shiftId={reportShiftId}
        />
      )}
    </div>
  );
}
