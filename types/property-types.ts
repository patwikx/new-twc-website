// Property types based on Prisma schema
export interface PropertyData {
  id: string;
  name: string;
  slug: string;
  location: string;
  tagline: string;
  description: string;
  mainImage: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyContextType {
  propertyId: string | null;
  setPropertyId: (id: string) => void;
}

export interface PropertyItem {
  id: string;
  name: string;
  slug: string;
  location: string;
  mainImage: string;
  isActive: boolean;
}
