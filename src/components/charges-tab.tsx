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
import { Plus, Trash2, Loader2, UtensilsCrossed, Wine, Sparkles, MoreHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Charge {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  restaurant: { label: "Restoran", icon: <UtensilsCrossed className="h-3.5 w-3.5" />, color: "text-orange-500" },
  minibar: { label: "Minibar", icon: <Wine className="h-3.5 w-3.5" />, color: "text-purple-500" },
  extra: { label: "Ekstra", icon: <Sparkles className="h-3.5 w-3.5" />, color: "text-blue-500" },
  other: { label: "Diğer", icon: <MoreHorizontal className="h-3.5 w-3.5" />, color: "text-muted-foreground" },
};

interface ChargesTabProps {
  reservationId: string;
  onUpdate: () => void;
}

export function ChargesTab({ reservationId, onUpdate }: ChargesTabProps) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [showForm, setShowForm] = useState(false);

  const fetchCharges = async () => {
    const { data } = await supabase
      .from("charges")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false });
    setCharges(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const handleAdd = async () => {
    if (!description || !amount) return;
    setAdding(true);
    await supabase.from("charges").insert({
      reservation_id: reservationId,
      description,
      amount: Number(amount),
      category,
    });
    setDescription("");
    setAmount("");
    setCategory("restaurant");
    setShowForm(false);
    await fetchCharges();
    setAdding(false);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("charges").delete().eq("id", id);
    await fetchCharges();
    setDeleting(null);
    onUpdate();
  };

  const total = charges.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Toplam Harcama</p>
          <p className="text-lg font-semibold">{total.toLocaleString("tr-TR")}₺</p>
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama *"
              className="h-9"
            />
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Tutar (₺) *"
              className="h-9"
              min="0"
            />
          </div>
          <Select value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="restaurant">Restoran</SelectItem>
              <SelectItem value="minibar">Minibar</SelectItem>
              <SelectItem value="extra">Ekstra</SelectItem>
              <SelectItem value="other">Diğer</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              İptal
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={adding || !description || !amount}
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
      ) : charges.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Henüz harcama yok</p>
      ) : (
        <div className="space-y-2">
          {charges.map((charge) => {
            const cat = categoryConfig[charge.category] ?? categoryConfig.other;
            return (
              <div
                key={charge.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("shrink-0", cat.color)}>{cat.icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{charge.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cat.label} · {format(new Date(charge.created_at), "d MMM HH:mm", { locale: tr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">
                    {Number(charge.amount).toLocaleString("tr-TR")}₺
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(charge.id)}
                    disabled={deleting === charge.id}
                  >
                    {deleting === charge.id ? (
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
