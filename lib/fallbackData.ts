// Fallback/mock data used for pages that need to show something
// before the DB is seeded or during development

export const fallbackOrders = [
  { _id: "1", orderId: "ORD-8821", customer: "Arjun Sharma",  customerEmail: "arjun@example.com", product: "Premium Plan",    total: 2999, status: "completed", createdAt: new Date("2025-04-20").toISOString() },
  { _id: "2", orderId: "ORD-8820", customer: "Priya Patel",   customerEmail: "priya@example.com", product: "Basic Plan",       total: 999,  status: "pending",   createdAt: new Date("2025-04-19").toISOString() },
  { _id: "3", orderId: "ORD-8819", customer: "Rahul Verma",   customerEmail: "rahul@example.com", product: "Enterprise Plan", total: 9999, status: "completed", createdAt: new Date("2025-04-18").toISOString() },
  { _id: "4", orderId: "ORD-8818", customer: "Sneha Gupta",   customerEmail: "sneha@example.com", product: "Premium Plan",    total: 2999, status: "failed",    createdAt: new Date("2025-04-17").toISOString() },
  { _id: "5", orderId: "ORD-8817", customer: "Vikram Singh",  customerEmail: "vikram@example.com",product: "Basic Plan",       total: 999,  status: "completed", createdAt: new Date("2025-04-16").toISOString() },
  { _id: "6", orderId: "ORD-8816", customer: "Ananya Nair",   customerEmail: "ananya@example.com",product: "Premium Plan",    total: 2999, status: "completed", createdAt: new Date("2025-04-15").toISOString() },
  { _id: "7", orderId: "ORD-8815", customer: "Rohan Mehta",   customerEmail: "rohan@example.com", product: "Enterprise Plan", total: 9999, status: "completed", createdAt: new Date("2025-04-14").toISOString() },
  { _id: "8", orderId: "ORD-8814", customer: "Kavya Reddy",   customerEmail: "kavya@example.com", product: "Basic Plan",       total: 999,  status: "pending",   createdAt: new Date("2025-04-13").toISOString() },
];

export const fallbackUsers = [
  { _id: "1", name: "Arjun Sharma",  email: "arjun@example.com",  phone: "+91 98765 43210", city: "Mumbai",    plan: "Premium",    status: "active",    totalSpend: 14997, createdAt: new Date("2025-01-12").toISOString() },
  { _id: "2", name: "Priya Patel",   email: "priya@example.com",  phone: "+91 87654 32109", city: "Ahmedabad", plan: "Basic",       status: "active",    totalSpend: 2997,  createdAt: new Date("2025-02-03").toISOString() },
  { _id: "3", name: "Rahul Verma",   email: "rahul@example.com",  phone: "+91 76543 21098", city: "Delhi",     plan: "Enterprise", status: "active",    totalSpend: 49995, createdAt: new Date("2024-11-19").toISOString() },
  { _id: "4", name: "Sneha Gupta",   email: "sneha@example.com",  phone: "+91 65432 10987", city: "Bangalore", plan: "Premium",    status: "inactive",  totalSpend: 5997,  createdAt: new Date("2025-03-28").toISOString() },
  { _id: "5", name: "Vikram Singh",  email: "vikram@example.com", phone: "+91 54321 09876", city: "Jaipur",    plan: "Basic",       status: "active",    totalSpend: 999,   createdAt: new Date("2025-04-07").toISOString() },
  { _id: "6", name: "Ananya Nair",   email: "ananya@example.com", phone: "+91 43210 98765", city: "Chennai",   plan: "Premium",    status: "active",    totalSpend: 8994,  createdAt: new Date("2024-12-15").toISOString() },
  { _id: "7", name: "Rohan Mehta",   email: "rohan@example.com",  phone: "+91 32109 87654", city: "Pune",      plan: "Enterprise", status: "suspended", totalSpend: 29997, createdAt: new Date("2024-10-22").toISOString() },
  { _id: "8", name: "Kavya Reddy",   email: "kavya@example.com",  phone: "+91 21098 76543", city: "Hyderabad", plan: "Basic",       status: "active",    totalSpend: 1998,  createdAt: new Date("2025-05-01").toISOString() },
];