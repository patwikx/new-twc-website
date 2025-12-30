"use client";

import { Button } from "@/components/ui/button";
import { DINING, PROPERTIES } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { ChefHat, Coffee, Utensils, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DiningPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <div className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-neutral-900 z-0">
           {/* Placeholder */}
           <div className="absolute inset-0 bg-black/40" />
           <div className="w-full h-full bg-gradient-to-br from-orange-950/20 to-neutral-950" />
        </div>
        
        <div className="relative z-10 text-center space-y-6 px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <span className="text-orange-400 tracking-[0.3em] text-sm uppercase font-medium">Est. 2024</span>
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-6xl md:text-8xl font-serif italic"
          >
            {DINING.name}
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-xl md:text-2xl font-light text-neutral-300 max-w-2xl mx-auto"
          >
            {DINING.description}
          </motion.p>
        </div>
      </div>

      {/* Philosophy */}
      <div className="py-24 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="space-y-4">
            <div className="bg-neutral-900 w-16 h-16 rounded-full mx-auto flex items-center justify-center">
              <ChefHat className="text-orange-400 h-8 w-8" />
            </div>
            <h3 className="text-xl font-medium">Master Chefs</h3>
            <p className="text-neutral-400">Curated dishes by world-renowned culinary experts.</p>
          </div>
          <div className="space-y-4">
            <div className="bg-neutral-900 w-16 h-16 rounded-full mx-auto flex items-center justify-center">
              <Utensils className="text-orange-400 h-8 w-8" />
            </div>
            <h3 className="text-xl font-medium">Fresh Ingredients</h3>
            <p className="text-neutral-400">Locally sourced, organic produce for the finest flavors.</p>
          </div>
          <div className="space-y-4">
            <div className="bg-neutral-900 w-16 h-16 rounded-full mx-auto flex items-center justify-center">
              <Coffee className="text-orange-400 h-8 w-8" />
            </div>
            <h3 className="text-xl font-medium">Artisanal Coffee</h3>
            <p className="text-neutral-400">Premium blends to start your day or end your meal.</p>
          </div>
        </div>
      </div>

      {/* Menu Highlights */}
      <div className="py-24 bg-neutral-900">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-serif italic text-center mb-16 underline decoration-orange-500/30 underline-offset-8">
            Menu Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {DINING.menuHighlights.map((item) => (
              <div key={item.name} className="p-8 border border-neutral-800 rounded-none hover:border-orange-500/50 transition-colors bg-neutral-950">
                <div className="flex justify-between items-baseline mb-4">
                  <h3 className="text-2xl font-medium">{item.name}</h3>
                  <span className="text-orange-400 font-bold">₱{item.price.toLocaleString()}</span>
                </div>
                <p className="text-neutral-400">{item.description}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button variant="outline" className="rounded-none px-8 py-6 tracking-widest text-xs uppercase text-orange-400 border-orange-400 hover:bg-orange-400 hover:text-black transition-all duration-500">
              View Full Menu
            </Button>
          </div>
        </div>
      </div>

      {/* Locations */}
      <div className="py-24 container mx-auto px-4">
        <h2 className="text-3xl font-light text-center mb-12">Find Us At</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PROPERTIES.map((prop) => (
             <Link key={prop.id} href={`/properties/${prop.slug}`}>
                <div className="p-6 bg-neutral-900 rounded-none text-center hover:bg-neutral-800 transition-colors cursor-pointer group">
                  <p className="font-medium group-hover:text-orange-400 transition-colors">{prop.name}</p>
                </div>
             </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
