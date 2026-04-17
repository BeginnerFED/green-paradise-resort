"use client";

import { useState, useEffect } from "react";
import { format, eachMonthOfInterval } from "date-fns";
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
  Phone,
  Users,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold mb-1.5 capitalize">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{Number(p.value ?? 0).toLocaleString("tr-TR")}₺</span>
        </div>
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const [bungalows, setBungalows] = useState<Bungalow[]>([]);
  const [allReservations, setAllReservations] = useState<ReservationRow[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<{ label: string; income: number; current: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<ReservationRow | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const currentYear = new Date().getFullYear();
  const currentMonthStr = format(new Date(), "yyyy-MM");

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

    // Son 6 ay
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
      return { label: format(m, "MMM", { locale: tr }), income, current: mStr === currentMonthStr };
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

  const thisMonthIncome = monthlyIncome[monthlyIncome.length - 1]?.income ?? 0;
  const lastMonthIncome = monthlyIncome[monthlyIncome.length - 2]?.income ?? 0;
  const incomeTrend = lastMonthIncome > 0
    ? Math.round(((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100)
    : 0;

  const upcoming = allReservations
    .filter((r) => r.check_in > today && r.check_in <= format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd"))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Yükleniyor...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5 capitalize">
          {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Doluluk */}
        <div className="rounded-2xl border p-5 bg-gradient-to-br from-blue-500/5 to-transparent">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <BedDouble className="h-3.5 w-3.5" />
              Doluluk
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BedDouble className="h-4 w-4 text-blue-500" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-[28px] leading-tight font-bold tabular-nums">
            {occupiedCount}
            <span className="text-xl text-muted-foreground font-normal">/9</span>
          </p>
          {/* Mini bar */}
          <div className="flex gap-0.5 mt-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-1.5 rounded-full",
                  i < occupiedCount ? "bg-blue-500" : "bg-muted"
                )}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">%{occupancyRate} dolu</p>
        </div>

        {/* Bugün */}
        <div className="rounded-2xl border p-5 bg-gradient-to-br from-violet-500/5 to-transparent">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <Activity className="h-3.5 w-3.5" />
              Bugün
            </div>
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-violet-500" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[28px] leading-tight font-bold text-emerald-600 tabular-nums">
                {todayCheckIns.length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">giriş</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-[28px] leading-tight font-bold text-orange-500 tabular-nums">
                {todayCheckOuts.length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">çıkış</p>
            </div>
          </div>
        </div>

        {/* Açık Bakiye */}
        <div className={cn(
          "rounded-2xl border p-5 bg-gradient-to-br to-transparent",
          totalBalance > 0 ? "from-rose-500/5" : "from-emerald-500/5"
        )}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <Wallet className="h-3.5 w-3.5" />
              Açık Bakiye
            </div>
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              totalBalance > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"
            )}>
              <Wallet className={cn(
                "h-4 w-4",
                totalBalance > 0 ? "text-rose-500" : "text-emerald-500"
              )} strokeWidth={2.5} />
            </div>
          </div>
          <p className={cn(
            "text-[28px] leading-tight font-bold tabular-nums",
            totalBalance > 0 ? "text-rose-500" : "text-emerald-600"
          )}>
            {totalBalance.toLocaleString("tr-TR")}
            <span className="text-xl font-normal ml-0.5">₺</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {totalBalance > 0 ? "tahsil edilecek" : "tüm ödemeler tamam"}
          </p>
        </div>

        {/* Bu Ay Gelir */}
        <div className="rounded-2xl border p-5 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />
              Bu Ay
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-[28px] leading-tight font-bold text-emerald-600 tabular-nums">
            {thisMonthIncome.toLocaleString("tr-TR")}
            <span className="text-xl font-normal ml-0.5">₺</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {lastMonthIncome > 0 && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium",
                incomeTrend > 0 ? "text-emerald-500" : incomeTrend < 0 ? "text-rose-500" : "text-muted-foreground"
              )}>
                {incomeTrend > 0 ? "↑" : incomeTrend < 0 ? "↓" : "—"} %{Math.abs(incomeTrend)}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">geçen aya göre</span>
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Bungalovlar + Grafik */}
        <div className="lg:col-span-2 space-y-4">
          {/* Bungalov Grid */}
          <div className="rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Bungalov Durumu</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {occupiedCount} dolu · {9 - occupiedCount} müsait
                </p>
              </div>
              <Link href="/calendar">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-8">
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
                      isOccupied
                        ? "cursor-pointer hover:bg-muted/40 hover:border-foreground/20"
                        : "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-500/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", BUNGALOW_DOT_COLORS[b.name])} />
                        <span className="text-xs font-semibold truncate">{b.name}</span>
                      </div>
                      {!isOccupied && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                    {isOccupied ? (
                      <div>
                        <p className="text-[11px] font-medium truncate">{active.guest?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          → {format(new Date(active.check_out + "T00:00:00"), "d MMM", { locale: tr })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">Müsait</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gelir Grafiği */}
          <div className="rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold">Son 6 Ay Gelir</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Aylık konaklama + harcama gelirleri
                </p>
              </div>
              <Link href="/finance">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-8">
                  Finans <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="h-[220px] min-w-0 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyIncome}
                  margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.15)" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "currentColor", opacity: 0.6 }} dy={6} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`)} tick={{ fill: "currentColor", opacity: 0.5 }} width={48} />
                  <Tooltip
                    cursor={{ fill: "rgba(127,127,127,0.08)", radius: 8 }}
                    content={<ChartTooltip />}
                  />
                  <Bar dataKey="income" name="Gelir" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {monthlyIncome.map((m, idx) => (
                      <Cell key={idx} fill={m.current ? "#10b981" : "#10b98180"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT: Bugün + Yaklaşan */}
        <div className="space-y-4">
          {/* Bugün */}
          <div className="rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-sm font-semibold">Bugün</h3>
              <span className="text-[11px] text-muted-foreground">
                {todayCheckIns.length + todayCheckOuts.length} hareket
              </span>
            </div>
            {todayCheckIns.length === 0 && todayCheckOuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Bugün hareket yok</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Giriş/çıkış bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y">
                {todayCheckIns.map((r) => {
                  const initials = getInitials(r.guest?.full_name ?? "?");
                  return (
                    <div
                      key={r.id}
                      onClick={() => { setSelectedRes(r); setDetailOpen(true); }}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 relative">
                        <span className="text-[11px] font-semibold text-emerald-600">{initials}</span>
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                          <LogIn className="h-2 w-2 text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.bungalow?.name} · {r.guest?.phone}</p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 shrink-0">Giriş</span>
                    </div>
                  );
                })}
                {todayCheckOuts.map((r) => {
                  const initials = getInitials(r.guest?.full_name ?? "?");
                  return (
                    <div
                      key={r.id}
                      onClick={() => { setSelectedRes(r); setDetailOpen(true); }}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 relative">
                        <span className="text-[11px] font-semibold text-orange-600">{initials}</span>
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 border-2 border-background flex items-center justify-center">
                          <LogOut className="h-2 w-2 text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.bungalow?.name} · {r.guest?.phone}</p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 shrink-0">Çıkış</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Yaklaşan */}
          <div className="rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-sm font-semibold">Yaklaşan</h3>
                <p className="text-[10px] text-muted-foreground">gelecek 7 gün</p>
              </div>
              <Link href="/reservations">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-8">
                  Tümü <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Yaklaşan yok</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">7 gün içinde rezervasyon yok</p>
              </div>
            ) : (
              <div className="divide-y">
                {upcoming.map((r) => {
                  const initials = getInitials(r.guest?.full_name ?? "?");
                  const daysUntil = Math.ceil((new Date(r.check_in + "T00:00:00").getTime() - new Date().getTime()) / 86400000);
                  return (
                    <div
                      key={r.id}
                      onClick={() => { setSelectedRes(r); setDetailOpen(true); }}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-foreground/[0.06] dark:bg-foreground/10 flex items-center justify-center">
                          <span className="text-[11px] font-semibold text-foreground/70">{initials}</span>
                        </div>
                        <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background", BUNGALOW_DOT_COLORS[r.bungalow?.name ?? ""])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.bungalow?.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">
                          {format(new Date(r.check_in + "T00:00:00"), "d MMM", { locale: tr })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {daysUntil === 0 ? "bugün" : daysUntil === 1 ? "yarın" : `${daysUntil} gün`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
