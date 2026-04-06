import { supabase } from "@/lib/supabase";
import type { Bungalow } from "@/types";

export async function getBungalows(): Promise<Bungalow[]> {
  const { data, error } = await supabase
    .from("bungalows")
    .select("*")
    .order("order_index");

  if (error) throw error;
  return data ?? [];
}

export async function getReservationsByMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*), bungalow:bungalows(*)")
    .neq("status", "cancelled")
    .lt("check_in", endDate)
    .gt("check_out", startDate);

  if (error) throw error;
  return data ?? [];
}

export async function getActiveReservations() {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*), bungalow:bungalows(*), charges(*), payments(*)")
    .in("status", ["confirmed", "checked_in"])
    .lte("check_in", today)
    .gt("check_out", today);

  if (error) throw error;
  return data ?? [];
}

export async function getUpcomingReservations(bungalowId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*)")
    .eq("bungalow_id", bungalowId)
    .neq("status", "cancelled")
    .gte("check_in", today)
    .order("check_in")
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

export function calculateBalance(
  reservation: {
    check_in: string;
    check_out: string;
    nightly_rate: number;
    charges?: { amount: number }[];
    payments?: { amount: number }[];
  }
) {
  const checkIn = new Date(reservation.check_in);
  const checkOut = new Date(reservation.check_out);
  const nights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  );
  const accommodation = nights * reservation.nightly_rate;
  const totalCharges = (reservation.charges ?? []).reduce(
    (sum, c) => sum + Number(c.amount),
    0
  );
  const totalPayments = (reservation.payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  return accommodation + totalCharges - totalPayments;
}
