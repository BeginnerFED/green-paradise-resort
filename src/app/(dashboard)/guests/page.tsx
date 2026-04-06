"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TODO: Replace with real Supabase data
const mockGuests = [
  { id: "1", name: "Ahmet Yılmaz", phone: "0532 123 4567", visits: 3, lastVisit: "2025-07-10" },
  { id: "2", name: "Mehmet Demir", phone: "0533 234 5678", visits: 1, lastVisit: "2025-07-12" },
  { id: "3", name: "Ayşe Kaya", phone: "0534 345 6789", visits: 5, lastVisit: "2025-07-08" },
  { id: "4", name: "Fatma Şahin", phone: "0535 456 7890", visits: 2, lastVisit: "2025-07-14" },
];

export default function GuestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Müşteriler</h1>
          <p className="text-muted-foreground">
            Müşteri bilgilerini yönetin
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Müşteri
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Müşteri ara..." className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Ziyaret Sayısı</TableHead>
                <TableHead>Son Ziyaret</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockGuests.map((g) => (
                <TableRow key={g.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>{g.phone}</TableCell>
                  <TableCell>{g.visits}</TableCell>
                  <TableCell>{g.lastVisit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
