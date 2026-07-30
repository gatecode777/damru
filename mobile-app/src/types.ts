export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  avatar?: string;
  createdAt?: string;
};

export type MenuItem = {
  _id: string;
  name: string;
  desc: string;
  image?: string;
  price: number;
  hasVariants?: boolean;
  category?: string;
  catSlug?: string;
  custom?: string;
  qty?: number;
};

export type CartItem = {
  menuItemId: string;
  name: string;
  image?: string;
  custom?: string;
  price: number;
  qty: number;
};

export type Branch = {
  _id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  phone?: string;
  contact?: string;
  timing?: string;
  cardImage?: string;
  cardAlt?: string;
  heroImage?: string;
  shortDescription?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type GalleryTab = {
  _id: string;
  tabKey: string;
  label: string;
  images: (string | { image?: string; url?: string; alt?: string })[];
};

export type Address = {
  _id?: string;
  label: string;
  fullName: string;
  phone: string;
  house: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

export type ApiError = { error?: string; message?: string };
