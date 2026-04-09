"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Search, Filter, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { getBungalows, calculateBalance } from "@/lib/queries";
import { ReservationDialog } from "@/components/reservation-dialog";
import { ReservationDetailDialog } from "@/components/reservation-detail-dialog";
import { cn } from "@/lib/utils";
import type { Bungalow } from "@/types";

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

const statusConfig: Record<string, { label: string; dotColor: string; textColor: string; bgColor: string; borderColor: string }> = {
  confirmed: { label: "Onaylandı", dotColor: "bg-amber-500", textColor: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950", borderColor: "border-amber-500" },
  checked_in: { label: "Konaklıyor", dotColor: "bg-emerald-500", textColor: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950", borderColor: "border-emerald-500" },
  checked_out: { label: "Çıkış Yaptı", dotColor: "bg-muted-foreground", textColor: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-muted-foreground" },
  cancelled: { label: "İptal", dotColor: "bg-destructive", textColor: "text-destructive", bgColor: "bg-red-50 dark:bg-red-950", borderColor: "border-destructive" },
};

const BUNGALOW_DOT_COLORS: Record<string, string> = {
  Ayder: "bg-emerald-500", Kavrun: "bg-teal-500", Badara: "bg-green-500",
  "İlastas": "bg-lime-600", Huser: "bg-blue-500", "Sarı Çiçek": "bg-amber-500",
  "Çiçekli": "bg-pink-500", Gito: "bg-indigo-500", Elevit: "bg-orange-500",
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [bungalows, setBungalows] = useState<Bungalow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bungalowFilter, setBungalowFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Dialogs
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, { data }] = await Promise.all([
        getBungalows(),
        supabase
          .from("reservations")
          .select("*, guest:guests(*), bungalow:bungalows(*), charges(*), payments(*)")
          .order("check_in", { ascending: false }),
      ]);
      setBungalows(b);
      setReservations((data ?? []) as ReservationRow[]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered results
  const filtered = reservations.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (bungalowFilter !== "all" && r.bungalow_id !== bungalowFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = r.guest?.full_name?.toLowerCase().includes(q);
      const matchPhone = r.guest?.phone?.includes(q);
      const matchBungalow = r.bungalow?.name?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchBungalow) return false;
    }
    return true;
  });

  // Finansal özet
  const activeReservations = filtered.filter((r) => r.status !== "cancelled");
  const totalAccommodation = activeReservations.reduce((s, r) => {
    const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);
    return s + nights * Number(r.nightly_rate);
  }, 0);
  const totalCharges = activeReservations.reduce((s, r) => s + (r.charges ?? []).reduce((cs, c) => cs + Number(c.amount), 0), 0);
  const totalPayments = activeReservations.reduce((s, r) => s + (r.payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0), 0);
  const totalBalance = totalAccommodation + totalCharges - totalPayments;

  const hasActiveFilters = statusFilter !== "all" || bungalowFilter !== "all" || search !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kayıtlar</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} kayıt {hasActiveFilters ? "(filtrelenmiş)" : ""}
          </p>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="hover:brightness-90 active:scale-[0.98] transition-all">
          <Plus className="h-4 w-4 mr-1.5" />
          Yeni Rezervasyon
        </Button>
      </div>

      {/* Finansal Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Toplam Gelir</p>
          <p className="text-xl font-semibold mt-1">{(totalAccommodation + totalCharges).toLocaleString("tr-TR")}₺</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Tahsilat</p>
          <p className="text-xl font-semibold mt-1 text-emerald-600">{totalPayments.toLocaleString("tr-TR")}₺</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Açık Bakiye</p>
          <p className={cn("text-xl font-semibold mt-1", totalBalance > 0 ? "text-destructive" : "text-emerald-600")}>
            {totalBalance.toLocaleString("tr-TR")}₺
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Rezervasyon</p>
          <p className="text-xl font-semibold mt-1">{activeReservations.length}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Misafir adı, telefon veya bungalov ara..."
            className="pl-9 h-10"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl border bg-muted/30">
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="confirmed">Onaylandı</SelectItem>
              <SelectItem value="checked_in">Konaklıyor</SelectItem>
              <SelectItem value="checked_out">Çıkış Yaptı</SelectItem>
              <SelectItem value="cancelled">İptal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bungalowFilter} onValueChange={(v) => v && setBungalowFilter(v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Bungalov" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Bungalovlar</SelectItem>
              {bungalows.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter("all"); setBungalowFilter("all"); setSearch(""); }}
              className="h-9 text-muted-foreground"
            >
              Temizle
            </Button>
          )}
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">{hasActiveFilters ? "Filtreye uygun kayıt bulunamadı" : "Henüz kayıt yok"}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const status = statusConfig[r.status] ?? statusConfig.confirmed;
                const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);
                const bal = calculateBalance(r);

                return (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedReservation(r); setDetailDialogOpen(true); }}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    {/* Bungalov dot + Misafir */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", BUNGALOW_DOT_COLORS[r.bungalow?.name ?? ""])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.guest?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.bungalow?.name} · {format(new Date(r.check_in + "T00:00:00"), "d MMM", { locale: tr })} – {format(new Date(r.check_out + "T00:00:00"), "d MMM", { locale: tr })} · {nights}g
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <span className={cn(
                      "hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border shrink-0",
                      status.borderColor, status.textColor, status.bgColor
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", status.dotColor)} />
                      {status.label}
                    </span>

                    {/* Bakiye */}
                    <div className="text-right shrink-0 w-20">
                      <p className={cn(
                        "text-sm font-semibold tabular-nums",
                        r.status === "cancelled" ? "text-muted-foreground line-through" : bal > 0 ? "text-destructive" : "text-emerald-600"
                      )}>
                        {r.status === "cancelled" ? "—" : `${bal.toLocaleString("tr-TR")}₺`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ReservationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        bungalow={null}
        defaultCheckIn={format(new Date(), "yyyy-MM-dd")}
        bungalows={bungalows}
        onSuccess={fetchData}
      />

      <ReservationDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        reservation={selectedReservation}
        onSuccess={fetchData}
      />
    </div>
  );
}
