"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Briefcase, Heart, Lightbulb, Users } from "lucide-react";

const POSITIONS = [
  {
    id: 1,
    title: "Front Office Associate",
    department: "Guest Services",
    type: "Full-Time",
    location: "Anchor Hotel",
    description: "Be the face of our hospitality, ensuring every guest feels welcomed and valued from arrival to departure."
  },
  {
    id: 2,
    title: "Sous Chef",
    department: "Culinary",
    type: "Full-Time",
    location: "Dolores Farm Resort",
    description: "Assist the Executive Chef in managing kitchen operations and crafting exquisite farm-to-table dishes."
  },
  {
    id: 3,
    title: "Housekeeping Supervisor",
    department: "Housekeeping",
    type: "Full-Time",
    location: "Dolores Tropicana Resort",
    description: "Lead a team of dedicated attendants to maintain our high standards of cleanliness and comfort."
  },
  {
    id: 4,
    title: "Event Coordinator",
    department: "Sales & Marketing",
    type: "Full-Time",
    location: "Dolores Lake Resort",
    description: "Plan and execute memorable weddings, corporate retreats, and special celebrations."
  }
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-24 pb-12">
       {/* Hero */}
       <div className="container mx-auto px-4 mb-20 text-center">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="inline-block"
          >
            <span className="text-orange-500 uppercase tracking-widest text-xs font-medium">Join Our Team</span>
            <h1 className="text-5xl md:text-7xl font-serif font-light mt-4 mb-6">Build a Career in Luxury</h1>
            <p className="text-xl text-neutral-400 font-light max-w-2xl mx-auto leading-relaxed">
               At TWC, we don't just hire employees; we nurture talent. Join a family that values passion, excellence, and the art of genuine hospitality.
            </p>
          </motion.div>
       </div>

       {/* Values */}
       <div className="bg-white/5 border-y border-white/5 py-16 mb-20">
          <div className="container mx-auto px-4">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="text-center space-y-4">
                   <div className="w-12 h-12 bg-orange-500/10 rounded-none flex items-center justify-center mx-auto">
                      <Heart className="h-6 w-6 text-orange-500" />
                   </div>
                   <h3 className="text-lg font-serif italic">Passion</h3>
                   <p className="text-sm text-neutral-400">We love what we do.</p>
                </div>
                <div className="text-center space-y-4">
                   <div className="w-12 h-12 bg-orange-500/10 rounded-none flex items-center justify-center mx-auto">
                      <Users className="h-6 w-6 text-orange-500" />
                   </div>
                   <h3 className="text-lg font-serif italic">Community</h3>
                   <p className="text-sm text-neutral-400">We grow together.</p>
                </div>
                <div className="text-center space-y-4">
                   <div className="w-12 h-12 bg-orange-500/10 rounded-none flex items-center justify-center mx-auto">
                      <Lightbulb className="h-6 w-6 text-orange-500" />
                   </div>
                   <h3 className="text-lg font-serif italic">Innovation</h3>
                   <p className="text-sm text-neutral-400">We constantly improve.</p>
                </div>
                <div className="text-center space-y-4">
                   <div className="w-12 h-12 bg-orange-500/10 rounded-none flex items-center justify-center mx-auto">
                      <Briefcase className="h-6 w-6 text-orange-500" />
                   </div>
                   <h3 className="text-lg font-serif italic">Growth</h3>
                   <p className="text-sm text-neutral-400">We invest in you.</p>
                </div>
             </div>
          </div>
       </div>

       {/* Listings */}
       <div className="container mx-auto px-4">
          <h2 className="text-3xl font-light mb-12 text-center">Open Positions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {POSITIONS.map((job, index) => (
                <motion.div 
                   key={job.id}
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: index * 0.1 }}
                   className="p-8 border border-white/10 hover:border-orange-500/50 bg-neutral-900/50 hover:bg-neutral-900 transition-all duration-300 group cursor-pointer"
                >
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <h3 className="text-xl font-medium group-hover:text-orange-400 transition-colors">{job.title}</h3>
                         <span className="text-xs uppercase tracking-widest text-neutral-500 mt-1 block">{job.department}</span>
                      </div>
                      <span className="text-xs border border-white/20 px-2 py-1 bg-white/5">{job.type}</span>
                   </div>
                   <p className="text-neutral-400 font-light text-sm mb-6 leading-relaxed">
                      {job.description}
                   </p>
                   <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{job.location}</span>
                      <span className="uppercase tracking-widest group-hover:underline">View Details</span>
                   </div>
                </motion.div>
             ))}
          </div>

          <div className="mt-16 text-center space-y-6 max-w-xl mx-auto p-8 border border-dashed border-white/10">
             <h3 className="text-xl font-serif italic">Don't see a fit?</h3>
             <p className="text-neutral-400 font-light">
                We are always looking for exceptional talent. Send your CV to <span className="text-orange-400">careers@twc-hotel.com</span> and we will keep you in mind for future opportunities.
             </p>
          </div>
       </div>
    </div>
  );
}
