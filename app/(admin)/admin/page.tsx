import { db } from "@/lib/db";
import { DollarSign, Eye, ShoppingBag, Users } from "lucide-react";
import { format } from "date-fns";
import { hasPermission } from "@/lib/auth-checks";
import { getCurrentPropertyFilter } from "@/lib/data-access";

// Helper to aggregate revenue by month from items
function getMonthlyRevenue(items: any[]) {
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const chartData = months.map(name => ({ name, total: 0 }));

    items.forEach(item => {
        const monthIndex = new Date(item.booking.createdAt).getMonth();
        const days = Math.max(1, Math.ceil((new Date(item.checkOut).getTime() - new Date(item.checkIn).getTime()) / (1000 * 60 * 60 * 24)));
        const itemTotal = Number(item.pricePerNight) * days;
        chartData[monthIndex].total += itemTotal;
    });

    return chartData;
}

async function getStats() {
    const propertyWhere = await getCurrentPropertyFilter();
    
    // Build filter for Bookings that contain relevant items
    const bookingFilter: any = {};
    // Build filter for BookingItems specifically (for revenue)
    const itemFilter: any = {};

    if (propertyWhere.id) {
        // If propertyWhere.id is an object (like { in: [...] }) or string
        const propIdFilter = propertyWhere.id;
        
        // Filter bookings that have AT LEAST ONE item from this property scope
        bookingFilter.items = {
            some: {
                room: {
                    propertyId: propIdFilter
                }
            }
        };

        // Filter items that belong to this property scope
        itemFilter.room = {
            propertyId: propIdFilter
        };
    }

    // 1. Counts (Unique Bookings)
    // We count bookings that contain relevant rooms
    const bookingCount = await db.booking.count({ where: bookingFilter });
    
    const propertyCount = await db.property.count({ where: propertyWhere });
    
    const confirmedCount = await db.booking.count({ 
        where: { 
            ...bookingFilter, 
            status: { in: ['CONFIRMED', 'COMPLETED'] } 
        } 
    });

    // 2. Revenue (Confirmed or Completed only)
    // We fetch ITEMS directly to get precise revenue split
    const revenueItems = await db.bookingItem.findMany({
        where: {
            ...itemFilter,
            booking: {
                status: { in: ['CONFIRMED', 'COMPLETED'] }
            }
        },
        select: {
            pricePerNight: true,
            checkIn: true,
            checkOut: true
        }
    });

    const totalRevenue = revenueItems.reduce((acc, item) => {
        const days = Math.max(1, Math.ceil((new Date(item.checkOut).getTime() - new Date(item.checkIn).getTime()) / (1000 * 60 * 60 * 24)));
        return acc + (Number(item.pricePerNight) * days);
    }, 0);

    // 3. Recent Sales (Last 5)
    // Showing bookings that have relevant items. 
    // displayAmount should reflect the RELEVANT amount for this property view, not total booking amount.
    const recentBookings = await db.booking.findMany({
        where: {
             ...bookingFilter,
             status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { 
            user: true,
            items: {
                where: itemFilter, // Only fetch items relevant to current view
                include: { room: true }
            }
        } 
    });

    const recentSales = recentBookings.map(b => {
        // Calculate relevant total for this dashboard view
        const relevantTotal = b.items.reduce((acc, item) => {
             const days = Math.max(1, Math.ceil((new Date(item.checkOut).getTime() - new Date(item.checkIn).getTime()) / (1000 * 60 * 60 * 24)));
             return acc + (Number(item.pricePerNight) * days);
        }, 0);

        return {
            id: b.id,
            name: b.guestFirstName + " " + b.guestLastName,
            email: b.guestEmail,
            amount: relevantTotal,
            avatar: b.user?.image || undefined
        };
    });

    // 4. Monthly Chart Data (Current Year)
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    // Fetch items for chart
    const yearlyItems = await db.bookingItem.findMany({
        where: {
            ...itemFilter,
            booking: {
                status: { in: ['CONFIRMED', 'COMPLETED'] },
                createdAt: {
                    gte: startOfYear,
                    lte: endOfYear
                }
            }
        },
        select: {
            pricePerNight: true,
            checkIn: true,
            checkOut: true,
            bookingId: true,
            booking: {
                select: { createdAt: true }
            }
        }
    });

    const chartData = getMonthlyRevenue(yearlyItems);
    
    // Calculate sales count for "Recent Sales" card text (this month)
    const thisMonthSalesCount = yearlyItems.filter(item => 
        new Date(item.booking.createdAt).getMonth() === new Date().getMonth()
    ).length; // Note: This counts ITEMS sold, which might be higher than bookings. 
    // To match legacy "Sales" count (Bookings), we should count unique bookings.
    
    const thisMonthUniqueBookings = new Set(yearlyItems.filter(item => 
        new Date(item.booking.createdAt).getMonth() === new Date().getMonth()
    ).map(i => (i as any).bookingId)).size;
    // Note: bookingId isn't selected above, let's add it if we want strict count, 
    // or just assume 'sales' text can mean 'bookings' roughly. 
    // Let's improve the query above to include bookingId for distinct count.

    // Correction: Let's simpler fetch for the count to be accurate
    const thisMonthBookingCount = await db.booking.count({
        where: {
            ...bookingFilter,
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
            }
        }
    });


  return {
    bookingCount,
    propertyCount,
    confirmedBookings: confirmedCount,
    totalRevenue,
    recentSales,
    chartData,
    thisMonthSalesCount: thisMonthBookingCount
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
