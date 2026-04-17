"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Search,
  Plus,
  X,
  TrendingUp,
  Banknote,
  Wallet,
  FileText,
  Users,
  CalendarDays,
  Phone,
  SlidersHorizontal,
  ArrowDownUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  guest_count?: number;
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

const SORT_OPTIONS: Record<string, string> = {
  check_in_desc: "En yeni tarih",
  check_in_asc: "En eski tarih",
  balance_desc: "Bakiye (yüksek)",
  balance_asc: "Bakiye (düşük)",
};

const STATUS_OPTIONS: Record<string, string> = {
  all: "Tüm Durumlar",
  confirmed: "Onaylandı",
  checked_in: "Konaklıyor",
  checked_out: "Çıkış Yaptı",
  cancelled: "İptal",
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [bungalows, setBungalows] = useState<Bungalow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bungalowFilter, setBungalowFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("check_in_desc");

  const [filterOpen, setFilterOpen] = useState(false);
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

  const filtered = reservations
    .filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (bungalowFilter !== "all" && r.bungalow_id !== bungalowFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.guest?.full_name?.toLowerCase().includes(q) &&
          !r.guest?.phone?.includes(q) &&
          !r.bungalow?.name?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "check_in_asc":
          return a.check_in.localeCompare(b.check_in);
        case "check_in_desc":
          return b.check_in.localeCompare(a.check_in);
        case "balance_desc":
          return calculateBalance(b) - calculateBalance(a);
        case "balance_asc":
          return calculateBalance(a) - calculateBalance(b);
        default:
          return 0;
      }
    });

  const activeReservations = filtered.filter((r) => r.status !== "cancelled");
  const totalAccommodation = activeReservations.reduce((s, r) => {
    const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);
    return s + nights * Number(r.nightly_rate);
  }, 0);
  const totalCharges = activeReservations.reduce((s, r) => s + (r.charges ?? []).reduce((cs, c) => cs + Number(c.amount), 0), 0);
  const totalPayments = activeReservations.reduce((s, r) => s + (r.payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0), 0);
  const totalBalance = totalAccommodation + totalCharges - totalPayments;

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (bungalowFilter !== "all" ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || search !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setBungalowFilter("all");
    setSearch("");
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kayıtlar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Tüm rezervasyon ve finans kayıtları
          </p>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="hover:brightness-90 active:scale-[0.98] transition-all shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Yeni Rezervasyon</span>
          <span className="sm:hidden">Yeni</span>
        </Button>
      </div>

      {/* Finansal Özet Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Toplam Gelir
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {(totalAccommodation + totalCharges).toLocaleString("tr-TR")}
            <span className="text-lg text-muted-foreground font-normal">₺</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">konaklama + harcama</p>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Banknote className="h-3.5 w-3.5" />
            Tahsilat
          </div>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">
            {totalPayments.toLocaleString("tr-TR")}
            <span className="text-lg font-normal">₺</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">toplam ödeme alınan</p>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Wallet className="h-3.5 w-3.5" />
            Açık Bakiye
          </div>
          <p className={cn("text-2xl font-bold tabular-nums", totalBalance > 0 ? "text-destructive" : "text-emerald-600")}>
            {totalBalance.toLocaleString("tr-TR")}
            <span className="text-lg font-normal">₺</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {totalBalance > 0 ? "tahsil edilecek" : "ödeme tamam"}
          </p>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <FileText className="h-3.5 w-3.5" />
            Rezervasyon
          </div>
          <p className="text-2xl font-bold tabular-nums">{activeReservations.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {filtered.length === activeReservations.length ? "aktif kayıt" : `${filtered.length - activeReservations.length} iptal dahil`}
          </p>
        </div>
      </div>

      {/* Search + Filter buton */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, telefon veya bungalov ile ara..."
            className="pl-9 pr-9 h-10 rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => setFilterOpen(true)}
          className="h-10 rounded-xl relative shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Filtreler</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 sm:static sm:ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-foreground text-background text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex items-center flex-wrap gap-2 -mt-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} sonuç
          </span>
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2.5 py-1 rounded-full transition-colors"
            >
              {STATUS_OPTIONS[statusFilter]}
              <X className="h-3 w-3" />
            </button>
          )}
          {bungalowFilter !== "all" && (
            <button
              onClick={() => setBungalowFilter("all")}
              className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2.5 py-1 rounded-full transition-colors"
            >
              {bungalows.find((b) => b.id === bungalowFilter)?.name}
              <X className="h-3 w-3" />
            </button>
          )}
          {search && (
            <button
              onClick={() => setSearch("")}
              className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2.5 py-1 rounded-full transition-colors"
            >
              &ldquo;{search}&rdquo;
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Tümünü temizle
          </button>
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {hasActiveFilters ? "Filtreye uygun kayıt bulunamadı" : "Henüz rezervasyon yok"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilters ? "Farklı filtre deneyebilirsiniz" : "İlk rezervasyonu oluşturmak için sağ üstteki butona tıklayın"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => {
              const status = statusConfig[r.status] ?? statusConfig.confirmed;
              const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);
              const bal = calculateBalance(r);
              const initials = getInitials(r.guest?.full_name ?? "?");

              return (
                <div
                  key={r.id}
                  onClick={() => { setSelectedReservation(r); setDetailDialogOpen(true); }}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-foreground/[0.06] dark:bg-foreground/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-foreground/70">{initials}</span>
                    </div>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background",
                      BUNGALOW_DOT_COLORS[r.bungalow?.name ?? ""]
                    )} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{r.guest?.full_name}</p>
                      <span className={cn(
                        "hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                        status.borderColor, status.textColor, status.bgColor
                      )}>
                        <div className={cn("w-1 h-1 rounded-full", status.dotColor)} />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground/80">{r.bungalow?.name}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(r.check_in + "T00:00:00"), "d MMM", { locale: tr })} → {format(new Date(r.check_out + "T00:00:00"), "d MMM", { locale: tr })}
                        <span className="text-muted-foreground/60">· {nights}g</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {r.guest_count ?? 2}
                      </span>
                      <span className="hidden md:flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {r.guest?.phone}
                      </span>
                    </div>
                  </div>

                  {/* Bakiye */}
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-sm font-semibold tabular-nums",
                      r.status === "cancelled" ? "text-muted-foreground line-through" : bal > 0 ? "text-destructive" : "text-emerald-600"
                    )}>
                      {r.status === "cancelled" ? "—" : `${bal.toLocaleString("tr-TR")}₺`}
                    </p>
                    {r.status !== "cancelled" && (
                      <p className="text-[10px] text-muted-foreground">
                        {bal > 0 ? "bakiye" : "ödendi"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Filtreler</SheetTitle>
            <SheetDescription>
              Kayıtları durumu, bungalova ve sıralama seçeneklerine göre filtreleyin
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Durum */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-1 h-4 bg-foreground rounded-full" />
                Durum
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUS_OPTIONS).map(([key, label]) => {
                  const active = statusFilter === key;
                  const cfg = key !== "all" ? statusConfig[key] : null;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left",
                        active
                          ? "border-foreground bg-foreground/5 font-medium"
                          : "border-border hover:border-foreground/40"
                      )}
                    >
                      {cfg ? (
                        <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Bungalov */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-1 h-4 bg-foreground rounded-full" />
                Bungalov
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBungalowFilter("all")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left",
                    bungalowFilter === "all"
                      ? "border-foreground bg-foreground/5 font-medium"
                      : "border-border hover:border-foreground/40"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                  <span className="truncate">Tümü</span>
                </button>
                {bungalows.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBungalowFilter(b.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left",
                      bungalowFilter === b.id
                        ? "border-foreground bg-foreground/5 font-medium"
                        : "border-border hover:border-foreground/40"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full shrink-0", BUNGALOW_DOT_COLORS[b.name])} />
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Sıralama */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-1 h-4 bg-foreground rounded-full" />
                Sıralama
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left",
                      sortBy === key
                        ? "border-foreground bg-foreground/5 font-medium"
                        : "border-border hover:border-foreground/40"
                    )}
                  >
                    <ArrowDownUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-muted/30">
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="text-muted-foreground"
            >
              Temizle
            </Button>
            <Button
              onClick={() => setFilterOpen(false)}
              className="hover:brightness-90 active:scale-[0.98] transition-all"
            >
              {filtered.length} sonucu göster
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
