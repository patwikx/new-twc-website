import { db } from "@/lib/db";
import { DollarSign, Eye, ShoppingBag, Users } from "lucide-react";
import { format } from "date-fns";
import { hasPermission } from "@/lib/auth-checks";
import { getCurrentPropertyFilter } from "@/lib/data-access";

// Helper to aggregate revenue by month
function getMonthlyRevenue(bookings: any[]) {
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const chartData = months.map(name => ({ name, total: 0 }));

    bookings.forEach(booking => {
        const monthIndex = new Date(booking.createdAt).getMonth();
        chartData[monthIndex].total += Number(booking.totalAmount);
    });

    return chartData;
}

async function getStats() {
    const propertyWhere = await getCurrentPropertyFilter();

    // Mapping property filter (defaults to id) to booking propertyId
    // propertyWhere might be { id: ... } or { id: { in: ... } }
    const bookingWhere: any = {};
    
    if (propertyWhere.id) {
        bookingWhere.propertyId = propertyWhere.id;
    }

    // 1. Counts
    const bookingCount = await db.booking.count({ where: bookingWhere });
    
    const propertyCount = await db.property.count({ where: propertyWhere });
    
    const confirmedCount = await db.booking.count({ 
        where: { 
            ...bookingWhere, 
            status: { in: ['CONFIRMED', 'COMPLETED'] } 
        } 
    });

    // 2. Revenue (Confirmed or Completed only)
    const revenueAgg = await db.booking.aggregate({
        where: {
            ...bookingWhere,
            status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        _sum: {
            totalAmount: true
        }
    });
    const totalRevenue = Number(revenueAgg._sum.totalAmount || 0);

    // 3. Recent Sales (Last 5)
    const recentBookings = await db.booking.findMany({
        where: {
             ...bookingWhere,
             status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: true } // to get name/email if linked
    });

    const recentSales = recentBookings.map(b => ({
        id: b.id,
        name: b.guestFirstName + " " + b.guestLastName,
        email: b.guestEmail,
        amount: Number(b.totalAmount),
        avatar: b.user?.image || undefined
    }));

    // 4. Monthly Chart Data (Current Year)
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const yearlyBookings = await db.booking.findMany({
        where: {
            ...bookingWhere,
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            createdAt: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        select: {
            createdAt: true,
            totalAmount: true
        }
    });

    const chartData = getMonthlyRevenue(yearlyBookings);
    
    // Calculate sales count for "Recent Sales" card text (this month)
    const thisMonthSalesCount = yearlyBookings.filter(b => 
        new Date(b.createdAt).getMonth() === new Date().getMonth()
    ).length;


  return {
    bookingCount,
    propertyCount,
    confirmedBookings: confirmedCount,
    totalRevenue,
    recentSales,
    chartData,
    thisMonthSalesCount
  };
}

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Overview } from "@/components/admin/overview";
import { RecentSales } from "@/components/admin/recent-sales";

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const canViewProperties = await hasPermission("properties:view");
  const canViewBookings = await hasPermission("bookings:view");
  const canViewPayments = await hasPermission("payments:view");

  return (
    <div className="space-y-4">
       <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">Welcome back. Here's what's happening today.</p>
       </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {canViewBookings && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Bookings
                </CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.bookingCount}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>
          )}
          {canViewBookings && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Confirmed Stays
                </CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.confirmedBookings}</div>
                <p className="text-xs text-muted-foreground">
                  Visits
                </p>
              </CardContent>
            </Card>
          )}
          {canViewProperties && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.propertyCount}</div>
                <p className="text-xs text-muted-foreground">
                  In your scope
                </p>
              </CardContent>
            </Card>
          )}
           {canViewPayments && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₱{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">
                  Gross Volume
                </p>
              </CardContent>
            </Card>
          )}
       </div>
       
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                 <Overview data={stats.chartData} />
              </CardContent>
          </Card>
          <Card className="col-span-3">
              <CardHeader>
                  <CardTitle>Recent Sales</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    You made {stats.thisMonthSalesCount} sales this month.
                  </p>
              </CardHeader>
              <CardContent>
                  <RecentSales sales={stats.recentSales} />
              </CardContent>
          </Card>
       </div>
    </div>
  );
}

// Helper icons needed imports
import { CalendarDays, Building2 } from "lucide-react";
