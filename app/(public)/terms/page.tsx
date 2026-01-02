"use client";

import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-32 pb-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="mb-16 text-center"
        >
           <h1 className="text-4xl md:text-6xl font-serif text-white mb-6">Terms of Service</h1>
           <p className="text-sm uppercase tracking-widest text-orange-500 font-medium">
              Last Updated: December 30, 2025
           </p>
        </motion.div>

        <div className="space-y-12 leading-relaxed font-light">
           <section>
              <h2 className="text-2xl font-serif text-white mb-4">1. Agreement to Terms</h2>
              <p>
                 These Terms of Service ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Tropicana Worldwide Corporation ("we", "us", or "our"), concerning your access to and use of our website and services. By accessing the site, you acknowledge that you have read, understood, and agreed to be bound by all of these Terms.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">2. Reservations and Cancellations</h2>
              <p className="mb-4">
                 All reservations made through our website are subject to availability and confirmation.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                 <li><strong>Payment:</strong> A valid credit card or deposit is required to secure your booking. Full payment or balance is due upon check-in, unless a prepaid rate was selected.</li>
                 <li><strong>Cancellation:</strong> Cancellation policies vary by room rate and property. Please review the specific terms attached to your reservation confirmation. Failure to cancel within the specified window may result in a penalty charge.</li>
                 <li><strong>Check-in/Check-out:</strong> Standard check-in time is 2:00 PM, and check-out time is 12:00 PM. Early check-in or late check-out is subject to availability and potential extra charges.</li>
              </ul>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">3. Guest Conduct</h2>
              <p>
                 Guests are expected to conduct themselves in a respectful manner and comply with all property rules and regulations. We reserve the right to refuse service or evict guests who engage in prohibited conduct, including but not limited to: violating smoking policies, causing damage to property, or disturbing other guests.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">4. Limitation of Liability</h2>
              <p>
                 To the fullest extent permitted by Philippine law, Tropicana Worldwide Corporation shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the services.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">5. Intellectual Property</h2>
              <p>
                 The content on this website, including text, graphics, logos, images, and software, is the property of Tropicana Worldwide Corporation and is protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works from this content without our express written permission.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">6. Governing Law</h2>
              <p>
                 These Terms shall be governed by and defined following the laws of the Philippines. Tropicana Worldwide Corporation and yourself irrevocably consent that the courts of General Santos City shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these terms.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">7. Changes to Terms</h2>
              <p>
                 We reserve the right, in our sole discretion, to make changes or modifications to these Terms at any time and for any reason. We will alert you about any changes by updating the "Last Updated" date of these Terms.
              </p>
           </section>
        </div>
      </div>
    </div>
  );
}
