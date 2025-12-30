import { format } from "date-fns";

interface BookingInvoiceProps {
  refId: string;
  guestName: string;
  email?: string;
  phone?: string;
  checkIn: Date | null;
  checkOut: Date | null;
  roomName: string;
  propertyName: string;
  nights: number;
  guests: number;
  roomTotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
}

export function BookingInvoice({
  refId,
  guestName,
  email,
  phone,
  checkIn,
  checkOut,
  roomName,
  propertyName,
  nights,
  guests,
  roomTotal,
  discount,
  tax,
  serviceCharge,
  total,
}: BookingInvoiceProps) {
  return (
    <div id="booking-invoice" style={{ backgroundColor: '#ffffff', color: '#000000', padding: '48px', maxWidth: '800px', margin: '0 auto', fontFamily: 'serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000000', paddingBottom: '32px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice</h1>
          <p style={{ fontSize: '14px', margin: '4px 0', lineHeight: '1.5' }}>
            Tropicana Worldwide Corp.<br/>
            123 Luxury Ave, General Santos City<br/>
            Philippines, 9500
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Reference: {refId}</p>
          <p style={{ fontSize: '14px', margin: '0' }}>Date: {format(new Date(), "MMM dd, yyyy")}</p>
        </div>
      </div>

      {/* Guest & Stay Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '48px' }}>
        <div>
          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #000000', paddingBottom: '4px', display: 'inline-block' }}>Billed To</h3>
          <p style={{ fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0' }}>{guestName || "Guest"}</p>
          {email && <p style={{ fontSize: '14px', margin: '2px 0' }}>{email}</p>}
          {phone && <p style={{ fontSize: '14px', margin: '2px 0' }}>{phone}</p>}
          <p style={{ fontSize: '14px', marginTop: '8px' }}>{guests} Guests</p>
        </div>
        <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginBottom: '12px', borderBottom: '1px solid #000000', paddingBottom: '4px', display: 'inline-block' }}>Stay Details</h3>
            <p style={{ fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0' }}>{propertyName}</p>
            <p style={{ fontSize: '14px', margin: '2px 0' }}>{roomName}</p>
            <p style={{ fontSize: '14px', margin: '2px 0' }}>
                {checkIn ? format(checkIn, "MMM dd, yyyy") : "TBD"} - {checkOut ? format(checkOut, "MMM dd, yyyy") : "TBD"}
            </p>
            <p style={{ fontSize: '14px', fontStyle: 'italic', marginTop: '4px' }}>({nights} Nights)</p>
        </div>
      </div>

      {/* Line Items */}
      <table style={{ width: '100%', marginBottom: '48px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #000000' }}>
            <th style={{ textAlign: 'left', padding: '12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
            <td style={{ padding: '16px 0', fontSize: '14px' }}>Room Charges ({nights} nights)</td>
            <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px' }}>₱{roomTotal.toLocaleString()}</td>
          </tr>
          {discount > 0 && (
            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '16px 0', fontSize: '14px' }}>Discount Applied</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px' }}>-₱{discount.toLocaleString()}</td>
            </tr>
          )}
          <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
            <td style={{ padding: '16px 0', fontSize: '14px' }}>Service Charge (10%)</td>
            <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px' }}>₱{serviceCharge.toLocaleString()}</td>
          </tr>
           <tr style={{ borderBottom: '2px solid #000000' }}>
            <td style={{ padding: '16px 0', fontSize: '14px' }}>VAT (12%)</td>
            <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px' }}>₱{tax.toLocaleString()}</td>
          </tr>
        </tbody>
        <tfoot>
            <tr>
                <td style={{ padding: '24px 0', fontWeight: 'bold', fontSize: '20px' }}>Total Paid</td>
                <td style={{ padding: '24px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px' }}>₱{total.toLocaleString()}</td>
            </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingTop: '32px' }}>
        <p style={{ fontStyle: 'italic', margin: '0 0 8px 0', fontSize: '16px' }}>Thank you for choosing Tropicana Worldwide.</p>
        <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>support@tropicana.com</p>
      </div>
    </div>
  );
}
