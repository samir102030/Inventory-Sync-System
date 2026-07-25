import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Users } from "lucide-react";

type BalanceRow = {
  customerId: number;
  name: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number; // positive = owes us, negative = we owe them
};

type BalancesData = {
  rows: BalanceRow[];
  totalOwedByCustomers: number;
  totalOwedToCustomers: number;
};

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function Balances() {
  const { data, isLoading } = useQuery<BalancesData>({
    queryKey: ["credit-accounts-balances"],
    queryFn: () => fetchJSON("/api/credit-accounts/balances"),
  });

  // عليه فلوس = owes us (positive balance)
  const owUs = data?.rows.filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance) ?? [];
  // ليه فلوس = we owe them (negative balance / overpaid)
  const weOweThem = data?.rows.filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance) ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">أرصدة العملاء</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800">عليهم فلوس</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{(data?.totalOwedByCustomers ?? 0).toFixed(2)} ج.م</div>
            <p className="text-xs text-red-600 mt-1">{owUs.length} عميل لم يسدد بعد</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-800">ليهم فلوس</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{(data?.totalOwedToCustomers ?? 0).toFixed(2)} ج.م</div>
            <p className="text-xs text-green-600 mt-1">{weOweThem.length} عميل دفع زيادة</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* عليهم فلوس */}
        <Card>
          <CardHeader className="border-b bg-red-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-red-600" />
                <span className="text-red-800">عليهم فلوس</span>
              </CardTitle>
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{owUs.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {owUs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">لا يوجد عملاء مديونون</div>
            ) : (
              <div className="divide-y">
                {owUs.map(r => (
                  <div key={r.customerId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        الفواتير: {r.totalInvoiced.toFixed(2)} — سدّد: {r.totalPaid.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-bold text-red-700 tabular-nums">{r.balance.toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            )}
            {owUs.length > 0 && (
              <div className="border-t px-4 py-2 bg-red-50 flex justify-between text-sm font-bold text-red-800">
                <span>الإجمالي</span>
                <span>{owUs.reduce((s, r) => s + r.balance, 0).toFixed(2)} ج.م</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ليهم فلوس */}
        <Card>
          <CardHeader className="border-b bg-green-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-green-800">ليهم فلوس</span>
              </CardTitle>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{weOweThem.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {weOweThem.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">لا يوجد عملاء دفعوا زيادة</div>
            ) : (
              <div className="divide-y">
                {weOweThem.map(r => (
                  <div key={r.customerId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        الفواتير: {r.totalInvoiced.toFixed(2)} — سدّد: {r.totalPaid.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-bold text-green-700 tabular-nums">{Math.abs(r.balance).toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>
            )}
            {weOweThem.length > 0 && (
              <div className="border-t px-4 py-2 bg-green-50 flex justify-between text-sm font-bold text-green-800">
                <span>الإجمالي</span>
                <span>{weOweThem.reduce((s, r) => s + Math.abs(r.balance), 0).toFixed(2)} ج.م</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
