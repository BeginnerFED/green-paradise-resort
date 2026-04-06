"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Phone, IdCard, Banknote, StickyNote, CalendarDays, Home } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { Bungalow } from "@/types";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bungalow: Bungalow | null;
  defaultCheckIn: string;
  bungalows: Bungalow[];
  onSuccess: () => void;
}

const BUNGALOW_DOT_COLORS: Record<string, string> = {
  Ayder: "bg-emerald-500",
  Kavrun: "bg-teal-500",
  Badara: "bg-green-500",
  "İlastas": "bg-lime-600",
  Huser: "bg-blue-500",
  "Sarı Çiçek": "bg-amber-500",
  "Çiçekli": "bg-pink-500",
  Gito: "bg-indigo-500",
  Elevit: "bg-orange-500",
};

export function ReservationDialog({
  open,
  onOpenChange,
  bungalow,
  defaultCheckIn,
  bungalows,
  onSuccess,
}: ReservationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedBungalowId, setSelectedBungalowId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestTcNo, setGuestTcNo] = useState("");
  const [checkInDate, setCheckInDate] = useState<Date | undefined>();
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>();
  const [nightlyRate, setNightlyRate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedBungalowId(bungalow?.id ?? "");
      const inDate = defaultCheckIn ? new Date(defaultCheckIn + "T00:00:00") : undefined;
      setCheckInDate(inDate);
      setCheckOutDate(inDate ? addDays(inDate, 1) : undefined);
      setNightlyRate(bungalow?.nightly_rate?.toString() ?? "2000");
      setGuestName("");
      setGuestPhone("");
      setGuestTcNo("");
      setNotes("");
      setError("");
    }
  }, [open, bungalow, defaultCheckIn]);

  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const diff = checkOutDate.getTime() - checkInDate.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate]);

  const totalPrice = nights * Number(nightlyRate || 0);

  const selectedBungalow = bungalows.find((b) => b.id === selectedBungalowId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedBungalowId || !guestName || !guestPhone || !checkInDate || !checkOutDate) {
      setError("Lütfen zorunlu alanları doldurun.");
      return;
    }

    if (checkOutDate <= checkInDate) {
      setError("Çıkış tarihi giriş tarihinden sonra olmalı.");
      return;
    }

    const checkIn = format(checkInDate, "yyyy-MM-dd");
    const checkOut = format(checkOutDate, "yyyy-MM-dd");

    setLoading(true);

    try {
      const { data: conflicts } = await supabase
        .from("reservations")
        .select("id")
        .eq("bungalow_id", selectedBungalowId)
        .neq("status", "cancelled")
        .lt("check_in", checkOut)
        .gt("check_out", checkIn);

      if (conflicts && conflicts.length > 0) {
        setError("Bu tarihler için bu bungalovda zaten bir rezervasyon var.");
        setLoading(false);
        return;
      }

      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert({
          full_name: guestName,
          phone: guestPhone,
          tc_no: guestTcNo || null,
        })
        .select()
        .single();

      if (guestError) throw guestError;

      const { error: resError } = await supabase.from("reservations").insert({
        bungalow_id: selectedBungalowId,
        guest_id: guest.id,
        check_in: checkIn,
        check_out: checkOut,
        nightly_rate: Number(nightlyRate),
        notes: notes || null,
        status: "confirmed",
      });

      if (resError) throw resError;

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">Yeni Rezervasyon</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-6 space-y-6">
            {/* Bungalov Seçimi - Chip style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Home className="h-4 w-4" />
                Bungalov
              </div>
              <div className="flex flex-wrap gap-2">
                {bungalows.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBungalowId(b.id);
                      setNightlyRate(b.nightly_rate.toString());
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all",
                      selectedBungalowId === b.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground/50"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", BUNGALOW_DOT_COLORS[b.name])} />
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Tarihler */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Tarih
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Giriş</span>
                  <DatePicker
                    value={checkInDate}
                    onChange={(date) => {
                      setCheckInDate(date);
                      if (date && (!checkOutDate || checkOutDate <= date)) {
                        setCheckOutDate(addDays(date, 1));
                      }
                    }}
                    placeholder="Giriş tarihi"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Çıkış</span>
                  <DatePicker
                    value={checkOutDate}
                    onChange={setCheckOutDate}
                    placeholder="Çıkış tarihi"
                    disabled={(date) => !!checkInDate && date <= checkInDate}
                  />
                </div>
              </div>
              {nights > 0 && (
                <p className="text-xs text-muted-foreground">
                  {nights} gece · {totalPrice.toLocaleString("tr-TR")}₺ toplam
                </p>
              )}
            </div>

            <Separator />

            {/* Misafir */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Misafir
              </div>
              <div className="space-y-3">
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ad Soyad *"
                  className="h-10"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="Telefon *"
                      className="h-10 pl-9"
                      required
                    />
                  </div>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={guestTcNo}
                      onChange={(e) => setGuestTcNo(e.target.value)}
                      placeholder="TC No"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Ücret & Not */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Banknote className="h-4 w-4" />
                  Gecelik (₺)
                </div>
                <Input
                  type="number"
                  value={nightlyRate}
                  onChange={(e) => setNightlyRate(e.target.value)}
                  min="0"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <StickyNote className="h-4 w-4" />
                  Not
                </div>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsiyonel"
                  className="h-10"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[160px] hover:brightness-90 active:scale-[0.98] transition-all">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Rezervasyon Oluştur"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
