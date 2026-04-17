"use client";

import { useState, useEffect, useCallback } from "react";
import { format, eachMonthOfInterval } from "date-fns";
import { tr } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  Wrench,
  Package,
  Utensils,
  MoreHorizontal,
  Sparkles,
  Receipt,
  CalendarDays,
  Tag,
  PieChartIcon,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/date-picker";
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
  monthIndex: number;
  income: number;
  expense: number;
  profit: number;
  reservationCount: number;
  expenseCount: number;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; hex: string }> = {
  staff: { label: "Personel", icon: <Users className="h-3.5 w-3.5" />, color: "text-blue-500", bg: "bg-blue-500/10", hex: "#3b82f6" },
  utilities: { label: "Faturalar", icon: <Zap className="h-3.5 w-3.5" />, color: "text-amber-500", bg: "bg-amber-500/10", hex: "#f59e0b" },
  maintenance: { label: "Bakım/Onarım", icon: <Wrench className="h-3.5 w-3.5" />, color: "text-orange-500", bg: "bg-orange-500/10", hex: "#f97316" },
  supplies: { label: "Malzeme", icon: <Package className="h-3.5 w-3.5" />, color: "text-violet-500", bg: "bg-violet-500/10", hex: "#8b5cf6" },
  food: { label: "Gıda", icon: <Utensils className="h-3.5 w-3.5" />, color: "text-rose-500", bg: "bg-rose-500/10", hex: "#f43f5e" },
  other: { label: "Diğer", icon: <MoreHorizontal className="h-3.5 w-3.5" />, color: "text-slate-500", bg: "bg-slate-500/10", hex: "#64748b" },
  general: { label: "Genel", icon: <Sparkles className="h-3.5 w-3.5" />, color: "text-emerald-500", bg: "bg-emerald-500/10", hex: "#10b981" },
};

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  yearLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  yearLabel?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-xs">
      {label && (
        <p className="font-semibold mb-1.5 capitalize">
          {label} {yearLabel ?? ""}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium tabular-nums">
              {Number(p.value ?? 0).toLocaleString("tr-TR")}₺
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
        <span className="font-medium">{item.name}</span>
        <span className="font-medium tabular-nums">
          {Number(item.value ?? 0).toLocaleString("tr-TR")}₺
        </span>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 0-11, null = all year
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("general");
  const [expDate, setExpDate] = useState<Date | undefined>(new Date());
  const [expLoading, setExpLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear + 1}-01-01`;

    const { data: reservations } = await supabase
      .from("reservations")
      .select("check_in, check_out, nightly_rate, status, charges(amount), payments(amount)")
      .neq("status", "cancelled")
      .gte("check_in", yearStart)
      .lt("check_in", yearEnd);

    const { data: expData } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", yearStart)
      .lt("date", yearEnd)
      .order("date", { ascending: false });

    setExpenses((expData ?? []) as Expense[]);

    const months = eachMonthOfInterval({
      start: new Date(selectedYear, 0, 1),
      end: new Date(selectedYear, 11, 31),
    });

    const monthly: MonthlyData[] = months.map((m, idx) => {
      const mStr = format(m, "yyyy-MM");
      const label = format(m, "MMM", { locale: tr });

      const monthReservations = (reservations ?? [])
        .filter((r: { check_in: string }) => r.check_in.startsWith(mStr));

      const monthIncome = monthReservations
        .reduce((sum: number, r: { check_in: string; check_out: string; nightly_rate: number; charges: { amount: number }[] | null }) => {
          const nights = Math.ceil(
            (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000
          );
          const accommodation = nights * Number(r.nightly_rate);
          const charges = (r.charges ?? []).reduce((s: number, c: { amount: number }) => s + Number(c.amount), 0);
          return sum + accommodation + charges;
        }, 0);

      const monthExpenses = (expData ?? []).filter((e: { date: string }) => e.date.startsWith(mStr));
      const monthExpense = monthExpenses.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0);

      return {
        month: mStr,
        label,
        monthIndex: idx,
        income: monthIncome,
        expense: monthExpense,
        profit: monthIncome - monthExpense,
        reservationCount: monthReservations.length,
        expenseCount: monthExpenses.length,
      };
    });

    setMonthlyData(monthly);
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtrelenmiş expenses ve stats (ay seçiliyse o ay, değilse yıl)
  const filteredExpenses = selectedMonth !== null
    ? expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      })
    : expenses;

  const selectedMonthData = selectedMonth !== null ? monthlyData[selectedMonth] : null;

  const categoryBreakdown = Object.entries(
    filteredExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
      return acc;
    }, {})
  )
    .map(([key, value]) => ({
      key,
      name: categoryConfig[key]?.label ?? key,
      value,
      hex: categoryConfig[key]?.hex ?? "#6b7280",
    }))
    .sort((a, b) => b.value - a.value);

  const displayIncome = selectedMonthData ? selectedMonthData.income : monthlyData.reduce((s, m) => s + m.income, 0);
  const displayExpense = selectedMonthData ? selectedMonthData.expense : monthlyData.reduce((s, m) => s + m.expense, 0);
  const displayProfit = displayIncome - displayExpense;
  const profitMargin = displayIncome > 0 ? Math.round((displayProfit / displayIncome) * 100) : 0;

  const handleAddExpense = async () => {
    if (!expDesc || !expAmount || !expDate) return;
    setExpLoading(true);
    await supabase.from("expenses").insert({
      description: expDesc,
      amount: Number(expAmount),
      category: expCategory,
      date: format(expDate, "yyyy-MM-dd"),
    });
    toast.success("Masraf eklendi");
    setExpDesc("");
    setExpAmount("");
    setExpCategory("general");
    setExpDate(new Date());
    setExpenseDialogOpen(false);
    setExpLoading(false);
    fetchData();
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Masraf silindi");
    fetchData();
  };

  const isCurrentYear = selectedYear === new Date().getFullYear();
  const scopeLabel = selectedMonthData
    ? format(new Date(selectedYear, selectedMonth!, 1), "MMMM yyyy", { locale: tr })
    : `${selectedYear} yılı`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gelir, gider ve kar takibi</p>
        </div>
        <Button
          onClick={() => setExpenseDialogOpen(true)}
          className="hover:brightness-90 active:scale-[0.98] transition-all shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Masraf Ekle</span>
          <span className="sm:hidden">Masraf</span>
        </Button>
      </div>

      {/* Yıl Seçimi + Scope Göstergesi */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 border rounded-xl p-1 bg-muted/30">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-4 py-1 min-w-[70px] text-center">
            <span className="text-sm font-semibold tabular-nums">{selectedYear}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setSelectedYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentYear && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 ml-1 text-xs"
              onClick={() => setSelectedYear(new Date().getFullYear())}
            >
              Bu yıl
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Görüntülenen: <span className="font-medium text-foreground capitalize">{scopeLabel}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Yükleniyor...</div>
      ) : (
        <>
          {/* Özet Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Gelir */}
            <div className="rounded-2xl border p-5 bg-gradient-to-br from-emerald-500/5 to-transparent">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Gelir
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ArrowUpRight className="h-4.5 w-4.5 text-emerald-500" strokeWidth={2.5} />
                </div>
              </div>
              <p className="text-[28px] leading-tight font-bold text-emerald-600 tabular-nums">
                {displayIncome.toLocaleString("tr-TR")}
                <span className="text-xl font-normal ml-0.5">₺</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {selectedMonthData ? `${selectedMonthData.reservationCount} rezervasyon` : `${monthlyData.reduce((s, m) => s + m.reservationCount, 0)} rezervasyon`}
              </p>
            </div>

            {/* Gider */}
            <div className="rounded-2xl border p-5 bg-gradient-to-br from-rose-500/5 to-transparent">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                  Gider
                </div>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <ArrowDownRight className="h-4.5 w-4.5 text-rose-500" strokeWidth={2.5} />
                </div>
              </div>
              <p className="text-[28px] leading-tight font-bold text-rose-500 tabular-nums">
                {displayExpense.toLocaleString("tr-TR")}
                <span className="text-xl font-normal ml-0.5">₺</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {filteredExpenses.length} masraf kaydı
              </p>
            </div>

            {/* Net Kar */}
            <div className={cn(
              "rounded-2xl border p-5 bg-gradient-to-br to-transparent",
              displayProfit >= 0 ? "from-emerald-500/5" : "from-rose-500/5"
            )}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  <Wallet className="h-3.5 w-3.5" />
                  Net Kar
                </div>
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  displayProfit >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
                )}>
                  <Wallet className={cn(
                    "h-4.5 w-4.5",
                    displayProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                  )} strokeWidth={2.5} />
                </div>
              </div>
              <p className={cn(
                "text-[28px] leading-tight font-bold tabular-nums",
                displayProfit >= 0 ? "text-emerald-600" : "text-rose-500"
              )}>
                {displayProfit.toLocaleString("tr-TR")}
                <span className="text-xl font-normal ml-0.5">₺</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                %{profitMargin} kar marjı
              </p>
            </div>
          </div>

          {/* Aylık Grafik + Ay Seçici */}
          <div className="rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold">Aylık Dağılım</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedMonth !== null ? "Filtreyi kaldırmak için aya tekrar tıklayın" : "Detaylar için aya tıklayın"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-muted-foreground">Gelir</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span className="text-muted-foreground">Gider</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] min-w-0 min-h-0 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  barGap={2}
                  barCategoryGap="22%"
                  margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                  onClick={(e) => {
                    if (e?.activeTooltipIndex !== undefined && e.activeTooltipIndex !== null) {
                      const idx = e.activeTooltipIndex as number;
                      setSelectedMonth((prev) => (prev === idx ? null : idx));
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.15)" />
                  <XAxis
                    dataKey="label"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                    tick={{ fill: "currentColor", opacity: 0.6 }}
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`)}
                    tick={{ fill: "currentColor", opacity: 0.5 }}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(127,127,127,0.08)", radius: 8 }}
                    content={<ChartTooltip yearLabel={selectedYear} />}
                  />
                  <Bar dataKey="income" name="Gelir" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {monthlyData.map((_, idx) => (
                      <Cell
                        key={`inc-${idx}`}
                        fill={selectedMonth !== null && selectedMonth !== idx ? "#10b98133" : "#10b981"}
                        cursor="pointer"
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="expense" name="Gider" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {monthlyData.map((_, idx) => (
                      <Cell
                        key={`exp-${idx}`}
                        fill={selectedMonth !== null && selectedMonth !== idx ? "#f43f5e33" : "#f43f5e"}
                        cursor="pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ay pill'leri */}
            <div className="flex items-center flex-wrap gap-1.5 pt-4 border-t">
              <button
                onClick={() => setSelectedMonth(null)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  selectedMonth === null
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Tüm Yıl
              </button>
              {monthlyData.map((m, idx) => {
                const isActive = selectedMonth === idx;
                const hasData = m.income > 0 || m.expense > 0;
                return (
                  <button
                    key={m.month}
                    onClick={() => setSelectedMonth((prev) => (prev === idx ? null : idx))}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize",
                      isActive
                        ? "bg-foreground text-background"
                        : hasData
                        ? "text-foreground hover:bg-muted border border-border"
                        : "text-muted-foreground/50 hover:bg-muted border border-dashed border-border"
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alt: Gider Dağılımı + Masraf Listesi */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Gider Dağılımı */}
            <div className="rounded-2xl border p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Gider Dağılımı</h3>
                </div>
                {selectedMonthData && (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {selectedMonthData.label}
                  </span>
                )}
              </div>
              {categoryBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <PieChartIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Henüz gider yok</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedMonthData ? "Bu ay için" : "İlk masrafı ekleyin"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-[180px] min-w-0 min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryBreakdown.map((item) => (
                            <Cell key={item.key} fill={item.hex} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam</p>
                      <p className="text-base font-bold tabular-nums">
                        {displayExpense.toLocaleString("tr-TR")}₺
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {categoryBreakdown.map((item) => {
                      const pct = displayExpense > 0 ? Math.round((item.value / displayExpense) * 100) : 0;
                      return (
                        <div key={item.key} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                            <span className="truncate">{item.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">%{pct}</span>
                          </div>
                          <span className="font-medium tabular-nums text-xs">
                            {item.value.toLocaleString("tr-TR")}₺
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Masraf Listesi */}
            <div className="rounded-2xl border overflow-hidden lg:col-span-3">
              <div className="flex items-center justify-between p-5 border-b">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    {selectedMonthData ? "Masraflar" : "Son Masraflar"}
                  </h3>
                  {filteredExpenses.length > 0 && (
                    <span className="text-xs text-muted-foreground">({filteredExpenses.length})</span>
                  )}
                  {selectedMonthData && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide ml-auto mr-2">
                      {selectedMonthData.label}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setExpenseDialogOpen(true)} className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
                </Button>
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">
                    {selectedMonthData ? "Bu ayda masraf yok" : "Henüz masraf yok"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Masraf eklemek için butona tıklayın</p>
                </div>
              ) : (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {filteredExpenses.map((exp) => {
                    const cat = categoryConfig[exp.category] ?? categoryConfig.other;
                    return (
                      <div key={exp.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-muted/40 transition-colors">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cat.bg)}>
                          <div className={cat.color}>{cat.icon}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{exp.description}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {cat.label}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(new Date(exp.date + "T00:00:00"), "d MMM yyyy", { locale: tr })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-rose-500 tabular-nums">
                            -{Number(exp.amount).toLocaleString("tr-TR")}₺
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 p-1.5 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Masraf Ekleme Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Masraf Ekle</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="h-4 w-4" />
                Kategori
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(categoryConfig).map(([key, cfg]) => {
                  const active = expCategory === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setExpCategory(key)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs transition-all",
                        active
                          ? "border-foreground bg-foreground/5 font-medium"
                          : "border-border hover:border-foreground/40"
                      )}
                    >
                      <div className={cfg.color}>{cfg.icon}</div>
                      <span className="truncate">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
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
                <DatePicker
                  value={expDate}
                  onChange={setExpDate}
                  placeholder="Tarih seçin"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>İptal</Button>
            <Button
              onClick={handleAddExpense}
              disabled={expLoading || !expDesc || !expAmount}
              className="hover:brightness-90 active:scale-[0.98] transition-all"
            >
              {expLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masraf Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
