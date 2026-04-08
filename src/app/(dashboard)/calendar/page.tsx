"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  addDays,
} from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getBungalows, getReservationsByMonth, calculateBalance } from "@/lib/queries";
import { ReservationDialog } from "@/components/reservation-dialog";
import { ReservationDetailDialog } from "@/components/reservation-detail-dialog";
import type { Bungalow } from "@/types";

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

// Her bungalov için normal ve koyu renk çifti
const BUNGALOW_COLOR_PAIR: Record<string, [string, string]> = {
  Ayder: ["bg-emerald-400", "bg-emerald-600"],
  Kavrun: ["bg-teal-400", "bg-teal-600"],
  Badara: ["bg-green-400", "bg-green-600"],
  "İlastas": ["bg-lime-400", "bg-lime-600"],
  Huser: ["bg-blue-400", "bg-blue-600"],
  "Sarı Çiçek": ["bg-amber-400", "bg-amber-600"],
  "Çiçekli": ["bg-pink-400", "bg-pink-600"],
  Gito: ["bg-indigo-400", "bg-indigo-600"],
  Elevit: ["bg-orange-400", "bg-orange-600"],
};

interface ReservationWithRelations {
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

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bungalows, setBungalows] = useState<Bungalow[]>([]);
  const [reservations, setReservations] = useState<ReservationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedBungalow, setSelectedBungalow] = useState<Bungalow | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithRelations | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });
  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        bungalows.length === 0 ? getBungalows() : Promise.resolve(bungalows),
        getReservationsByMonth(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1
        ),
      ]);
      if (bungalows.length === 0) setBungalows(b);
      setReservations(r as ReservationWithRelations[]);
    } catch (err) {
      console.error("Veri yüklenirken hata:", err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isDateInRange = (date: string, start: string, end: string) => {
    return date >= start && date < end;
  };

  const getReservationsForCell = (bungalowId: string, dateStr: string) => {
    return reservations.filter(
      (r) => r.bungalow_id === bungalowId && isDateInRange(dateStr, r.check_in, r.check_out)
    );
  };

  const handleEmptyCellClick = (bungalow: Bungalow, dateStr: string) => {
    setSelectedBungalow(bungalow);
    setSelectedDate(dateStr);
    setNewDialogOpen(true);
  };

  const handleCellClick = (bungalow: Bungalow, dateStr: string) => {
    const cellReservations = getReservationsForCell(bungalow.id, dateStr);
    if (cellReservations.length === 0) {
      handleEmptyCellClick(bungalow, dateStr);
    } else if (cellReservations.length === 1) {
      handleReservationClick(cellReservations[0]);
    } else {
      // Birden fazla — en son başlayanı göster (yeni gelen misafir)
      const sorted = [...cellReservations].sort((a, b) => b.check_in.localeCompare(a.check_in));
      handleReservationClick(sorted[0]);
    }
  };

  const handleReservationClick = (reservation: ReservationWithRelations) => {
    setSelectedReservation(reservation);
    setDetailDialogOpen(true);
  };

  // Her rezervasyona bungalov rengi ata (normal/koyu alternating)
  const reservationColorMap = new Map<string, string>();
  const bungalowColorCounters = new Map<string, number>();

  reservations
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .forEach((r) => {
      if (!reservationColorMap.has(r.id)) {
        const count = bungalowColorCounters.get(r.bungalow_id) ?? 0;
        const bungalowName = r.bungalow?.name ?? "";
        const pair = BUNGALOW_COLOR_PAIR[bungalowName] ?? ["bg-gray-400", "bg-gray-600"];
        // Çift index = normal, tek index = koyu
        reservationColorMap.set(r.id, pair[count % 2]);
        bungalowColorCounters.set(r.bungalow_id, count + 1);
      }
    });

  const getReservationColor = (resId: string) => {
    return reservationColorMap.get(resId) ?? "bg-gray-400";
  };

  const getBungalowStatus = (bungalow: Bungalow) => {
    const active = reservations.find(
      (r) =>
        r.bungalow_id === bungalow.id &&
        isDateInRange(today, r.check_in, r.check_out)
    );
    const upcoming = reservations
      .filter((r) => r.bungalow_id === bungalow.id && r.check_in > today)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];
    return { active, upcoming };
  };

  return (
    <div className="space-y-8">
      {/* Calendar */}
      <Card>
        <CardContent className="px-6 pt-6 pb-2">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: tr })}
              </h2>
              {!isToday(monthStart) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Bugün
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Gantt Table */}
          <div className="overflow-x-auto -mx-6 md:mx-0">
            <table className="text-sm border-collapse w-max md:w-full md:table-fixed">
              <colgroup className="hidden md:table-column-group">
                <col className="w-[100px]" />
                {days.map((day) => (
                  <col key={day.toISOString()} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-medium text-muted-foreground min-w-[90px] md:min-w-0 sticky left-0 bg-card z-10 border-b">
                    Bungalov
                  </th>
                  {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isTodayDate = dateStr === today;
                    return (
                      <th
                        key={dateStr}
                        className={cn(
                          "p-0.5 text-center font-normal border-b min-w-[32px] md:min-w-0",
                          isTodayDate && "bg-foreground/5"
                        )}
                      >
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: tr }).slice(0, 2)}
                        </div>
                        <div
                          className={cn(
                            "text-sm leading-tight",
                            isTodayDate &&
                              "bg-foreground text-background rounded-full w-6 h-6 flex items-center justify-center mx-auto font-semibold"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading && bungalows.length === 0
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="p-2 sticky left-0 bg-card z-10">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        {days.map((day) => (
                          <td key={day.toISOString()} className="p-0.5">
                            <Skeleton className="h-8 rounded-sm" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : bungalows.map((bungalow) => (
                      <tr key={bungalow.id} className="border-b last:border-b-0">
                        <td className="p-1.5 font-medium sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                BUNGALOW_DOT_COLORS[bungalow.name]
                              )}
                            />
                            <span className="text-sm whitespace-nowrap">
                              {bungalow.name}
                            </span>
                          </div>
                        </td>
                        {days.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const isTodayDate = dateStr === today;
                          const cellReservations = getReservationsForCell(
                            bungalow.id,
                            dateStr
                          );
                          const hasReservation = cellReservations.length > 0;
                          const displayRes = hasReservation
                            ? cellReservations.sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
                            : null;

                          // Bant şekli: başlangıç/bitiş/orta
                          const isStart = displayRes?.check_in === dateStr;
                          const nextDateStr = format(addDays(day, 1), "yyyy-MM-dd");
                          const isEnd = displayRes
                            ? displayRes.check_out === nextDateStr
                            : false;

                          return (
                            <td
                              key={dateStr}
                              className={cn(
                                "py-1",
                                isTodayDate && "bg-foreground/5"
                              )}
                            >
                              {hasReservation && displayRes ? (
                                <div
                                  onClick={() => handleCellClick(bungalow, dateStr)}
                                  className={cn(
                                    "h-8 cursor-pointer transition-all hover:brightness-110",
                                    getReservationColor(displayRes.id),
                                    // Köşe yuvarlaklığı
                                    isStart && isEnd && "rounded-md mx-0.5",
                                    isStart && !isEnd && "rounded-l-md ml-0.5",
                                    !isStart && isEnd && "rounded-r-md mr-0.5",
                                    !isStart && !isEnd && "rounded-none",
                                    // Misafir adı sadece başlangıç gününde
                                    "flex items-center overflow-hidden"
                                  )}
                                  title={`${displayRes.guest?.full_name ?? "?"} (${displayRes.check_in} → ${displayRes.check_out})`}
                                >
                                  {isStart && (
                                    <span className="text-[10px] text-white font-medium pl-1.5 truncate">
                                      {(() => {
                                        const name = displayRes.guest?.full_name ?? "";
                                        return name.length > 5 ? name.slice(0, 5) + "…" : name;
                                      })()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div
                                  onClick={() => handleEmptyCellClick(bungalow, dateStr)}
                                  className="h-8 mx-0.5 rounded-md bg-muted/30 hover:bg-foreground cursor-pointer transition-colors"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>

      {/* Bungalow Status Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Bungalov Durumları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bungalows.map((bungalow) => {
            const { active, upcoming } = getBungalowStatus(bungalow);
            const isOccupied = !!active;
            const dotColor = BUNGALOW_DOT_COLORS[bungalow.name];
            const bal = active ? calculateBalance(active) : 0;

            return (
              <div
                key={bungalow.id}
                onClick={() => { if (active) handleReservationClick(active); }}
                className={cn(
                  "group rounded-2xl border bg-card p-4 transition-all duration-200",
                  isOccupied
                    ? "cursor-pointer hover:bg-muted/40 active:scale-[0.99]"
                    : ""
                )}
              >
                {/* Row 1: Name + Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", dotColor)} />
                    <span className="text-[13px] font-semibold">{bungalow.name}</span>
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium px-2.5 py-0.5 rounded-full border",
                    isOccupied
                      ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-950"
                      : "border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                  )}>
                    {isOccupied ? "Dolu" : "Müsait"}
                  </span>
                </div>

                {/* Row 2: Details */}
                {isOccupied && active ? (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-foreground/[0.06] dark:bg-foreground/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-semibold text-foreground/70">
                          {(active.guest?.full_name ?? "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{active.guest?.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(active.check_in + "T00:00:00"), "d MMM", { locale: tr })} – {format(new Date(active.check_out + "T00:00:00"), "d MMM", { locale: tr })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <p className={cn(
                        "text-sm font-semibold tabular-nums",
                        bal > 0 ? "text-destructive" : "text-emerald-600"
                      )}>
                        {bal.toLocaleString("tr-TR")}₺
                      </p>
                      <p className="text-[10px] text-muted-foreground">bakiye</p>
                    </div>
                  </div>
                ) : upcoming ? (
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      <span className="text-foreground font-medium">
                        {format(new Date(upcoming.check_in + "T00:00:00"), "d MMM", { locale: tr })}
                      </span>
                      {" · "}
                      {upcoming.guest?.full_name}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-muted-foreground/60">
                    Rezervasyon yok
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialogs */}
      <ReservationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        bungalow={selectedBungalow}
        defaultCheckIn={selectedDate}
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
