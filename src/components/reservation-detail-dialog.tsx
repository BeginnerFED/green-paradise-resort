"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  CalendarDays,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  Pencil,
  X,
  Banknote,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calculateBalance } from "@/lib/queries";
import { DatePicker } from "@/components/date-picker";
import { cn } from "@/lib/utils";
import type { Bungalow } from "@/types";

interface Reservation {
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; dot: string }> = {
  confirmed: { label: "Onaylandı", variant: "secondary", dot: "bg-amber-500" },
  checked_in: { label: "Konaklıyor", variant: "default", dot: "bg-emerald-500" },
  checked_out: { label: "Çıkış Yaptı", variant: "outline", dot: "bg-muted-foreground" },
  cancelled: { label: "İptal Edildi", variant: "destructive", dot: "bg-destructive" },
};

const BUNGALOW_DOT_COLORS: Record<string, string> = {
  Ayder: "bg-emerald-500", Kavrun: "bg-teal-500", Badara: "bg-green-500",
  "İlastas": "bg-lime-600", Huser: "bg-blue-500", "Sarı Çiçek": "bg-amber-500",
  "Çiçekli": "bg-pink-500", Gito: "bg-indigo-500", Elevit: "bg-orange-500",
};

interface ReservationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onSuccess: () => void;
}

export function ReservationDetailDialog({
  open,
  onOpenChange,
  reservation,
  onSuccess,
}: ReservationDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTcNo, setEditTcNo] = useState("");
  const [editCheckIn, setEditCheckIn] = useState<Date | undefined>();
  const [editCheckOut, setEditCheckOut] = useState<Date | undefined>();
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.check_out).getTime() -
      new Date(reservation.check_in).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const accommodation = nights * Number(reservation.nightly_rate);
  const extraCharges = (reservation.charges ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const totalPayments = (reservation.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = calculateBalance(reservation);
  const status = statusConfig[reservation.status] ?? statusConfig.confirmed;

  const startEditing = () => {
    setEditName(reservation.guest?.full_name ?? "");
    setEditPhone(reservation.guest?.phone ?? "");
    setEditTcNo(reservation.guest?.tc_no ?? "");
    setEditCheckIn(new Date(reservation.check_in + "T00:00:00"));
    setEditCheckOut(new Date(reservation.check_out + "T00:00:00"));
    setEditRate(reservation.nightly_rate.toString());
    setEditNotes(reservation.notes ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editCheckIn || !editCheckOut || !editName || !editPhone) return;
    setLoading(true);

    try {
      // Misafir güncelle
      await supabase
        .from("guests")
        .update({
          full_name: editName,
          phone: editPhone,
          tc_no: editTcNo || null,
        })
        .eq("id", reservation.guest?.id);

      // Rezervasyon güncelle
      await supabase
        .from("reservations")
        .update({
          check_in: format(editCheckIn, "yyyy-MM-dd"),
          check_out: format(editCheckOut, "yyyy-MM-dd"),
          nightly_rate: Number(editRate),
          notes: editNotes || null,
        })
        .eq("id", reservation.id);

      setEditing(false);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error("Güncelleme hatası:", err);
    }
    setLoading(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    await supabase
      .from("reservations")
      .update({ status: newStatus })
      .eq("id", reservation.id);
    setLoading(false);
    onOpenChange(false);
    onSuccess();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    // Önce charges ve payments silinir (cascade), sonra reservation
    await supabase.from("reservations").delete().eq("id", reservation.id);
    setLoading(false);
    setConfirmDelete(false);
    onOpenChange(false);
    onSuccess();
  };

  const close = (v: boolean) => {
    if (!v) {
      setConfirmDelete(false);
      setEditing(false);
    }
    onOpenChange(v);
  };

  // ---- EDIT MODE ----
  if (editing) {
    const editNights =
      editCheckIn && editCheckOut
        ? Math.max(0, Math.ceil((editCheckOut.getTime() - editCheckIn.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">Rezervasyonu Düzenle</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-5">
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
                    value={editCheckIn}
                    onChange={(date) => {
                      setEditCheckIn(date);
                      if (date && (!editCheckOut || editCheckOut <= date)) {
                        setEditCheckOut(addDays(date, 1));
                      }
                    }}
                    placeholder="Giriş tarihi"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Çıkış</span>
                  <DatePicker
                    value={editCheckOut}
                    onChange={setEditCheckOut}
                    placeholder="Çıkış tarihi"
                    disabled={(date) => !!editCheckIn && date <= editCheckIn}
                  />
                </div>
              </div>
              {editNights > 0 && (
                <p className="text-xs text-muted-foreground">
                  {editNights} gece · {(editNights * Number(editRate || 0)).toLocaleString("tr-TR")}₺ toplam
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
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ad Soyad *"
                className="h-10"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Telefon *"
                    className="h-10 pl-9"
                  />
                </div>
                <Input
                  value={editTcNo}
                  onChange={(e) => setEditTcNo(e.target.value)}
                  placeholder="TC No"
                  className="h-10"
                />
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
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-muted-foreground">Not</span>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Opsiyonel"
                  className="h-10"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="hover:brightness-90 active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---- VIEW MODE ----
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", BUNGALOW_DOT_COLORS[reservation.bungalow?.name ?? ""])} />
              <DialogTitle className="text-lg">{reservation.bungalow?.name}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.variant} className="gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                {status.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Misafir */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-foreground/10 shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{reservation.guest?.full_name}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Phone className="h-3 w-3" />
                {reservation.guest?.phone}
              </div>
              {reservation.guest?.tc_no && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  TC: {reservation.guest.tc_no}
                </p>
              )}
            </div>
          </div>

          {/* Tarih */}
          <div className="flex items-center gap-3 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <span className="font-medium">
                {format(new Date(reservation.check_in + "T00:00:00"), "d MMM", { locale: tr })}
              </span>
              <span className="text-muted-foreground mx-2">→</span>
              <span className="font-medium">
                {format(new Date(reservation.check_out + "T00:00:00"), "d MMM yyyy", { locale: tr })}
              </span>
              <span className="text-muted-foreground ml-2">· {nights} gece</span>
            </div>
          </div>

          <Separator />

          {/* Finansal */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Konaklama ({nights} × {Number(reservation.nightly_rate).toLocaleString("tr-TR")}₺)
              </span>
              <span>{accommodation.toLocaleString("tr-TR")}₺</span>
            </div>
            {extraCharges > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ekstra Harcamalar</span>
                <span>{extraCharges.toLocaleString("tr-TR")}₺</span>
              </div>
            )}
            {totalPayments > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ödemeler</span>
                <span className="text-emerald-600">-{totalPayments.toLocaleString("tr-TR")}₺</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Bakiye</span>
              <span className={balance > 0 ? "text-destructive" : "text-emerald-600"}>
                {balance.toLocaleString("tr-TR")}₺
              </span>
            </div>
          </div>

          {reservation.notes && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground italic">
                &ldquo;{reservation.notes}&rdquo;
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <div className="flex gap-2">
            {/* Sil */}
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive transition-all active:scale-[0.98]"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading && confirmDelete ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmDelete ? (
                "Emin misin?"
              ) : (
                <><Trash2 className="h-4 w-4 mr-1" /> Sil</>
              )}
            </Button>
          </div>
          <div className="flex gap-2">
            {/* Düzenle */}
            {reservation.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={startEditing}
              >
                <Pencil className="h-4 w-4 mr-1" /> Düzenle
              </Button>
            )}
            {/* Durum Değiştir */}
            {reservation.status === "confirmed" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("checked_in")}
                disabled={loading}
                className="hover:brightness-90 active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><LogIn className="h-4 w-4 mr-1.5" /> Giriş Yap</>
                )}
              </Button>
            )}
            {reservation.status === "checked_in" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("checked_out")}
                disabled={loading}
                className="hover:brightness-90 active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><LogOut className="h-4 w-4 mr-1.5" /> Çıkış Yap</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
