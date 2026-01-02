"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowDown } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Hero */}
      <div className="relative h-[80vh] flex items-center justify-center overflow-hidden">
         <Image
            src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop"
            alt="About TWC"
            fill
            className="object-cover opacity-50"
            priority
         />
         <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
         
         <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-orange-500 uppercase tracking-[0.3em] text-sm font-medium mb-6"
            >
              Our Story
            </motion.p>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-8xl font-serif font-light mb-8 leading-tight"
            >
              Defining Luxury in <br /> <span className="italic text-white/80">General Santos City</span>
            </motion.h1>
            <motion.p 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.4 }}
               className="text-xl md:text-2xl font-light text-neutral-300 max-w-2xl mx-auto leading-relaxed"
            >
              Since 1995, Tropicana Worldwide Corporation has been the architect of unforgettable experiences.
            </motion.p>
         </div>

         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
           <ArrowDown className="text-white h-6 w-6" />
         </div>
      </div>

      {/* Narrative Section */}
      <div className="py-24 md:py-32 container mx-auto px-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="space-y-8">
               <h2 className="text-4xl md:text-5xl font-serif leading-tight">
                 A Legacy of <span className="text-orange-500 italic">Excellence</span>
               </h2>
               <div className="space-y-6 text-neutral-400 text-lg font-light leading-relaxed">
                 <p>
                   Founded with a singular vision to elevate the hospitality landscape of Mindanao, Tropicana Worldwide Corporation (TWC) began as a humble commitment to service. Over the decades, we have grown into a premier symbol of luxury and comfort in General Santos City.
                 </p>
                 <p>
                   Our portfolio, ranging from the urban sophistication of Anchor Hotel to the rustic serenity of Dolores Farm Resort, reflects our deep understanding of the diverse needs of modern travelers.
                 </p>
                 <p>
                   We believe that true luxury lies not just in opulence, but in the warmth of a genuine welcome and the precision of impeccable service. This philosophy is the heartbeat of every property we operate.
                 </p>
               </div>
            </div>
            <div className="relative h-[600px] w-full">
               <div className="absolute inset-0 bg-neutral-800 rounded-none overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop"
                    alt="TWC History"
                    fill
                    className="object-cover"
                  />
               </div>
               <div className="absolute -bottom-8 -left-8 w-64 h-64 border border-orange-500/20 rounded-none -z-10" />
               <div className="absolute -top-8 -right-8 w-48 h-48 bg-neutral-900 border border-white/10 rounded-none -z-10" />
            </div>
         </div>
      </div>

      {/* Values */}
      <div className="py-24 bg-neutral-900">
         <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
               <div className="space-y-6 p-8 border border-white/5 bg-neutral-950/50 hover:border-orange-500/30 transition-colors duration-500 rounded-none group">
                  <h3 className="text-2xl font-serif italic text-white group-hover:text-orange-400 transition-colors">Filipino Hospitality</h3>
                  <p className="text-neutral-400 font-light leading-relaxed">
                    We embody the world-renowned warmth of Filipino culture, treating every guest like family from the moment they arrive.
                  </p>
               </div>
               <div className="space-y-6 p-8 border border-white/5 bg-neutral-950/50 hover:border-orange-500/30 transition-colors duration-500 rounded-none group">
                  <h3 className="text-2xl font-serif italic text-white group-hover:text-orange-400 transition-colors">Sustainable Luxury</h3>
                  <p className="text-neutral-400 font-light leading-relaxed">
                    Committed to preserving the beauty of General Santos, we integrate eco-friendly practices across all our properties.
                  </p>
               </div>
               <div className="space-y-6 p-8 border border-white/5 bg-neutral-950/50 hover:border-orange-500/30 transition-colors duration-500 rounded-none group">
                  <h3 className="text-2xl font-serif italic text-white group-hover:text-orange-400 transition-colors">Culinary Mastery</h3>
                  <p className="text-neutral-400 font-light leading-relaxed">
                    Our kitchens are laboratories of flavor, where local ingredients meet international techniques to create magic.
                  </p>
               </div>
            </div>
         </div>
      </div>

      {/* Mission & Vision */}
      <div className="py-24 container mx-auto px-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="bg-neutral-900 border border-white/5 p-12 text-center space-y-6 rounded-none group hover:border-orange-500/30 transition-colors duration-500">
               <span className="text-orange-500 uppercase tracking-widest text-xs font-medium">Our Mandate</span>
               <h2 className="text-4xl font-serif italic text-white">Mission</h2>
               <p className="text-neutral-400 font-light leading-relaxed text-lg">
                 To provide exceptional hospitality that honors the rich heritage of General Santos City, creating lasting memories for every guest through personalized service, world-class amenities, and a deep commitment to our community.
               </p>
            </div>
            <div className="bg-neutral-900 border border-white/5 p-12 text-center space-y-6 rounded-none group hover:border-orange-500/30 transition-colors duration-500">
               <span className="text-orange-500 uppercase tracking-widest text-xs font-medium">Our Aspiration</span>
               <h2 className="text-4xl font-serif italic text-white">Vision</h2>
               <p className="text-neutral-400 font-light leading-relaxed text-lg">
                 To be the unrivaled symbol of luxury and comfort in Mindanao, setting the gold standard for Filipino hospitality while championing sustainable tourism and local economic growth.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
