import { auth } from "@/auth";
import { getBookingsByUserId } from "@/data/booking";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { CompletePaymentButton } from "@/components/booking/CompletePaymentButton";

const BookingsPage = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
     return (
        <div className="min-h-screen bg-black pt-32 px-10 text-white flex flex-col items-center justify-center">
             <h1 className="text-2xl mb-4">You must be logged in to view bookings.</h1>
             <div className="flex flex-col sm:flex-row gap-4 items-center">
               <Button asChild variant="outline" className="rounded-none border-white/20 text-white hover:bg-white hover:text-black transition-colors uppercase tracking-widest text-xs h-12 px-8">
                   <Link href="/auth/login">Login Now</Link>
               </Button>
               <span className="text-neutral-500 text-sm">or</span>
               <Button asChild variant="link" className="text-orange-500 hover:text-orange-400 uppercase tracking-widest text-xs h-12 px-4">
                   <Link href="/bookings/lookup">Look Up a Booking</Link>
               </Button>
             </div>
             <p className="text-neutral-500 text-sm mt-6 text-center max-w-md">
               Booked without an account? Use your booking reference and email to look up your reservation.
             </p>
        </div>
     )
  }

  const bookings = await getBookingsByUserId(userId);

  return ( 
    <div className="min-h-screen bg-black w-full">
      <div className="pt-32 pb-20 px-6 md:px-10 text-white max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-serif text-white">Booking History</h1>
              <p className="text-neutral-400">View and manage your past and upcoming stays.</p>
            </div>
            <Button asChild className="rounded-none bg-orange-600 hover:bg-orange-700 text-white transition-colors uppercase tracking-widest text-xs h-12 px-8">
               <Link href="/">Book New Stay</Link>
            </Button>
        </div>

        {!bookings || bookings.length === 0 ? (
          <div className="p-16 border-none bg-transparent text-center space-y-6">
            <CalendarDays className="h-16 w-16 mx-auto text-neutral-700" />
            <div className="space-y-2">
               <h2 className="text-xl font-medium text-white">No bookings found</h2>
               <p className="text-neutral-400 text-sm max-w-sm mx-auto">
                 You haven't made any reservations with us yet. Start your journey with Tropicana today.
               </p>
            </div>
            <Button asChild variant="outline" className="rounded-none border-white/20 text-white hover:bg-white hover:text-black transition-colors uppercase tracking-widest text-xs h-12 px-8">
               <Link href="/">Explore Rooms</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
             {bookings.map((booking) => (
               <Card key={booking.id} className="bg-black border-white/10 rounded-none overflow-hidden group hover:border-orange-500/30 transition-colors">
                 <div className="flex flex-col md:flex-row">
                    {/* Image Section (First Room) */}
                    <div className="w-full md:w-1/3 h-64 md:h-auto relative">
                       {/* Placeholder for room image - using gradient for now if data missing */}
                        <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                           <CalendarDays className="text-neutral-700 h-10 w-10" />
                        </div>
                        {booking.items[0]?.room?.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={booking.items[0].room.image} 
                              alt={booking.items[0].room.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                            />
                        )}
                        <div className="absolute top-4 left-4">
                           <Badge 
                             className={`rounded-none uppercase tracking-widest text-[10px] px-3 py-1 border-0 ${
                               booking.status === 'CONFIRMED' ? 'bg-green-900/80 text-green-300' :
                               booking.status === 'PENDING' ? 'bg-yellow-900/80 text-yellow-300' :
                               booking.status === 'COMPLETED' ? 'bg-blue-900/80 text-blue-300' :
                               'bg-red-900/80 text-red-300'
                             }`}
                           >
                             {booking.status}
                           </Badge>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col justify-between">
                       <div className="space-y-6">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="text-xs uppercase tracking-widest text-orange-500 mb-1">
                                  Reference: {booking.shortRef || booking.id.slice(0, 8).toUpperCase()}
                                </p>
                                <h3 className="text-2xl font-serif text-white">
                                   {booking.items[0]?.room.name || "Room Booking"}
                                   {booking.items.length > 1 && <span className="text-sm font-sans text-neutral-500 ml-2">({booking.items.length} rooms)</span>}
                                </h3>
                             </div>
                             <div className="text-right">
                                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Total</p>
                                <p className="text-xl font-medium text-white">
                                  {Number(booking.totalAmount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                                </p>
                             </div>
                          </div>

                          <Separator className="bg-white/10" />

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                             <div>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" /> Check In
                                </p>
                                <p className="text-sm text-neutral-200">{format(new Date(booking.items[0]?.checkIn || new Date()), 'MMM dd, yyyy')}</p>
                             </div>
                             <div>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" /> Check Out
                                </p>
                                <p className="text-sm text-neutral-200">{format(new Date(booking.items[0]?.checkOut || new Date()), 'MMM dd, yyyy')}</p>
                             </div>
                             <div>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 flex items-center gap-1">
                                  <Users className="h-3 w-3" /> Guests
                                </p>
                                <p className="text-sm text-neutral-200">
                                  {booking.items.reduce((acc, item) => acc + item.guests, 0)} Guests
                                </p>
                             </div>
                             <div>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> Location
                                </p>
                                <p className="text-sm text-neutral-200">General Santos</p>
                             </div>
                          </div>
                       </div>
                       
                       <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                           <Button asChild variant="link" className="text-white hover:text-orange-500 p-0 h-auto font-normal text-xs uppercase tracking-widest group-hover:underline decoration-orange-500/50 underline-offset-4 decoration-1 transition-all">
                              <Link href={`/bookings/${booking.id}`}>
                                 View Booking Details <ArrowRight className="ml-2 h-3 w-3" />
                              </Link>
                           </Button>
                       </div>
                    </div>
                 </div>
               </Card>
             ))}
          </div>
        )}
      </div>
    </div>
   );
}
 
export default BookingsPage;
