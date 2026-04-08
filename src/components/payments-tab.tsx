"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2, Banknote, CreditCard, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  amount: number;
  method: string;
  notes: string | null;
  created_at: string;
}

const methodConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cash: { label: "Nakit", icon: <Banknote className="h-3.5 w-3.5" />, color: "text-emerald-500" },
  card: { label: "Kart", icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-blue-500" },
  transfer: { label: "Havale", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, color: "text-violet-500" },
};

interface PaymentsTabProps {
  reservationId: string;
  onUpdate: () => void;
}

export function PaymentsTab({ reservationId, onUpdate }: PaymentsTabProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchPayments = async () => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false });
    setPayments(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const handleAdd = async () => {
    if (!amount) return;
    setAdding(true);
    await supabase.from("payments").insert({
      reservation_id: reservationId,
      amount: Number(amount),
      method,
      notes: notes || null,
    });
    setAmount("");
    setMethod("cash");
    setNotes("");
    setShowForm(false);
    await fetchPayments();
    setAdding(false);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("payments").delete().eq("id", id);
    await fetchPayments();
    setDeleting(null);
    onUpdate();
  };

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Toplam Ödeme</p>
          <p className="text-lg font-semibold text-emerald-600">
            {total.toLocaleString("tr-TR")}₺
          </p>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ekle
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Tutar (₺) *"
              className="h-9"
              min="0"
            />
            <Select value={method} onValueChange={(v) => v && setMethod(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Nakit</SelectItem>
                <SelectItem value="card">Kart</SelectItem>
                <SelectItem value="transfer">Havale/EFT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Not (opsiyonel)"
            className="h-9"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              İptal
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={adding || !amount}
              className="hover:brightness-90 active:scale-[0.98] transition-all"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Yükleniyor...</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Henüz ödeme yok</p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => {
            const m = methodConfig[payment.method] ?? methodConfig.cash;
            return (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("shrink-0", m.color)}>{m.icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(payment.created_at), "d MMM HH:mm", { locale: tr })}
                      {payment.notes && ` · ${payment.notes}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-emerald-600">
                    +{Number(payment.amount).toLocaleString("tr-TR")}₺
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(payment.id)}
                    disabled={deleting === payment.id}
                  >
                    {deleting === payment.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
