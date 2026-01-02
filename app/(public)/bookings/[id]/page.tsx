import { auth } from "@/auth";
import { getBookingById } from "@/data/booking";
import { getGlobalConfig } from "@/actions/public/properties";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  CalendarDays, 
  MapPin, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Download,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CompletePaymentButton } from "@/components/booking/CompletePaymentButton";
import { DownloadReceiptButton } from "@/components/booking/DownloadReceiptButton";
import { CancelBookingButton } from "@/components/booking/CancelBookingButton";

export default async function BookingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const resolvedParams = await params;
  const [booking, config] = await Promise.all([
     getBookingById(resolvedParams.id),
     getGlobalConfig()
  ]);

  if (!booking) {
    return (
      <div className="min-h-screen bg-neutral-950 pt-32 px-4 flex flex-col items-center justify-center text-white">
        <h1 className="text-2xl mb-4 font-serif">Booking Not Found</h1>
        <p className="text-neutral-400 mb-8">The booking you are looking for does not exist or you do not have permission to view it.</p>
        <Button asChild variant="outline" className="text-white border-white/20">
          <Link href="/bookings">Return to Bookings</Link>
        </Button>
      </div>
    );
  }

  // Ensure user owns this booking
  if (booking.userId !== session.user.id) {
     return (
        <div className="min-h-screen bg-neutral-950 pt-32 px-4 flex flex-col items-center justify-center text-white">
           <h1 className="text-2xl mb-4 font-serif">Unauthorized</h1>
           <p className="text-neutral-400 mb-8">You do not have permission to view this booking.</p>
           <Button asChild variant="outline" className="text-white border-white/20">
              <Link href="/bookings">Return to Bookings</Link>
           </Button>
        </div>
     );
  }

  const checkIn = booking.items[0]?.checkIn ? new Date(booking.items[0].checkIn) : new Date();
  const checkOut = booking.items[0]?.checkOut ? new Date(booking.items[0].checkOut) : new Date();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-900/50 text-green-300 border-green-800/50';
      case 'PENDING': return 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50';
      case 'COMPLETED': return 'bg-blue-900/50 text-blue-300 border-blue-800/50';
      case 'CANCELLED': return 'bg-red-900/50 text-red-300 border-red-800/50';
      default: return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  const getPaymentStatusColor = (status: string) => {
     switch (status) {
        case 'PAID': return 'text-green-400';
        case 'PARTIALLY_PAID': return 'text-yellow-400';
        case 'UNPAID': return 'text-red-400';
        case 'REFUNDED': return 'text-blue-400';
        case 'FAILED': return 'text-red-500';
        default: return 'text-neutral-400';
     }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white w-full">
      <div className="pt-32 pb-20 px-4 md:px-10 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
           <Link href="/bookings" className="text-neutral-400 hover:text-white flex items-center gap-2 text-xs uppercase tracking-widest mb-6 transition-colors">
              <ArrowLeft className="h-3 w-3" /> Back to My Bookings
           </Link>
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                 <p className="text-xs uppercase tracking-widest text-orange-500 mb-2">Booking Reference</p>
                 <h1 className="text-3xl md:text-4xl font-serif text-white flex items-center gap-4">
                    {booking.shortRef}
                    <Badge variant="outline" className={`rounded-none px-3 py-1 text-xs uppercase tracking-widest border ${getStatusColor(booking.status)}`}>
                       {booking.status}
                    </Badge>
                 </h1>
              </div>
              <div className="flex gap-3">
                 {booking.status === 'CONFIRMED' && (
                    <DownloadReceiptButton 
                       booking={booking}
                       taxRate={config.taxRate}
                       serviceChargeRate={config.serviceChargeRate}
                       className="border-white/20 text-white hover:bg-white hover:text-black h-12"
                    />
                 )}
                 {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                     <CancelBookingButton 
                        bookingId={booking.id}
                        checkInDate={checkIn}
                        status={booking.status}
                        amountPaid={Number(booking.amountPaid)}
                        paymentStatus={booking.paymentStatus}
                     />
                 )}
                 {/* Only show 'Pay Now' if there is a balance due and status is not cancelled */}
                 {Number(booking.amountDue) > 0 && booking.status !== 'CANCELLED' && (
                    <CompletePaymentButton 
                       bookingId={booking.id} 
                       className="bg-orange-600 hover:bg-orange-700 text-white h-12" 
                    />
                 )}
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           
           {/* Left Column: Stay Details */}
           <div className="lg:col-span-2 space-y-8">
              
              {/* Property Card */}
              <Card className="bg-white/5 border-white/10 rounded-none overflow-hidden">
                 <div className="relative h-64 w-full">
                    {booking.items[0]?.room?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                           src={booking.items[0].room.image} 
                           alt={booking.items[0].room.name}
                           className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                           <CalendarDays className="h-12 w-12 text-neutral-700" />
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 pt-20">
                       <h2 className="text-2xl font-serif">{booking.property?.name || "Premium Property"}</h2>
                       <p className="text-neutral-300 flex items-center gap-2 text-sm mt-1">
                          <MapPin className="h-4 w-4 text-orange-500" />
                          {booking.property?.location || "General Santos City"}
                       </p>
                    </div>
                 </div>
                 <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                           <div>
                              <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Room Type</p>
                              <p className="text-lg font-medium">{booking.items[0]?.room?.name || "Standard Room"}</p>
                              {booking.items.length > 1 && (
                                 <p className="text-xs text-neutral-400 mt-1">+ {booking.items.length - 1} other room(s)</p>
                              )}
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Check In</p>
                                 <p className="text-sm">{format(checkIn, 'MMM dd, yyyy')}</p>
                                 <p className="text-xs text-neutral-500">From 2:00 PM</p>
                              </div>
                              <div>
                                 <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Check Out</p>
                                 <p className="text-sm">{format(checkOut, 'MMM dd, yyyy')}</p>
                                 <p className="text-xs text-neutral-500">Until 12:00 PM</p>
                              </div>
                           </div>
                       </div>
                       <div className="space-y-6">
                          <div>
                             <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Guest Details</p>
                             <div className="space-y-1">
                                <p className="text-sm font-medium">{booking.guestFirstName} {booking.guestLastName}</p>
                                <p className="text-sm text-neutral-300">{booking.guestEmail}</p>
                                <p className="text-sm text-neutral-300">{booking.guestPhone}</p>
                             </div>
                          </div>
                          <div>
                              <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Total Guests</p>
                              <p className="text-sm flex items-center gap-2">
                                 <Users className="h-4 w-4 text-white" />
                                 {booking.items.reduce((acc, i) => acc + i.guests, 0)} Person(s)
                              </p>
                          </div>
                       </div>
                    </div>

                    {booking.specialRequests && (
                       <div className="mt-8 pt-6 border-t border-white/10">
                          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Special Requests</p>
                          <p className="text-sm text-neutral-300 italic">"{booking.specialRequests}"</p>
                       </div>
                    )}
                 </div>
              </Card>

           </div>

           {/* Right Column: Payment Status */}
           <div className="space-y-6">
               <Card className="bg-white/5 border-white/10 p-8 rounded-none">
                  <h3 className="text-lg font-serif italic mb-6">Payment Summary</h3>
                  
                  <div className="space-y-4 mb-8">
                     <div className="flex justify-between items-center pb-4 border-b border-white/10">
                        <span className="text-neutral-400">Total Amount</span>
                        <span className="text-xl font-medium">₱{Number(booking.totalAmount).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Amount Paid</span>
                        <span className="text-green-400">₱{Number(booking.amountPaid).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Balance Due</span>
                        <span className={Number(booking.amountDue) > 0 ? "text-red-400 font-medium" : "text-neutral-200"}>
                           ₱{Number(booking.amountDue).toLocaleString()}
                        </span>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10">
                     {booking.paymentStatus === 'PAID' ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                     ) : booking.paymentStatus === 'FAILED' ? (
                        <XCircle className="h-6 w-6 text-red-500" />
                     ) : (
                        <AlertCircle className="h-6 w-6 text-yellow-500" />
                     )}
                     <div>
                        <p className="text-xs uppercase tracking-widest text-neutral-500">Payment Status</p>
                        <p className={`font-medium ${getPaymentStatusColor(booking.paymentStatus)}`}>
                           {booking.paymentStatus.replace('_', ' ')}
                        </p>
                     </div>
                  </div>
               </Card>

               <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest text-neutral-500">Transaction History</h4>
                  {booking.payments.length === 0 ? (
                     <p className="text-sm text-neutral-500 italic">No payment records found.</p>
                  ) : (
                     <div className="space-y-3">
                        {booking.payments.map((payment) => (
                           <div key={payment.id} className="bg-neutral-900 border border-white/10 p-4 relative overflow-hidden group">
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <p className="text-sm font-medium text-white">
                                       Online Payment
                                    </p>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                                       {payment.provider}
                                    </p>
                                 </div>
                                 <span className={`text-xs px-2 py-0.5 border ${
                                    payment.status === 'PAID' ? 'border-green-800 text-green-400 bg-green-900/20' : 
                                    payment.status === 'FAILED' ? 'border-red-800 text-red-400 bg-red-900/20' : 
                                    'border-yellow-800 text-yellow-400 bg-yellow-900/20'
                                 }`}>
                                    {payment.status}
                                 </span>
                              </div>
                              <div className="flex justify-between items-end">
                                 <div className="text-xs text-neutral-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(payment.createdAt), 'MMM dd, HH:mm')}
                                 </div>
                                 <p className="font-mono text-sm">₱{Number(payment.amount).toLocaleString()}</p>
                              </div>
                              {payment.failureReason && (
                                 <p className="text-xs text-red-400 mt-2 pt-2 border-t border-white/5 truncate">
                                    Error: {payment.failureReason}
                                 </p>
                              )}
                           </div>
                        ))}
                     </div>
                  )}
               </div>
           </div>

        </div>
      </div>
    </div>
  );
}
