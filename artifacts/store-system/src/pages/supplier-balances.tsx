import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

type SupplierBalanceRow = {
  supplierId: number;
  supplierName: string;
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  balance: number; // positive = we owe them, negative = they owe us
};

type SupplierBalancesData = {
  rows: SupplierBalanceRow[];
  totalOwedToSuppliers: number;
  totalOwedBySuppliers: number;
};

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function SupplierBalances() {
  const { data, isLoading } = useQuery<SupplierBalancesData>({
    queryKey: ["supplier-balances"],
    queryFn: () => fetchJSON("/api/credit-accounts/supplier-balances"),
  });

  const weOweThem = data?.rows.filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance) ?? [];
  const theyOweUs = data?.rows.filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance) ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">أرصدة الموردين</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">ليهم فلوس عندنا</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{(data?.totalOwedToSuppliers ?? 0).toFixed(2)} ج.م</div>
            <p className="text-xs text-orange-600 mt-1">{weOweThem.length} مورد لم يُسدَّد بعد</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-800">عليهم فلوس</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{(data?.totalOwedBySuppliers ?? 0).toFixed(2)} ج.م</div>
            <p className="text-xs text-green-600 mt-1">{theyOweUs.length} مورد دفع زيادة</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ليهم فلوس عندنا */}
        <Card>
          <CardHeader className="border-b bg-orange-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-600" />
                <span className="text-orange-800">ليهم فلوس عندنا</span>
              </CardTitle>
              <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{weOweThem.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {weOweThem.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">لا يوجد موردون مستحقون</div>
            ) : (
              <div className="divide-y">
                {weOweThem.map(r => (
                  <div key={r.supplierId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{r.supplierName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.openingBalance > 0 && <span>افتتاحي: {r.openingBalance.toFixed(2)} · </span>}
                        مشتريات آجلة: {r.totalPurchases.toFixed(2)} · سُدِّد: {r.totalPaid.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-bold text-orange-700 tabular-nums">{r.balance.toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            )}
            {weOweThem.length > 0 && (
              <div className="border-t px-4 py-2 bg-orange-50 flex justify-between text-sm font-bold text-orange-800">
                <span>الإجمالي</span>
                <span>{weOweThem.reduce((s, r) => s + r.balance, 0).toFixed(2)} ج.م</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* عليهم فلوس */}
        <Card>
          <CardHeader className="border-b bg-green-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-600" />
                <span className="text-green-800">عليهم فلوس</span>
              </CardTitle>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{theyOweUs.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {theyOweUs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">لا يوجد موردون دفعوا زيادة</div>
            ) : (
              <div className="divide-y">
                {theyOweUs.map(r => (
                  <div key={r.supplierId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{r.supplierName}</p>
                      <p className="text-xs text-muted-foreground">
                        مشتريات آجلة: {r.totalPurchases.toFixed(2)} · سُدِّد: {r.totalPaid.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-bold text-green-700 tabular-nums">{Math.abs(r.balance).toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            )}
            {theyOweUs.length > 0 && (
              <div className="border-t px-4 py-2 bg-green-50 flex justify-between text-sm font-bold text-green-800">
                <span>الإجمالي</span>
                <span>{theyOweUs.reduce((s, r) => s + Math.abs(r.balance), 0).toFixed(2)} ج.م</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
