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
  /** Canonical description field. Matches what /api/menu and /api/home-menu return. */
  description: string;
  image?: string;
  price: number;
  hasVariants?: boolean;
  category?: string;
  catSlug?: string;
  isVeg?: boolean;
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
  bannerImage?: string;
  shortDescription?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  whyChoose?: string;
  offerItems?: string[];
  eventTypes?: { label: string; image: string }[];
  hallCards?: IHallCard[];
  ctaTitle?: string;
  ctaSubtitle?: string;
};

export type GalleryItem = {
  _id: string;
  image: string;
  alt?: string;
  title: string;
  description: string;
  type?: "wide" | "narrow";
  overlayClass?: "" | "top-aligned";
  sortOrder?: number;
};

export type GalleryTab = {
  _id: string;
  tabKey: string;
  label: string;
  bannerImage?: string;
  bannerAlt?: string;
  isActive?: boolean;
  sortOrder?: number;
  items: GalleryItem[];
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

export type OrderItem = {
  name: string;
  qty: number;
  price?: number;
};

export type Order = {
  _id: string;
  orderId?: string;
  orderNumber?: string;
  status: string;
  paymentMethod: string;
  total: number;
  subtotal?: number;
  discount?: number;
  couponCode?: string;
  tax?: number;
  shipping?: number;
  items?: OrderItem[];
  deliveryAddress?: {
    fullName: string;
    phone: string;
    house: string;
    area?: string;
    city: string;
    state: string;
    pincode: string;
  };
  createdAt: string;
  tableNumber?: string;
  tableName?: string;
};

export type Coupon = {
  _id: string;
  code: string;
  description: string;
  type: string;
  value: number;
  expiryDate?: string | null;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  isDefault?: boolean;
};

export type Complaint = {
  _id: string;
  issueType: string;
  subject: string;
  description: string;
  attachment?: string;
  status: string;
  adminNote?: string;
  createdAt: string;
};

export interface IHallCard {
  _id?:        string;
  title:       string;
  subtitle:    string;
  description: string;
  features:    string[];
  perfectFor:  string[];
  images:      string[];
  sortOrder:   number;
}

