"use client";

import { motion } from "framer-motion";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-32 pb-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="mb-16 text-center"
        >
           <h1 className="text-4xl md:text-6xl font-serif text-white mb-6">Privacy Policy</h1>
           <p className="text-sm uppercase tracking-widest text-orange-500 font-medium">
              Effective Date: December 30, 2025
           </p>
        </motion.div>

        <div className="space-y-12 leading-relaxed font-light">
           <section>
              <h2 className="text-2xl font-serif text-white mb-4">1. Introduction</h2>
              <p>
                 Tropicana Worldwide Corporation ("TWC", "Company", "we", "us", or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy outlines our practices regarding the collection, use, strict storage, and disclosure of your information in compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and its Implementing Rules and Regulations.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">2. Collection of Personal Data</h2>
              <p className="mb-4">We collect personal data that you voluntarily provide to us when you make a reservation, inquire about our services, apply for a job, or interact with our website. This may include, but is not limited to:</p>
              <ul className="list-disc pl-6 space-y-2">
                 <li>Contact Information (Name, email address, phone number, mailing address)</li>
                 <li>Identification Details (Government-issued ID for check-ins, date of birth)</li>
                 <li>Payment Information (Credit card details, billing address)</li>
                 <li>Stay Preferences (Room type, dietary requirements, special requests)</li>
              </ul>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">3. Use of Personal Data</h2>
              <p className="mb-4">Your personal data is used for legitimate business purposes, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                 <li>Processing and confirming your hotel reservations and restaurant bookings.</li>
                 <li>Providing you with personalized customer service and hospitality.</li>
                 <li>Communicating with you regarding your stay, special offers, and events (with your consent).</li>
                 <li>Complying with legal obligations and regulatory requirements.</li>
              </ul>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">4. Data Sharing and Disclosure</h2>
              <p>
                 We do not sell or trade your personal data to third parties. We may share your information with trusted third-party service providers who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential and comply with the Data Privacy Act.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">5. Security Measures</h2>
              <p>
                 We implement appropriate organizational, physical, and technical security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure, and providing information is at your own risk.
              </p>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">6. Your Rights</h2>
              <p className="mb-4">Under the Data Privacy Act of 2012, you have the following rights regarding your personal data:</p>
              <ul className="list-disc pl-6 space-y-2">
                 <li><strong>Right to be Informed:</strong> To know how your data is collected and used.</li>
                 <li><strong>Right to Access:</strong> To request a copy of the data we hold about you.</li>
                 <li><strong>Right to Rectification:</strong> To correct any inaccurate or incomplete data.</li>
                 <li><strong>Right to Erasure or Blocking:</strong> To ask for your data to be deleted or blocked from processing.</li>
                 <li><strong>Right to Damages:</strong> To be indemnified for any damages sustained due to inaccurate, incomplete, outdated, false, unlawfully obtained or unauthorized use of personal data.</li>
              </ul>
           </section>

           <section>
              <h2 className="text-2xl font-serif text-white mb-4">7. Contact Us</h2>
              <p>
                 If you have any questions about this Privacy Policy or wish to exercise your rights, please contact our Data Protection Officer at:
              </p>
              <div className="mt-4 p-6 border border-white/10 bg-neutral-900/50 rounded-none">
                 <p className="text-white"><strong>Data Protection Officer</strong></p>
                 <p>Tropicana Worldwide Corporation</p>
                 <p>Cagampang Ext. Brgy Bula, General Santos City</p>
                 <p>Email: <a href="mailto:privacy@doloreshotels.com.ph" className="text-orange-500 hover:underline">privacy@doloreshotels.com.ph</a></p>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
