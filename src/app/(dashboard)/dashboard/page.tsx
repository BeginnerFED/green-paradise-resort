"use client";

import {
  BedDouble,
  CalendarCheck,
  CalendarX,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUNGALOW_NAMES, BUNGALOW_COLORS } from "@/types";

// TODO: Replace with real Supabase data
const mockStats = {
  occupiedCount: 5,
  totalBungalows: 9,
  todayCheckIns: 2,
  todayCheckOuts: 1,
  totalUnpaid: 12450,
  totalGuests: 34,
};

const mockBungalowStatus = BUNGALOW_NAMES.map((name, i) => ({
  name,
  status: i < 5 ? ("occupied" as const) : ("available" as const),
  guest: i < 5 ? `Misafir ${i + 1}` : null,
  checkOut: i < 5 ? `2025-07-${15 + i}` : null,
  balance: i < 5 ? (i + 1) * 500 : 0,
}));

export default function DashboardPage() {
  const stats = mockStats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Green Paradise Resort - Genel Bakış
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <BedDouble className="h-8 w-8 text-primary mb-2" />
              <p className="text-2xl font-bold">
                {stats.occupiedCount}/{stats.totalBungalows}
              </p>
              <p className="text-xs text-muted-foreground">Dolu / Toplam</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <CalendarCheck className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold">{stats.todayCheckIns}</p>
              <p className="text-xs text-muted-foreground">Bugün Giriş</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <CalendarX className="h-8 w-8 text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{stats.todayCheckOuts}</p>
              <p className="text-xs text-muted-foreground">Bugün Çıkış</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <TrendingUp className="h-8 w-8 text-red-500 mb-2" />
              <p className="text-2xl font-bold">
                {stats.totalUnpaid.toLocaleString("tr-TR")}₺
              </p>
              <p className="text-xs text-muted-foreground">Toplam Borç</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Users className="h-8 w-8 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{stats.totalGuests}</p>
              <p className="text-xs text-muted-foreground">Toplam Misafir</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <UtensilsCrossed className="h-8 w-8 text-amber-600 mb-2" />
              <p className="text-2xl font-bold">
                %{Math.round((stats.occupiedCount / stats.totalBungalows) * 100)}
              </p>
              <p className="text-xs text-muted-foreground">Doluluk Oranı</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bungalow Status Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Bungalov Durumları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockBungalowStatus.map((b) => (
            <Card
              key={b.name}
              className={
                b.status === "occupied"
                  ? "border-l-4 border-l-red-400"
                  : "border-l-4 border-l-green-400"
              }
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${BUNGALOW_COLORS[b.name]}`}
                    />
                    <h3 className="font-semibold">{b.name}</h3>
                  </div>
                  <Badge
                    variant={
                      b.status === "occupied" ? "destructive" : "secondary"
                    }
                    className={
                      b.status === "available"
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : ""
                    }
                  >
                    {b.status === "occupied" ? "Dolu" : "Boş"}
                  </Badge>
                </div>
                {b.status === "occupied" && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Misafir: <span className="font-medium text-foreground">{b.guest}</span>
                    </p>
                    <p>
                      Çıkış:{" "}
                      <span className="font-medium text-foreground">{b.checkOut}</span>
                    </p>
                    <p>
                      Bakiye:{" "}
                      <span className="font-medium text-red-600">
                        {b.balance.toLocaleString("tr-TR")}₺
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
