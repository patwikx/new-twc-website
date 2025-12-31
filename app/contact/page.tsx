"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import axios from "axios";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    message: "",
    subject: "General Inquiry",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      setStatus("error");
      setErrorMessage("Please complete the security check.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      await axios.post("/api/contact", { 
        ...formData, 
        turnstileToken 
      });

      setStatus("success");
      setFormData({ 
          firstName: "", 
          lastName: "", 
          email: "", 
          contactNumber: "",
          message: "",
          subject: "General Inquiry"
      });
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } catch (error: any) {
      console.error("Submission Error:", error);
      setStatus("error");
      const serverError = error.response?.data?.error || error.message;
      setErrorMessage(serverError || "Something went wrong. Please try again.");
      turnstileRef.current?.reset();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-24 pb-12">
       <div className="container mx-auto px-4">
          <div className="text-center mb-20 space-y-6">
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="inline-block"
            >
              <h1 className="text-5xl md:text-7xl font-serif font-light">Get in Touch</h1>
              <div className="h-1 w-24 bg-orange-500 mx-auto mt-6" />
            </motion.div>
            <p className="text-xl text-neutral-400 font-light max-w-2xl mx-auto">
               We are here to assist you with your reservations, event planning, or any inquiries you may have about our properties.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24">
             {/* Contact Info & Map */}
             <div className="space-y-12">
                <div className="space-y-8">
                   <div className="flex items-start gap-6 group">
                      <div className="w-12 h-12 bg-neutral-900 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-orange-500/50 transition-colors">
                         <MapPin className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                         <h3 className="text-lg font-medium uppercase tracking-widest mb-2">Headquarters</h3>
                         <p className="text-neutral-400 font-light leading-relaxed">
                            Tropicana Worldwide Corporation.<br />
                            Cagampang Ext. Brgy Bula, General Santos City<br />
                            South Cotabato, Philippines 9500
                         </p>
                      </div>
                   </div>

                   <div className="flex items-start gap-6 group">
                      <div className="w-12 h-12 bg-neutral-900 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-orange-500/50 transition-colors">
                         <Phone className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                         <h3 className="text-lg font-medium uppercase tracking-widest mb-2">Phone</h3>
                         <p className="text-neutral-400 font-light">
                            (083) 552-6517<br />
                            (083) 552-2598<br />

                            +63 (918) 906-7311 (Mobile)<br />
                            +63 (951) 491-2332 (Mobile)
                         </p>
                      </div>
                   </div>

                   <div className="flex items-start gap-6 group">
                      <div className="w-12 h-12 bg-neutral-900 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-orange-500/50 transition-colors">
                         <Mail className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                         <h3 className="text-lg font-medium uppercase tracking-widest mb-2">Email</h3>
                         <p className="text-neutral-400 font-light">
                            marketinginfo@doloreshotels.com.ph
                         </p>
                      </div>
                   </div>
                </div>

                {/* Map */}
                <div className="aspect-[16/9] w-full bg-neutral-900 border border-white/10 relative overflow-hidden group">
                   <iframe 
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d701.3024620366006!2d125.1799303878495!3d6.108363972968907!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32f79f987a4c7c1f%3A0x4ebe05d5348dcfcb!2sAnchor%20Hotel%20GENSAN!5e0!3m2!1sen!2sph!4v1767099227005!5m2!1sen!2sph" 
                      width="100%" 
                      height="100%" 
                      style={{ border: 0 }} 
                      allowFullScreen 
                      loading="lazy" 
                      referrerPolicy="no-referrer-when-downgrade"
                      className="transition-all duration-700"
                   />
                </div>
             </div>

             {/* Contact Form */}
             <div className="bg-neutral-900/30 border border-white/5 p-8 md:p-12">
                <h2 className="text-3xl font-serif italic mb-8">Send us a Message</h2>
                
                {status === "success" ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12 space-y-4"
                  >
                     <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8" />
                     </div>
                     <h3 className="text-2xl font-serif">Message Sent!</h3>
                     <p className="text-neutral-400">Thank you for contacting us. We will get back to you shortly.</p>
                     <Button 
                       onClick={() => setStatus("idle")}
                       variant="outline" 
                       className="mt-6 bg-transparent text-white border-white/20 hover:bg-white hover:text-black rounded-none px-8 tracking-widest text-xs uppercase transition-all duration-500"
                     >
                       Send Another Message
                     </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs uppercase tracking-widest text-neutral-500">First Name <span className="text-red-500">*</span></label>
                          <Input 
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" 
                            placeholder="Juan" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs uppercase tracking-widest text-neutral-500">Last Name <span className="text-red-500">*</span></label>
                          <Input 
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" 
                            placeholder="Dela Cruz" 
                          />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-neutral-500">Email Address <span className="text-red-500">*</span></label>
                            <Input 
                              name="email"
                              type="email"
                              value={formData.email}
                              onChange={handleChange}
                              required
                              className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" 
                              placeholder="juan@example.com" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-neutral-500">Contact Number <span className="text-red-500">*</span></label>
                            <Input 
                              name="contactNumber"
                              type="tel"
                              value={formData.contactNumber}
                              onChange={handleChange}
                              required
                              className="bg-neutral-950 border-white/10 text-white h-12 rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors" 
                              placeholder="+63 917 123 4567" 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-neutral-500">Subject</label>
                        <select className="w-full bg-neutral-950 border border-white/10 text-white h-12 px-3 text-sm rounded-none focus:outline-none focus:border-orange-500/50 transition-colors appearance-none">
                            <option>General Inquiry</option>
                            <option>Room Reservation</option>
                            <option>Event Booking</option>
                            <option>Careers</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-neutral-500">Message <span className="text-red-500">*</span></label>
                        <Textarea 
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          required
                          className="bg-neutral-950 border-white/10 text-white min-h-[150px] rounded-none focus:border-orange-500/50 focus:ring-0 transition-colors resize-none" 
                          placeholder="How can we help you?" 
                        />
                    </div>

                    {status === "error" && (
                      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-none border border-red-400/20">
                         <AlertCircle className="h-4 w-4" />
                         {errorMessage}
                      </div>
                    )}

                    {/* Cloudflare Turnstile - Invisible CAPTCHA */}
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={() => setTurnstileToken(null)}
                      onExpire={() => setTurnstileToken(null)}
                      options={{ theme: "dark", size: "invisible" }}
                    />

                    <Button 
                      disabled={status === "loading"}
                      className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === "loading" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                        </span>
                      ) : (
                        "Send Message"
                      )}
                    </Button>
                  </form>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}
