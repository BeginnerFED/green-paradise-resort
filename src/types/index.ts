export interface Bungalow {
  id: string;
  name: string;
  capacity: number;
  nightly_rate: number;
  order_index: number;
}

export interface Guest {
  id: string;
  full_name: string;
  phone: string;
  tc_no?: string;
  notes?: string;
  created_at: string;
}

export interface Reservation {
  id: string;
  bungalow_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  status: "confirmed" | "checked_in" | "checked_out" | "cancelled";
  nightly_rate: number;
  notes?: string;
  created_at: string;
  // joined
  bungalow?: Bungalow;
  guest?: Guest;
  charges?: Charge[];
  payments?: Payment[];
}

export interface Charge {
  id: string;
  reservation_id: string;
  description: string;
  amount: number;
  category: "restaurant" | "minibar" | "extra" | "other";
  created_at: string;
}

export interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  notes?: string;
  created_at: string;
}

export const BUNGALOW_NAMES = [
  "Ayder",
  "Kavrun",
  "Badara",
  "İlastas",
  "Huser",
  "Sarı Çiçek",
  "Çiçekli",
  "Gito",
  "Elevit",
] as const;

export const BUNGALOW_COLORS: Record<string, string> = {
  Ayder: "bg-emerald-500",
  Kavrun: "bg-teal-500",
  Badara: "bg-green-500",
  "İlastas": "bg-lime-600",
  Huser: "bg-cyan-600",
  "Sarı Çiçek": "bg-yellow-600",
  "Çiçekli": "bg-pink-500",
  Gito: "bg-indigo-500",
  Elevit: "bg-orange-500",
};
