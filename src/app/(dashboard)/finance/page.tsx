"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { tr } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
}

interface MonthlyData {
  month: string;
  label: string;
  income: number;
  expense: number;
  profit: number;
}

const expenseCategoryLabels: Record<string, string> = {
  staff: "Personel",
  utilities: "Faturalar",
  maintenance: "Bakım/Onarım",
  supplies: "Malzeme",
  food: "Gıda",
  other: "Diğer",
  general: "Genel",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

export default function FinancePage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Expense dialog
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("general");
  const [expDate, setExpDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expLoading, setExpLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear + 1}-01-01`;

    // Rezervasyonlardan gelir
    const { data: reservations } = await supabase
      .from("reservations")
      .select("check_in, check_out, nightly_rate, status, charges(amount), payments(amount)")
      .neq("status", "cancelled")
      .gte("check_in", yearStart)
      .lt("check_in", yearEnd);

    // Masraflar
    const { data: expData } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", yearStart)
      .lt("date", yearEnd)
      .order("date", { ascending: false });

    setExpenses((expData ?? []) as Expense[]);

    // Aylık hesaplama
    const months = eachMonthOfInterval({
      start: new Date(selectedYear, 0, 1),
      end: new Date(selectedYear, 11, 31),
    });

    const monthly: MonthlyData[] = months.map((m) => {
      const mStr = format(m, "yyyy-MM");
      const label = format(m, "MMM", { locale: tr });

      // Gelir: o ayda başlayan rezervasyonların konaklama + harcamaları
      const monthIncome = (reservations ?? [])
        .filter((r: { check_in: string }) => r.check_in.startsWith(mStr))
        .reduce((sum: number, r: { check_in: string; check_out: string; nightly_rate: number; charges: { amount: number }[] | null }) => {
          const nights = Math.ceil(
            (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000
          );
          const accommodation = nights * Number(r.nightly_rate);
          const charges = (r.charges ?? []).reduce((s: number, c: { amount: number }) => s + Number(c.amount), 0);
          return sum + accommodation + charges;
        }, 0);

      // Masraf: o aydaki masraflar
      const monthExpense = (expData ?? [])
        .filter((e: { date: string }) => e.date.startsWith(mStr))
        .reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0);

      return {
        month: mStr,
        label,
        income: monthIncome,
        expense: monthExpense,
        profit: monthIncome - monthExpense,
      };
    });

    setMonthlyData(monthly);
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Masraf kategori dağılımı
  const categoryBreakdown = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
      return acc;
    }, {})
  ).map(([key, value]) => ({
    name: expenseCategoryLabels[key] ?? key,
    value,
  }));

  // Toplamlar
  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0);
  const totalProfit = totalIncome - totalExpense;

  const handleAddExpense = async () => {
    if (!expDesc || !expAmount) return;
    setExpLoading(true);
    await supabase.from("expenses").insert({
      description: expDesc,
      amount: Number(expAmount),
      category: expCategory,
      date: expDate,
    });
    toast.success("Masraf eklendi");
    setExpDesc("");
    setExpAmount("");
    setExpCategory("general");
    setExpenseDialogOpen(false);
    setExpLoading(false);
    fetchData();
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Masraf silindi");
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finans</h1>
          <p className="text-muted-foreground text-sm">Gelir, gider ve kar takibi</p>
        </div>
        <Button onClick={() => setExpenseDialogOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-1.5" />
          Masraf Ekle
        </Button>
      </div>

      {/* Yıl Seçimi */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setSelectedYear((y) => y - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold w-16 text-center">{selectedYear}</span>
        <Button variant="outline" size="icon" onClick={() => setSelectedYear((y) => y + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Yükleniyor...</div>
      ) : (
        <>
          {/* Özet Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Toplam Gelir
              </div>
              <p className="text-2xl font-bold text-emerald-600">{totalIncome.toLocaleString("tr-TR")}₺</p>
            </div>
            <div className="rounded-2xl border p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Toplam Gider
              </div>
              <p className="text-2xl font-bold text-destructive">{totalExpense.toLocaleString("tr-TR")}₺</p>
            </div>
            <div className="rounded-2xl border p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Wallet className="h-4 w-4" />
                Net Kar
              </div>
              <p className={cn("text-2xl font-bold", totalProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
                {totalProfit.toLocaleString("tr-TR")}₺
              </p>
            </div>
          </div>

          {/* Aylık Gelir/Gider Grafiği */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold mb-4">Aylık Gelir / Gider</h3>
              <div className="h-[300px] min-w-0 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => `${Number(value).toLocaleString("tr-TR")}₺`}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Alt kısım: Masraf Dağılımı + Son Masraflar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Masraf Kategori Dağılımı */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold mb-4">Gider Dağılımı</h3>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Henüz masraf yok</p>
                ) : (
                  <div className="flex items-center gap-6">
                    <div className="w-[160px] h-[160px] shrink-0 min-w-0 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {categoryBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1">
                      {categoryBreakdown.map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-medium tabular-nums">{item.value.toLocaleString("tr-TR")}₺</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Son Masraflar Listesi */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Son Masraflar</h3>
                  <Button size="sm" variant="ghost" onClick={() => setExpenseDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
                  </Button>
                </div>
                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Henüz masraf yok</p>
                ) : (
                  <div className="space-y-1 max-h-[250px] overflow-y-auto">
                    {expenses.slice(0, 20).map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between py-2.5 group">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{exp.description}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {expenseCategoryLabels[exp.category] ?? exp.category} · {format(new Date(exp.date + "T00:00:00"), "d MMM yyyy", { locale: tr })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-destructive tabular-nums">
                            -{Number(exp.amount).toLocaleString("tr-TR")}₺
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Masraf Ekleme Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Masraf Ekle</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <Input
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder="Açıklama *"
              className="h-10"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="Tutar (₺) *"
                className="h-10"
                min="0"
              />
              <Select value={expCategory} onValueChange={(v) => v && setExpCategory(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Personel</SelectItem>
                  <SelectItem value="utilities">Faturalar</SelectItem>
                  <SelectItem value="maintenance">Bakım/Onarım</SelectItem>
                  <SelectItem value="supplies">Malzeme</SelectItem>
                  <SelectItem value="food">Gıda</SelectItem>
                  <SelectItem value="other">Diğer</SelectItem>
                  <SelectItem value="general">Genel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>İptal</Button>
            <Button
              onClick={handleAddExpense}
              disabled={expLoading || !expDesc || !expAmount}
              className="hover:brightness-90 active:scale-[0.98] transition-all"
            >
              {expLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
