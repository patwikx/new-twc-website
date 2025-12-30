"use client";

import { Button } from "@/components/ui/button";
import { EVENTS } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { CalendarDays, Users, GlassWater } from "lucide-react";
import Image from "next/image";

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-24 pb-12">
       <div className="container mx-auto px-4">
          <div className="text-center md:text-left mb-16">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-serif font-light mb-6"
            >
              Events & Business
            </motion.h1>
            <p className="text-xl text-neutral-400 font-light max-w-2xl">
              Elevate your gatherings with our world-class venues and impeccable service.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
             <div className="aspect-square bg-neutral-900 rounded-none overflow-hidden relative">
                 <Image
                   src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop"
                   alt="Event Space at Tropicana Worldwide"
                   fill
                   className="object-cover"
                 />
             </div>
             <div className="space-y-8">
               {EVENTS.map((event) => (
                 <motion.div 
                   key={event.id}
                   initial={{ opacity: 0, x: 50 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   viewport={{ once: true }}
                   className="p-8 border border-white/10 rounded-none hover:border-orange-500/50 transition-colors bg-white/5"
                  >
                    <h3 className="text-2xl font-serif mb-2">{event.title}</h3>
                    <p className="text-neutral-400 mb-4 font-light">{event.description}</p>
                    <div className="flex items-center text-sm font-medium text-orange-400">
                      <Users className="mr-2 h-4 w-4" /> {event.capacity}
                    </div>
                 </motion.div>
               ))}
               
               <div className="p-8 border-l-4 border-orange-500 bg-orange-500/10">
                  <h3 className="font-serif text-xl mb-2">Custom Packages</h3>
                  <p className="text-neutral-300 font-light">
                    We offer tailored packages for weddings, corporate retreats, and private parties. 
                    Contact our events team for a quote.
                  </p>
                  <Button variant="outline" className="mt-6 rounded-none px-8 tracking-widest text-xs uppercase border-white/20 hover:bg-white hover:text-black transition-all duration-500">Inquire Now</Button>
               </div>
             </div>
          </div>

          {/* Services */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center bg-white/5 border border-white/10 rounded-none p-12">
             <div className="space-y-4">
                <GlassWater className="h-10 w-10 mx-auto text-orange-400" />
                <h4 className="font-serif text-xl">Catering</h4>
                <p className="text-sm text-neutral-400 font-light">Exquisite menus from Cafe Rodrigo.</p>
             </div>
             <div className="space-y-4">
                <CalendarDays className="h-10 w-10 mx-auto text-orange-400" />
                <h4 className="font-serif text-xl">Planning</h4>
                <p className="text-sm text-neutral-400 font-light">Dedicated event planners.</p>
             </div>
             <div className="space-y-4">
                <Users className="h-10 w-10 mx-auto text-orange-400" />
                <h4 className="font-serif text-xl">Staffing</h4>
                <p className="text-sm text-neutral-400 font-light">Professional service staff.</p>
             </div>
          </div>
       </div>
    </div>
  );
}
