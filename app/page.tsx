"use client";

import { BookingWidget } from "@/components/booking/BookingWidget";
import { Button } from "@/components/ui/button";
import { PROPERTIES } from "@/lib/mock-data";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

const heroImages = [
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVVV8DoInl8YJnfQXZwHKRbB5kUFVSIov20cma",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVLhxEZ8Fc1UptDEajs5veJ36H7Ki9oPrWY2ON",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVCbuJsLAK38AKlBqGNT7RI5pYizjQHwtvsrfV",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVRlnPT0iBg1ydiaq5LNXQVuEso6hCczW2ejlw",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCV9n2ugPezJB0e3I8TZNRHvqsKkSblXQwiEfan",
];

export default function Home() {
  const ref = useRef(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Auto-rotate images every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950" ref={ref}>
      {/* Immersive Hero Section */}
      <section className="relative h-[110vh] flex items-center justify-center overflow-hidden">
        {/* Parallax Background */}
        <motion.div 
          style={{ y, opacity }}
          className="absolute inset-0 z-0"
        >
           <div className="absolute inset-0 bg-black/30 z-10" />
           
           {/* Auto-rotating Hero Carousel */}
           <AnimatePresence>
             <motion.div
               key={currentImageIndex}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ duration: 1.5, ease: "easeInOut" }}
               className="absolute inset-0 w-full h-full"
             >
               <Image
                 src={heroImages[currentImageIndex]}
                 alt="Tropicana Worldwide"
                 fill
                 priority
                 className="object-cover"
               />
             </motion.div>
           </AnimatePresence>
        </motion.div>

        <div className="relative z-30 container mx-auto px-4 text-center text-white space-y-12 pt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="space-y-4"
          >
            <p className="text-sm md:text-base tracking-[0.4em] uppercase font-light text-neutral-300">
              Welcome to Paradise
            </p>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif font-thin tracking-tight">
              Tropicana
              <span className="block text-4xl md:text-6xl italic mt-2 font-light text-white/80">Worldwide Corporation</span>
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="w-full mx-auto"
          >
            <BookingWidget />
          </motion.div>
        </div>
        
        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-4 z-30"
        >
          <span className="text-[10px] uppercase tracking-[0.2em]">Explore</span>
          <div className="w-[1px] h-24 bg-gradient-to-b from-white to-transparent" />
        </motion.div>
      </section>

      {/* Editorial Property Grid */}
      <section className="py-32 bg-neutral-950 relative z-40">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
            <div className="space-y-4">
               <span className="text-orange-500 tracking-widest text-xs uppercase">Our Destinations</span>
               <h2 className="text-4xl md:text-6xl font-serif text-white leading-tight">
                 Curated Collection <br /> 
                 <span className="italic text-neutral-500">of Sanctuaries</span>
               </h2>
            </div>
            <p className="text-neutral-400 max-w-sm font-light leading-relaxed">
              From the heart of the city to the serenity of nature, discover our handpicked portfolio of luxury properties.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
            {PROPERTIES.map((prop, index) => (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className={`group relative overflow-hidden rounded-none cursor-pointer ${
                  index === 0 ? "lg:col-span-8 aspect-[16/9]" : 
                  index === 1 ? "lg:col-span-4 aspect-[3/4]" : 
                  "lg:col-span-6 aspect-[4/3]"
                }`}
              >
                 <div className="absolute inset-0 bg-neutral-800">
                    <Image
                       src={prop.image}
                       alt={prop.name}
                       fill
                       className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-in-out opacity-80"
                    />
                 </div>
                 
                 <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500" />
                 
                 <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full space-y-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                   <div className="overflow-hidden">
                     <span className="inline-block text-xs font-medium tracking-widest uppercase text-white/70 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 delay-75">
                       {prop.location}
                     </span>
                   </div>
                   <h3 className="text-3xl md:text-5xl font-serif text-white italic">
                     {prop.name}
                   </h3>
                   <div className="w-full h-[1px] bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
                   <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                     <p className="text-sm text-neutral-300 line-clamp-1 max-w-[70%]">{prop.description}</p>
                     <Link href={`/properties/${prop.slug}`}>
                       <Button variant="link" className="text-white hover:text-orange-400 p-0 h-auto uppercase tracking-widest text-xs">
                         Discover <ArrowRight className="ml-2 h-3 w-3" />
                       </Button>
                     </Link>
                   </div>
                 </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dining Teaser - Editorial Style */}
      <section className="py-32 bg-neutral-900 text-white relative overflow-hidden">
        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-10 order-2 lg:order-1"
          >
            <div className="space-y-4">
              <span className="text-orange-500 tracking-widest text-xs uppercase">Signature Dining</span>
              <h2 className="text-5xl md:text-7xl font-serif">
                Cafe Rodrigo
              </h2>
            </div>
            <p className="text-xl text-neutral-400 font-light leading-relaxed max-w-lg">
              A culinary journey that transcends the ordinary. Utilizing farm-to-table ingredients from our very own Dolores Farm, crafted by world-class chefs.
            </p>
            <div className="space-y-6 pt-4">
               {["Michelin-inspired Menu", "Organic Ingredients", "Waterfront Seating"].map((item) => (
                 <div key={item} className="flex items-center gap-4 group">
                    <span className="w-12 h-[1px] bg-neutral-700 group-hover:bg-orange-500 transition-colors" />
                    <span className="font-serif text-2xl italic text-neutral-300 group-hover:text-white transition-colors">{item}</span>
                 </div>
               ))}
            </div>
            <Link href="/dining">
              <Button size="lg" variant="outline" className="mt-8 border-neutral-700 hover:bg-white hover:text-black rounded-none px-8 py-6 uppercase tracking-widest text-xs">
                View The Menu
              </Button>
            </Link>
          </motion.div>
          
          <div className="relative order-1 lg:order-2">
             <div className="aspect-[3/4] bg-neutral-800 relative z-10 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop"
                  alt="Fine Dining at Cafe Rodrigo"
                  fill
                  className="object-cover"
                />
             </div>
             {/* Decorative Elements */}
             <div className="absolute -top-12 -right-12 w-64 h-64 border border-orange-500/20 rounded-full z-0 animate-spin-slow" />
             <div className="absolute -bottom-12 -left-12 w-48 h-48 border border-white/10 rounded-full z-20" />
          </div>
        </div>
      </section>
    </div>
  );
}
