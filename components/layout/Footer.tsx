
import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-muted/50 py-12 border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/twc-logo.png" 
                alt="Tropicana Worldwide Corp. Logo" 
                width={36} 
                height={36}
                className="object-contain"
              />
              <h3 className="text-lg font-bold">Tropicana Worldwide Corp.</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Experiencing luxury across the globe.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Properties</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/properties/anchor-hotel" className="hover:text-foreground">Anchor Hotel</Link></li>
              <li><Link href="/properties/dolores-farm-resort" className="hover:text-foreground">Dolores Farm Resort</Link></li>
              <li><Link href="/properties/dolores-lake-resort" className="hover:text-foreground">Dolores Lake Resort</Link></li>
              <li><Link href="/properties/dolores-tropicana-resort" className="hover:text-foreground">Dolores Tropicana Resort</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link href="/careers" className="hover:text-foreground">Careers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Tropicana Worldwide Corporation. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
