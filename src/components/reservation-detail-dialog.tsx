"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  CalendarDays,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  Pencil,
  Plus,
  Banknote,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
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

interface Transaction {
  id: string;
  type: "charge" | "payment";
  amount: number;
  label: string;
  sub: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; dot: string }> = {
  confirmed: { label: "Onaylandı", dot: "bg-amber-500" },
  checked_in: { label: "Konaklıyor", dot: "bg-emerald-500" },
  checked_out: { label: "Çıkış Yaptı", dot: "bg-muted-foreground" },
  cancelled: { label: "İptal Edildi", dot: "bg-destructive" },
};

const BUNGALOW_DOT_COLORS: Record<string, string> = {
  Ayder: "bg-emerald-500", Kavrun: "bg-teal-500", Badara: "bg-green-500",
  "İlastas": "bg-lime-600", Huser: "bg-blue-500", "Sarı Çiçek": "bg-amber-500",
  "Çiçekli": "bg-pink-500", Gito: "bg-indigo-500", Elevit: "bg-orange-500",
};

const categoryLabels: Record<string, string> = {
  restaurant: "Restoran", minibar: "Minibar", extra: "Ekstra", other: "Diğer",
};
const methodLabels: Record<string, string> = {
  cash: "Nakit", card: "Kart", transfer: "Havale",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onSuccess: () => void;
}

export function ReservationDetailDialog({ open, onOpenChange, reservation, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Add form state
  const [addMode, setAddMode] = useState<"charge" | "payment" | null>(null);
  const [addDesc, setAddDesc] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState("restaurant");
  const [addMethod, setAddMethod] = useState("cash");
  const [addLoading, setAddLoading] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTcNo, setEditTcNo] = useState("");
  const [editCheckIn, setEditCheckIn] = useState<Date | undefined>();
  const [editCheckOut, setEditCheckOut] = useState<Date | undefined>();
  const [editRate, setEditRate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchTransactions = async () => {
    if (!reservation) return;
    const [{ data: charges }, { data: payments }] = await Promise.all([
      supabase.from("charges").select("*").eq("reservation_id", reservation.id),
      supabase.from("payments").select("*").eq("reservation_id", reservation.id),
    ]);
    const txs: Transaction[] = [
      ...(charges ?? []).map((c: { id: string; description: string; amount: number; category: string; created_at: string }) => ({
        id: c.id,
        type: "charge" as const,
        amount: Number(c.amount),
        label: c.description,
        sub: categoryLabels[c.category] ?? c.category,
        created_at: c.created_at,
      })),
      ...(payments ?? []).map((p: { id: string; amount: number; method: string; notes: string | null; created_at: string }) => ({
        id: p.id,
        type: "payment" as const,
        amount: Number(p.amount),
        label: methodLabels[p.method] ?? p.method,
        sub: p.notes ?? "",
        created_at: p.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setTransactions(txs);
  };

  useEffect(() => {
    if (open && reservation) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id]);

  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.check_out).getTime() - new Date(reservation.check_in).getTime()) / 86400000
  );
  const accommodation = nights * Number(reservation.nightly_rate);
  const totalCharges = transactions.filter((t) => t.type === "charge").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter((t) => t.type === "payment").reduce((s, t) => s + t.amount, 0);
  const balance = accommodation + totalCharges - totalPayments;
  const status = statusConfig[reservation.status] ?? statusConfig.confirmed;

  const initials = (reservation.guest?.full_name ?? "?")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const close = (v: boolean) => {
    if (!v) { setConfirmDelete(false); setEditing(false); setAddMode(null); }
    onOpenChange(v);
  };

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
    await supabase.from("guests").update({ full_name: editName, phone: editPhone, tc_no: editTcNo || null }).eq("id", reservation.guest?.id);
    await supabase.from("reservations").update({ check_in: format(editCheckIn, "yyyy-MM-dd"), check_out: format(editCheckOut, "yyyy-MM-dd"), nightly_rate: Number(editRate), notes: editNotes || null }).eq("id", reservation.id);
    toast.success("Rezervasyon güncellendi");
    setEditing(false); setLoading(false); close(false); onSuccess();
  };

  const handleStatusChange = async (s: string) => {
    setLoading(true);
    await supabase.from("reservations").update({ status: s }).eq("id", reservation.id);
    const label = s === "checked_in" ? "Giriş yapıldı" : s === "checked_out" ? "Çıkış yapıldı" : "Durum güncellendi";
    toast.success(label);
    setLoading(false); close(false); onSuccess();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    await supabase.from("reservations").delete().eq("id", reservation.id);
    toast.success("Rezervasyon silindi");
    setLoading(false); setConfirmDelete(false); close(false); onSuccess();
  };

  const handleAddTransaction = async () => {
    if (!addAmount) return;
    setAddLoading(true);
    if (addMode === "charge") {
      await supabase.from("charges").insert({ reservation_id: reservation.id, description: addDesc || "Harcama", amount: Number(addAmount), category: addCategory });
    } else {
      await supabase.from("payments").insert({ reservation_id: reservation.id, amount: Number(addAmount), method: addMethod, notes: addDesc || null });
    }
    toast.success(addMode === "charge" ? "Harcama eklendi" : "Ödeme kaydedildi");
    setAddAmount(""); setAddDesc(""); setAddMode(null); setAddLoading(false);
    await fetchTransactions(); onSuccess();
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    const table = tx.type === "charge" ? "charges" : "payments";
    await supabase.from(table).delete().eq("id", tx.id);
    toast.success("Silindi");
    await fetchTransactions(); onSuccess();
  };

  // ---- EDIT MODE ----
  if (editing) {
    const editNights = editCheckIn && editCheckOut
      ? Math.max(0, Math.ceil((editCheckOut.getTime() - editCheckIn.getTime()) / 86400000)) : 0;

    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-[460px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">Düzenle</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Giriş</span>
                <DatePicker value={editCheckIn} onChange={(d) => { setEditCheckIn(d); if (d && (!editCheckOut || editCheckOut <= d)) setEditCheckOut(addDays(d, 1)); }} placeholder="Giriş" />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Çıkış</span>
                <DatePicker value={editCheckOut} onChange={setEditCheckOut} placeholder="Çıkış" disabled={(d) => !!editCheckIn && d <= editCheckIn} />
              </div>
            </div>
            {editNights > 0 && <p className="text-xs text-muted-foreground">{editNights} gece · {(editNights * Number(editRate || 0)).toLocaleString("tr-TR")}₺</p>}
            <Separator />
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ad Soyad *" className="h-10" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Telefon *" className="h-10" />
              <Input value={editTcNo} onChange={(e) => setEditTcNo(e.target.value)} placeholder="TC No" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)} placeholder="Gecelik ₺" className="h-10" />
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Not" className="h-10" />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setEditing(false)}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={loading} className="hover:brightness-90 active:scale-[0.98] transition-all">
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
      <DialogContent className="sm:max-w-[460px] p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", BUNGALOW_DOT_COLORS[reservation.bungalow?.name ?? ""])} />
              <DialogTitle className="text-lg">{reservation.bungalow?.name}</DialogTitle>
              <span className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border",
                reservation.status === "confirmed" && "border-amber-500 text-amber-500 bg-amber-50 dark:bg-amber-950",
                reservation.status === "checked_in" && "border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-950",
                reservation.status === "checked_out" && "border-muted-foreground text-muted-foreground bg-muted",
                reservation.status === "cancelled" && "border-destructive text-destructive bg-red-50 dark:bg-red-950"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                {status.label}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-4">
          {/* Misafir + Tarih kompakt */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-foreground/[0.06] dark:bg-foreground/10 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-foreground/60">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{reservation.guest?.full_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{reservation.guest?.phone}</span>
                <span>·</span>
                <CalendarDays className="h-3 w-3" />
                <span>
                  {format(new Date(reservation.check_in + "T00:00:00"), "d MMM", { locale: tr })} – {format(new Date(reservation.check_out + "T00:00:00"), "d MMM", { locale: tr })} · {nights}g
                </span>
              </div>
            </div>
          </div>

          {/* Finansal Özet */}
          <div className="rounded-xl border p-4 mb-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Konaklama ({nights}g × {Number(reservation.nightly_rate).toLocaleString("tr-TR")}₺)</span>
                <span>{accommodation.toLocaleString("tr-TR")}₺</span>
              </div>
              {totalCharges > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Harcamalar</span>
                  <span>{totalCharges.toLocaleString("tr-TR")}₺</span>
                </div>
              )}
              {totalPayments > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ödemeler</span>
                  <span className="text-emerald-600">-{totalPayments.toLocaleString("tr-TR")}₺</span>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-3 mt-3 border-t font-semibold">
              <span>Bakiye</span>
              <span className={cn("text-lg", balance > 0 ? "text-destructive" : "text-emerald-600")}>
                {balance.toLocaleString("tr-TR")}₺
              </span>
            </div>
          </div>

          {/* Harcama/Ödeme Ekle */}
          {addMode ? (
            <div className="rounded-xl border p-4 mb-4 space-y-3">
              <p className="text-sm font-medium">{addMode === "charge" ? "Harcama Ekle" : "Ödeme Ekle"}</p>
              <div className="grid grid-cols-2 gap-2">
                {addMode === "charge" ? (
                  <>
                    <Input value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="Açıklama" className="h-9" />
                    <Select value={addCategory} onValueChange={(v) => v && setAddCategory(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restaurant">Restoran</SelectItem>
                        <SelectItem value="minibar">Minibar</SelectItem>
                        <SelectItem value="extra">Ekstra</SelectItem>
                        <SelectItem value="other">Diğer</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Input value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="Not (opsiyonel)" className="h-9" />
                    <Select value={addMethod} onValueChange={(v) => v && setAddMethod(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Nakit</SelectItem>
                        <SelectItem value="card">Kart</SelectItem>
                        <SelectItem value="transfer">Havale</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Input type="number" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} placeholder="Tutar (₺)" className="h-9 flex-1" min="0" />
                <Button size="sm" variant="ghost" onClick={() => setAddMode(null)}>İptal</Button>
                <Button size="sm" onClick={handleAddTransaction} disabled={addLoading || !addAmount} className="hover:brightness-90 active:scale-[0.98] transition-all">
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ekle"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAddMode("charge")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Harcama
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAddMode("payment")}>
                <Banknote className="h-3.5 w-3.5 mr-1" /> Ödeme
              </Button>
            </div>
          )}

          {/* İşlem Geçmişi */}
          {transactions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">İşlem Geçmişi</p>
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 group">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{tx.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {tx.sub}{tx.sub ? " · " : ""}{format(new Date(tx.created_at), "d MMM HH:mm", { locale: tr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-sm font-medium", tx.type === "charge" ? "text-foreground" : "text-emerald-600")}>
                        {tx.type === "charge" ? "+" : "-"}{tx.amount.toLocaleString("tr-TR")}₺
                      </span>
                      <button
                        onClick={() => handleDeleteTransaction(tx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reservation.notes && (
            <p className="text-xs text-muted-foreground italic mt-3 pt-3 border-t">
              &ldquo;{reservation.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Footer */}
        {reservation.status !== "cancelled" && reservation.status !== "checked_out" && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive transition-all active:scale-[0.98]"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading && confirmDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmDelete ? "Emin misin?" : <><Trash2 className="h-4 w-4 mr-1" /> Sil</>}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> Düzenle
              </Button>
              {reservation.status === "confirmed" && (
                <Button size="sm" onClick={() => handleStatusChange("checked_in")} disabled={loading} className="hover:brightness-90 active:scale-[0.98] transition-all">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4 mr-1.5" /> Giriş Yap</>}
                </Button>
              )}
              {reservation.status === "checked_in" && (
                <Button size="sm" onClick={() => handleStatusChange("checked_out")} disabled={loading} className="hover:brightness-90 active:scale-[0.98] transition-all">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="h-4 w-4 mr-1.5" /> Çıkış Yap</>}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
