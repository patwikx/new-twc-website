"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Filter } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const categories = ["All", "Nature", "Culture", "Food", "Adventure", "Wellness"] as const;
type Category = typeof categories[number];

interface Experience {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  distance: string;
}

interface ExperiencesClientProps {
  experiences: Experience[];
}

export default function ExperiencesClient({ experiences }: ExperiencesClientProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filteredExperiences = activeCategory === "All" 
    ? experiences 
    : experiences.filter(exp => exp.category === activeCategory);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop"
            alt="South Cotabato Landscape"
            fill
            priority
            className="object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
        </div>
        
        <div className="relative z-10 text-center px-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-orange-500 tracking-widest text-xs uppercase">Local Experiences</span>
            <h1 className="text-5xl md:text-7xl font-serif font-light mt-4">
              Discover <span className="italic text-neutral-400">South Cotabato</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-neutral-400 font-light max-w-2xl mx-auto"
          >
            From majestic waterfalls to rich cultural heritage, explore the hidden gems near our properties.
          </motion.p>
        </div>
      </section>

      {/* Filter Section */}
      <section className="py-12 border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Filter className="h-4 w-4 text-neutral-500 mr-2" />
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? "default" : "outline"}
                onClick={() => setActiveCategory(category)}
                className={`rounded-none text-xs uppercase tracking-widest transition-all duration-300 ${
                  activeCategory === category
                    ? "bg-white text-black hover:bg-neutral-200"
                    : "bg-transparent text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Experiences Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredExperiences.map((experience, index) => (
                <ExperienceCard key={experience.id} experience={experience} index={index} />
              ))}
            </motion.div>
          </AnimatePresence>

          {filteredExperiences.length === 0 && (
            <div className="text-center py-20">
              <p className="text-neutral-500">No experiences found in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 mt-24 bg-neutral-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif mb-6">
            Ready for Your <span className="italic text-neutral-400">Adventure?</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
            Our concierge team can arrange any of these experiences for you. Contact us to customize your perfect itinerary.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              asChild
              className="rounded-none px-8 py-6 uppercase tracking-widest text-xs bg-white text-black hover:bg-neutral-200"
            >
              <a href="/contact">Contact Concierge</a>
            </Button>
            <Button 
              asChild
              variant="outline"
              className="rounded-none px-8 py-6 uppercase tracking-widest text-xs border-white/20 hover:bg-white hover:text-black"
            >
              <a href="/properties">View Properties</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

const categoryColors: Record<string, string> = {
  Nature: "bg-emerald-500",
  Culture: "bg-amber-500",
  Food: "bg-rose-500",
  Adventure: "bg-blue-500",
  Wellness: "bg-pink-500",
};

function ExperienceCard({ experience, index }: { experience: Experience; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative bg-neutral-900 border border-white/5 overflow-hidden hover:border-white/20 transition-all duration-500"
    >
      {/* Image */}
      <div className="aspect-[4/3] relative overflow-hidden">
        <Image
          src={experience.image}
          alt={experience.title}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
        
        {/* Category Badge */}
        <div className={`absolute top-4 right-4 ${categoryColors[experience.category] || 'bg-neutral-500'} text-white text-[10px] uppercase tracking-widest px-3 py-1`}>
          {experience.category}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <h3 className="text-xl font-serif">{experience.title}</h3>
        <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3">
          {experience.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <MapPin className="h-3 w-3" />
          {experience.distance}
        </div>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/5 transition-colors duration-500 pointer-events-none" />
    </motion.div>
  );
}
