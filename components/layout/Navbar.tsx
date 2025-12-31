"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/useCartStore";

const navLinks = [
  { name: "Hotels & Resorts", href: "/properties" },
  { name: "Dining", href: "/dining" },
  { name: "Events", href: "/events" },
  { name: "Experiences", href: "/experiences" },
  { name: "Contact Us", href: "/contact" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Hydration safety for persisted store
  const [mounted, setMounted] = useState(false);
  const itemCount = useCartStore((state) => state.items.length);

  useEffect(() => {
    useCartStore.persist.rehydrate();
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <>
      {/* Navbar Header - Always visible */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-500 ease-in-out ${
          scrolled 
            ? "bg-gradient-to-b from-black/60 to-transparent py-4 backdrop-blur-[2px]" 
            : "bg-transparent py-8"
        }`}
      >
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="group flex items-center gap-3">
              <Image 
                src="/twc-logo.png" 
                alt="Tropicana Worldwide Corp. Logo" 
                width={40} 
                height={40}
                className="object-contain"
              />
              <div>
                <span className="font-serif text-xl tracking-widest text-white uppercase group-hover:opacity-80 transition-opacity">
                  Tropicana
                </span>
                <span className="block text-[0.5rem] tracking-[0.2em] text-white/60 uppercase group-hover:text-white transition-colors">
                  Worldwide Corp.
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-xs font-medium tracking-[0.2em] uppercase text-white/80 hover:text-white transition-colors relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-2 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
              
              {/* Cart Icon */}
              <Link href="/cart" className="relative p-2 text-white/80 hover:text-white transition-colors">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
              
              <Link href="/properties">
                <Button 
                  variant="outline" 
                  className="bg-transparent text-white border-white/20 hover:bg-white hover:text-black rounded-none px-8 tracking-widest text-xs uppercase transition-all duration-500"
                >
                  Book Now
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Overlay - Rendered as sibling to avoid stacking context issues */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-neutral-950 flex items-center justify-center md:hidden"
          >
            <div className="flex flex-col items-center gap-8">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.name}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Link
                    href={link.href}
                    className="font-serif text-4xl text-white/90 italic hover:text-white transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Link href="/properties" onClick={() => setIsOpen(false)}>
                  <Button 
                     className="mt-8 rounded-none px-12 py-6 text-lg bg-white text-black hover:bg-neutral-200"
                  >
                    Book Your Stay
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
