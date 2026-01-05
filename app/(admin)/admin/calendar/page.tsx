import { hasPermission, getCurrentRole } from "@/lib/auth-checks";
import { redirect } from "next/navigation";
import { getCalendarData } from "@/actions/admin/front-desk";
import { getCurrentPropertyFilter } from "@/lib/data-access";
import { CalendarView } from "@/components/admin/calendar/calendar-view";

export default async function CalendarPage() {
  const role = await getCurrentRole();
  const propertyFilter = await getCurrentPropertyFilter();

  const canView = await hasPermission("bookings:view");
  if (!canView) {
    redirect("/admin");
  }

  if (!propertyFilter.id) {
    return (
       <div className="p-8 text-center pt-20">
          <h2 className="text-xl font-bold">Please select a property.</h2>
          <p className="text-muted-foreground">The calendar view requires a specific property context.</p>
       </div>
    );
 }

  // Initial Data Fetch
  const initialCalendarData = await getCalendarData(propertyFilter.id as string, new Date());

  return (
    <div className="pt-2">
      <CalendarView 
        initialData={initialCalendarData} 
        propertyId={propertyFilter.id as string}
      />
    </div>
  );
}
