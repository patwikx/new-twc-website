"use client";

import { BookingWidget } from "@/components/booking/BookingWidget";
import { Button } from "@/components/ui/button";
import { BackToTopButton } from "@/components/ui/back-to-top";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Star, Plus, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import axios from "axios";

const heroImages = [
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVVV8DoInl8YJnfQXZwHKRbB5kUFVSIov20cma",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVLhxEZ8Fc1UptDEajs5veJ36H7Ki9oPrWY2ON",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVCbuJsLAK38AKlBqGNT7RI5pYizjQHwtvsrfV",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVRlnPT0iBg1ydiaq5LNXQVuEso6hCczW2ejlw",
  "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCV9n2ugPezJB0e3I8TZNRHvqsKkSblXQwiEfan",
];

interface PropertyRoom {
  id: string;
  name: string;
  image: string;
  price: number;
  capacity: number;
}

interface Property {
  id: string;
  slug: string;
  name: string;
  location: string;
  description: string;
  image: string;
  rooms: PropertyRoom[];
}

interface HomePageClientProps {
  properties: Property[];
}

export default function HomePageClient({ properties }: HomePageClientProps) {
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
      <section className="relative min-h-[110vh] h-auto flex items-center justify-center overflow-hidden py-20">
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
            <BookingWidget properties={properties} />
          </motion.div>
        </div>
        
        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-4 z-20"
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
            {properties.map((prop, index) => (
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

      {/* Guest Testimonials - Animated Carousel */}
      <TestimonialsSection />
      
      {/* FAQ Section */}
      <FAQSection />

      {/* Newsletter Section */}
      <NewsletterSection />
      
      {/* Back to Top */}
      <BackToTopButton />
    </div>
  );
}

// Newsletter Section Component
function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");

    try {
      await axios.post("/api/newsletter", { email });
      setStatus("success");
      setMessage("Welcome to the Inner Circle. Please check your inbox.");
      setEmail("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="py-32 bg-neutral-950 text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[100px]" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="mx-auto w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-orange-500 mb-6 border border-white/10">
             <Mail className="h-6 w-6" />
          </div>
          
          <h2 className="text-4xl md:text-5xl font-serif">
            Join the <span className="italic text-neutral-500">Inner Circle</span>
          </h2>
          
          <p className="text-neutral-400 font-light leading-relaxed max-w-xl mx-auto">
            Subscribe to receive exclusive offers, early access to seasonal packages, and curated travel inspiration from Tropicana Worldwide.
          </p>

          <form className="max-w-md mx-auto pt-6" onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <Input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address" 
                disabled={status === "loading" || status === "success"}
                className="bg-white/5 border-white/10 h-12 text-white placeholder:text-neutral-500 focus:border-orange-500/50 rounded-none focus:ring-0"
              />
              <Button 
                type="submit" 
                disabled={status === "loading" || status === "success"}
                className="h-12 px-8 bg-neutral-100 hover:bg-white text-black font-medium tracking-wide uppercase text-xs rounded-none transition-all disabled:opacity-70"
              >
                {status === "loading" ? "Joining..." : status === "success" ? "Joined" : "Subscribe"}
              </Button>
            </div>
            
            {/* Feedback Message */}
            <AnimatePresence mode="wait">
              {message && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-[10px] mt-4 uppercase tracking-widest ${
                    status === "success" ? "text-orange-500" : 
                    status === "error" ? "text-red-500" : 
                    "text-neutral-600"
                  }`}
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
            
            {!message && (
              <p className="text-[10px] text-neutral-600 mt-4 uppercase tracking-widest">
                We respect your privacy. Unsubscribe at any time.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

// Testimonials Carousel Component
function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  
  const testimonials = [
    {
      name: "Maria Santos",
      location: "Manila, Philippines",
      rating: 5,
      text: "An absolutely breathtaking experience. The attention to detail at Dolores Hotel exceeded all expectations. The staff made us feel like royalty from check-in to checkout.",
      property: "Dolores Hotel"
    },
    {
      name: "James Wilson",
      location: "Singapore",
      rating: 5,
      text: "Cafe Rodrigo alone is worth the visit. The farm-to-table concept using ingredients from Dolores Farm creates an unparalleled dining experience. Will definitely return!",
      property: "Cafe Rodrigo"
    },
    {
      name: "Elena Rodriguez",
      location: "Davao City, Philippines",
      rating: 5,
      text: "We hosted our wedding at Anchor Hotel and it was absolutely perfect. The event team was incredibly professional and the venue was stunning. Memories we'll cherish forever.",
      property: "Anchor Hotel"
    },
    {
      name: "David Chen",
      location: "Hong Kong",
      rating: 5,
      text: "The perfect blend of luxury and Filipino hospitality. The rooms are immaculate, the views are spectacular, and the service is world-class. A hidden gem in General Santos!",
      property: "Dolores Hotel"
    }
  ];

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  return (
    <section className="py-32 bg-neutral-950 text-white relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-20 left-10 w-96 h-96 border border-white/5 rounded-full" />
      <div className="absolute bottom-20 right-10 w-64 h-64 border border-orange-500/10 rounded-full" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 space-y-6">
          <span className="text-orange-500 tracking-widest text-xs uppercase">Guest Experiences</span>
          <h2 className="text-4xl md:text-6xl font-serif">
            What Our Guests <span className="italic text-neutral-500">Say</span>
          </h2>
        </div>

        {/* Featured Testimonial */}
        <div className="max-w-4xl mx-auto text-center relative min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Large Quote */}
              <div className="text-6xl text-orange-500/30 font-serif">"</div>
              
              <p className="text-2xl md:text-3xl font-serif font-light leading-relaxed text-neutral-200 -mt-8">
                {testimonials[activeIndex].text}
              </p>
              
              {/* Stars */}
              <div className="flex justify-center gap-1">
                {[...Array(testimonials[activeIndex].rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-orange-500 text-orange-500" />
                ))}
              </div>
              
              {/* Author */}
              <div className="space-y-2">
                <p className="text-lg font-medium text-white">{testimonials[activeIndex].name}</p>
                <p className="text-sm text-neutral-500">{testimonials[activeIndex].location}</p>
                <p className="text-xs text-orange-500 uppercase tracking-widest">{testimonials[activeIndex].property}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-3 mt-12">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === activeIndex 
                  ? "bg-orange-500 w-8" 
                  : "bg-neutral-600 hover:bg-neutral-500"
              }`}
              aria-label={`View testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ Section Component
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What are the check-in and check-out times?",
      answer: "Check-in is from 2:00 PM onwards, and check-out is until 12:00 PM (noon). Early check-in and late check-out requests are subject to availability and may incur additional charges."
    },
    {
      question: "Do you offer airport transfers?",
      answer: "Yes, we provide private airport transfers for our guests. You can arrange this during your booking process or by contacting our concierge at least 24 hours prior to your arrival."
    },
    {
      question: "Is breakfast included in the room rate?",
      answer: "Most of our room packages include a daily buffet breakfast at Cafe Rodrigo. Please check the specific details of your selected room rate during booking."
    },
    {
      question: "Are pets allowed at the resort?",
      answer: "We welcome small pets in specifically designated pet-friendly villas. A cleaning fee and security deposit apply. Please inform us in advance if you plan to bring your furry friend."
    },
    {
      question: "Can I host a private event or wedding?",
      answer: "Absolutely. We specialize in bespoke weddings and corporate events. Our dedicated events team will assist you in planning every detail to ensure a memorable occasion."
    }
  ];

  return (
    <section className="py-32 bg-neutral-900 text-white relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="text-center mb-16 space-y-6">
          <span className="text-orange-500 tracking-widest text-xs uppercase">Help & Information</span>
          <h2 className="text-4xl md:text-6xl font-serif">
            Frequently Asked <span className="italic text-neutral-500">Questions</span>
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="border border-white/5 bg-white/5 hover:border-orange-500/30 transition-colors duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className="text-lg font-medium">{faq.question}</span>
                <span className={`text-orange-500 transition-transform duration-300 ${openIndex === index ? "rotate-45" : ""}`}>
                  <Plus className="h-5 w-5" />
                </span>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 pt-0 text-neutral-400 font-light leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
