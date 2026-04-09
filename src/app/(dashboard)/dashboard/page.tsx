"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  LogIn,
  LogOut,
  Wallet,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { getBungalows, calculateBalance } from "@/lib/queries";
import { ReservationDetailDialog } from "@/components/reservation-detail-dialog";
import { cn } from "@/lib/utils";
import type { Bungalow } from "@/types";

const BUNGALOW_DOT_COLORS: Record<string, string> = {
  Ayder: "bg-emerald-500", Kavrun: "bg-teal-500", Badara: "bg-green-500",
  "İlastas": "bg-lime-600", Huser: "bg-blue-500", "Sarı Çiçek": "bg-amber-500",
  "Çiçekli": "bg-pink-500", Gito: "bg-indigo-500", Elevit: "bg-orange-500",
};

interface ReservationRow {
  id: string;
  bungalow_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  nightly_rate: number;
  status: string;
  notes?: string;
  guest: { id: string; full_name: string; phone: string; tc_no?: string } | null;
  bungalow: Bungalow | null;
  charges?: { amount: number }[];
  payments?: { amount: number }[];
}

export default function DashboardPage() {
  const [bungalows, setBungalows] = useState<Bungalow[]>([]);
  const [allReservations, setAllReservations] = useState<ReservationRow[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<{ label: string; income: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<ReservationRow | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const currentYear = new Date().getFullYear();

  const fetchData = async () => {
    setLoading(true);
    const [b, { data: reservations }] = await Promise.all([
      getBungalows(),
      supabase
        .from("reservations")
        .select("*, guest:guests(*), bungalow:bungalows(*), charges(*), payments(*)")
        .neq("status", "cancelled")
        .order("check_in", { ascending: false }),
    ]);
    setBungalows(b);
    setAllReservations((reservations ?? []) as ReservationRow[]);

    // Aylık gelir (son 6 ay)
    const months = eachMonthOfInterval({
      start: new Date(currentYear, new Date().getMonth() - 5, 1),
      end: new Date(currentYear, new Date().getMonth(), 28),
    });
    const monthly = months.map((m) => {
      const mStr = format(m, "yyyy-MM");
      const income = (reservations ?? [])
        .filter((r: { check_in: string }) => r.check_in.startsWith(mStr))
        .reduce((sum: number, r: { check_in: string; check_out: string; nightly_rate: number; charges: { amount: number }[] | null }) => {
          const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);
          const acc = nights * Number(r.nightly_rate);
          const ch = (r.charges ?? []).reduce((s: number, c: { amount: number }) => s + Number(c.amount), 0);
          return sum + acc + ch;
        }, 0);
      return { label: format(m, "MMM", { locale: tr }), income };
    });
    setMonthlyIncome(monthly);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Hesaplamalar
  const activeReservations = allReservations.filter(
    (r) => r.check_in <= today && r.check_out > today
  );
  const occupiedCount = activeReservations.length;
  const todayCheckIns = allReservations.filter((r) => r.check_in === today);
  const todayCheckOuts = allReservations.filter((r) => r.check_out === today);
  const totalBalance = allReservations
    .filter((r) => r.status === "confirmed" || r.status === "checked_in")
    .reduce((s, r) => s + calculateBalance(r), 0);
  const occupancyRate = Math.round((occupiedCount / 9) * 100);

  // Yaklaşan rezervasyonlar (gelecek 7 gün)
  const upcoming = allReservations
    .filter((r) => r.check_in > today && r.check_in <= format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd"))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Yükleniyor...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <BedDouble className="h-4 w-4" />
            Doluluk
          </div>
          <p className="text-2xl font-bold">{occupiedCount}<span className="text-muted-foreground text-lg font-normal">/9</span></p>
          <p className="text-xs text-muted-foreground mt-1">%{occupancyRate} dolu</p>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CalendarDays className="h-4 w-4" />
            Bugün
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div>
              <p className="text-xl font-bold text-emerald-600">{todayCheckIns.length}</p>
              <p className="text-[11px] text-muted-foreground">giriş</p>
            </div>
            <div>
              <p className="text-xl font-bold text-orange-500">{todayCheckOuts.length}</p>
              <p className="text-[11px] text-muted-foreground">çıkış</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Wallet className="h-4 w-4" />
            Açık Bakiye
          </div>
          <p className={cn("text-2xl font-bold", totalBalance > 0 ? "text-destructive" : "text-emerald-600")}>
            {totalBalance.toLocaleString("tr-TR")}₺
          </p>
          <p className="text-xs text-muted-foreground mt-1">aktif rezervasyonlar</p>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Bu Ay Gelir
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {(monthlyIncome[monthlyIncome.length - 1]?.income ?? 0).toLocaleString("tr-TR")}₺
          </p>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(), "MMMM", { locale: tr })}</p>
        </div>
      </div>

      {/* Middle Row: Bungalov durumları + Gelir grafiği */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bungalov Mini Grid */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Bungalovlar</h3>
              <Link href="/calendar">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  Takvim <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {bungalows.map((b) => {
                const active = activeReservations.find((r) => r.bungalow_id === b.id);
                const isOccupied = !!active;
                return (
                  <div
                    key={b.id}
                    onClick={() => { if (active) { setSelectedRes(active); setDetailOpen(true); } }}
                    className={cn(
                      "rounded-xl border p-3 transition-all",
                      isOccupied ? "cursor-pointer hover:bg-muted/40" : ""
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={cn("w-2 h-2 rounded-full", BUNGALOW_DOT_COLORS[b.name])} />
                      <span className="text-xs font-medium truncate">{b.name}</span>
                    </div>
                    {isOccupied ? (
                      <div>
                        <p className="text-[11px] font-medium truncate">{active.guest?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          → {format(new Date(active.check_out + "T00:00:00"), "d MMM", { locale: tr })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-500 font-medium">Müsait</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Gelir Grafiği */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Son 6 Ay Gelir</h3>
              <Link href="/finance">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  Finans <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="h-[200px] min-w-0 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyIncome}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => `${Number(value).toLocaleString("tr-TR")}₺`}
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "13px" }}
                  />
                  <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Bugün giriş/çıkış + Yaklaşan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bugünkü Giriş/Çıkışlar */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Bugün</h3>
            {todayCheckIns.length === 0 && todayCheckOuts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Bugün giriş veya çıkış yok</p>
            ) : (
              <div className="space-y-2">
                {todayCheckIns.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedRes(r); setDetailOpen(true); }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                  >
                    <LogIn className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.bungalow?.name}</p>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600">Giriş</span>
                  </div>
                ))}
                {todayCheckOuts.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedRes(r); setDetailOpen(true); }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-orange-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.bungalow?.name}</p>
                    </div>
                    <span className="text-[11px] font-medium text-orange-600">Çıkış</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Yaklaşan Rezervasyonlar */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Yaklaşan (7 gün)</h3>
              <Link href="/reservations">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  Tümü <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Yaklaşan rezervasyon yok</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedRes(r); setDetailOpen(true); }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", BUNGALOW_DOT_COLORS[r.bungalow?.name ?? ""])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.bungalow?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(r.check_in + "T00:00:00"), "d MMM", { locale: tr })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <ReservationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        reservation={selectedRes}
        onSuccess={fetchData}
      />
    </div>
  );
}
