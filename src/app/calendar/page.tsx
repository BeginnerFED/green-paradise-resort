"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BUNGALOW_NAMES, BUNGALOW_COLORS } from "@/types";
import { cn } from "@/lib/utils";

// TODO: Replace with real Supabase data
const mockReservations = [
  { bungalow: "Ayder", guest: "Ahmet Yılmaz", start: "2025-07-10", end: "2025-07-15" },
  { bungalow: "Kavrun", guest: "Mehmet Demir", start: "2025-07-12", end: "2025-07-18" },
  { bungalow: "Gito", guest: "Ayşe Kaya", start: "2025-07-08", end: "2025-07-14" },
  { bungalow: "Elevit", guest: "Fatma Şahin", start: "2025-07-14", end: "2025-07-20" },
];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month to align with day of week (Monday start)
  const startDay = (getDay(monthStart) + 6) % 7; // Convert Sunday=0 to Monday=0

  const isDateInRange = (
    date: string,
    start: string,
    end: string
  ): boolean => {
    return date >= start && date < end;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Takvim</h1>
        <p className="text-muted-foreground">Aylık bungalov doluluk takvimi</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-xl">
              {format(currentMonth, "MMMM yyyy", { locale: tr })}
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop: Gantt-style view */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground min-w-[100px] sticky left-0 bg-card z-10">
                    Bungalov
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "p-1 text-center font-normal min-w-[36px]",
                        isToday(day) && "bg-primary/10 rounded",
                        !isSameMonth(day, currentMonth) && "text-muted-foreground/40"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, "EEE", { locale: tr }).slice(0, 2)}
                      </div>
                      <div
                        className={cn(
                          "text-sm",
                          isToday(day) && "font-bold text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BUNGALOW_NAMES.map((name) => (
                  <tr key={name} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${BUNGALOW_COLORS[name]}`}
                        />
                        <span className="text-sm">{name}</span>
                      </div>
                    </td>
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const reservation = mockReservations.find(
                        (r) =>
                          r.bungalow === name &&
                          isDateInRange(dateStr, r.start, r.end)
                      );
                      return (
                        <td
                          key={day.toISOString()}
                          className={cn(
                            "p-0.5 text-center",
                            isToday(day) && "bg-primary/5"
                          )}
                        >
                          {reservation ? (
                            <div
                              className={cn(
                                "h-7 rounded-sm flex items-center justify-center cursor-pointer",
                                BUNGALOW_COLORS[name],
                                "text-white text-[10px] font-medium opacity-80 hover:opacity-100 transition-opacity"
                              )}
                              title={`${reservation.guest} (${reservation.start} - ${reservation.end})`}
                            />
                          ) : (
                            <div className="h-7 rounded-sm bg-muted/30 hover:bg-green-100 cursor-pointer transition-colors" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {BUNGALOW_NAMES.map((name) => (
              <div key={name} className="flex items-center gap-1.5 text-xs">
                <div
                  className={`w-3 h-3 rounded-sm ${BUNGALOW_COLORS[name]}`}
                />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
