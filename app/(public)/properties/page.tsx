import { Button } from "@/components/ui/button";
import { getProperties } from "@/actions/public/properties";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default async function PropertiesPage() {
  const properties = await getProperties();

  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-24 pb-12">
      <div className="container mx-auto px-4">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-sm text-neutral-400 hover:text-white transition-colors mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-4xl md:text-6xl font-serif font-light mb-4">
            Our Collection
          </h1>
          <p className="text-xl text-neutral-400 font-light max-w-2xl">
            Explore our portfolio of distinctive properties, each offering a unique story and experience.
          </p>
        </div>

        <div className="space-y-24">
          {properties.map((prop, index) => (
            <div
              key={prop.id}
              className={`flex flex-col ${index % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"} gap-8 md:gap-16 items-center`}
            >
              <div className="w-full md:w-1/2 aspect-[4/3] bg-neutral-900 rounded-none overflow-hidden relative group border border-white/5">
                  <Image
                    src={prop.image}
                    alt={prop.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
               </div>
              
              <div className="w-full md:w-1/2 space-y-6">
                <div className="flex items-center text-orange-400 font-medium tracking-wide text-sm uppercase">
                  <MapPin className="h-4 w-4 mr-2" />
                  {prop.location}
                </div>
                <h2 className="text-3xl md:text-5xl font-serif font-light">{prop.name}</h2>
                <p className="text-neutral-400 text-lg leading-relaxed font-light">
                  {prop.longDescription}
                </p>
                <div className="pt-4">
                  <Link href={`/properties/${prop.slug}`}>
                    <Button size="lg" className="rounded-none px-8 tracking-widest text-xs uppercase bg-white text-black hover:bg-neutral-200 transition-all duration-500">
                       View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
