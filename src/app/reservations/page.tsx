"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TODO: Replace with real Supabase data
const mockReservations = [
  {
    id: "1",
    guest: "Ahmet Yılmaz",
    bungalow: "Ayder",
    checkIn: "2025-07-10",
    checkOut: "2025-07-15",
    status: "checked_in" as const,
    balance: 2500,
  },
  {
    id: "2",
    guest: "Mehmet Demir",
    bungalow: "Kavrun",
    checkIn: "2025-07-12",
    checkOut: "2025-07-18",
    status: "confirmed" as const,
    balance: 3600,
  },
  {
    id: "3",
    guest: "Ayşe Kaya",
    bungalow: "Gito",
    checkIn: "2025-07-08",
    checkOut: "2025-07-14",
    status: "checked_in" as const,
    balance: 1200,
  },
  {
    id: "4",
    guest: "Fatma Şahin",
    bungalow: "Elevit",
    checkIn: "2025-07-14",
    checkOut: "2025-07-20",
    status: "confirmed" as const,
    balance: 0,
  },
];

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  confirmed: { label: "Onaylandı", variant: "secondary" },
  checked_in: { label: "Giriş Yapıldı", variant: "default" },
  checked_out: { label: "Çıkış Yapıldı", variant: "outline" },
  cancelled: { label: "İptal", variant: "destructive" },
};

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rezervasyonlar</h1>
          <p className="text-muted-foreground">
            Tüm rezervasyonları yönetin
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Rezervasyon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Misafir</TableHead>
                <TableHead>Bungalov</TableHead>
                <TableHead>Giriş</TableHead>
                <TableHead>Çıkış</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Bakiye</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockReservations.map((r) => {
                const status = statusLabels[r.status];
                return (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{r.guest}</TableCell>
                    <TableCell>{r.bungalow}</TableCell>
                    <TableCell>{r.checkIn}</TableCell>
                    <TableCell>{r.checkOut}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={r.balance > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                        {r.balance.toLocaleString("tr-TR")}₺
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
