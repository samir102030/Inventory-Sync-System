import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Users, Truck } from "lucide-react";

type BalanceRow = {
  id: number;
  name: string;
  type: "customer" | "supplier";
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type BalancesData = {
  rows: BalanceRow[];
  summary: { totalReceivable: number; totalPayable: number };
};

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function Balances() {
  const { data, isLoading } = useQuery<BalancesData>({
    queryKey: ["credit-accounts-balances"],
    queryFn: () => fetchJSON("/api/credit-accounts/balances"),
  });

  const receivable = data?.rows.filter(r => r.balance > 0 && r.type === "customer") ?? [];
  const payable = data?.rows.filter(r => r.balance > 0 && r.type === "supplier") ?? [];

  const totalReceivable = data?.summary.totalReceivable ?? 0;
  const totalPayable = data?.summary.totalPayable ?? 0;
  const net = totalReceivable - totalPayable;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">أرصدة الحسابات</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-800">إجمالي ما علينا للغير</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{totalReceivable.toFixed(2)} ج.م</div>
            <p className="text-xs text-green-600 mt-1">فلوس عند العملاء لصالحنا</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800">إجمالي ما علينا للموردين</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{totalPayable.toFixed(2)} ج.م</div>
            <p className="text-xs text-red-600 mt-1">فلوس عليها للموردين</p>
          </CardContent>
        </Card>

        <Card className={net >= 0 ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-medium ${net >= 0 ? "text-blue-800" : "text-orange-800"}`}>صافي المركز المالي</CardTitle>
            {net >= 0
              ? <ArrowDownCircle className="h-4 w-4 text-blue-600" />
              : <ArrowUpCircle className="h-4 w-4 text-orange-600" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${net >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              {net >= 0 ? "+" : ""}{net.toFixed(2)} ج.م
            </div>
            <p className={`text-xs mt-1 ${net >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {net >= 0 ? "لصالح الشركة" : "على الشركة"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Receivable — customers owe us */}
        <Card>
          <CardHeader className="border-b bg-green-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-green-800">عليهم فلوس</span>
                <span className="text-xs text-muted-foreground font-normal">(عملاء لم يسددوا)</span>
              </CardTitle>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {receivable.length} شخص
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {receivable.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">لا يوجد عملاء مديونون</div>
            ) : (
              <div className="divide-y">
                {receivable.map(r => (
                  <div key={`c-${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        إجمالي الآجل: {r.totalDebit.toFixed(2)} — سدّد: {r.totalCredit.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-green-700">{r.balance.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {receivable.length > 0 && (
              <div className="border-t px-4 py-2 bg-green-50 flex justify-between text-sm font-bold text-green-800">
                <span>الإجمالي</span>
                <span>{receivable.reduce((s, r) => s + r.balance, 0).toFixed(2)} ج.م</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payable — we owe suppliers */}
        <Card>
          <CardHeader className="border-b bg-red-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-red-600" />
                <span className="text-red-800">ليهم فلوس</span>
                <span className="text-xs text-muted-foreground font-normal">(موردون لم نسدد لهم)</span>
              </CardTitle>
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {payable.length} مورد
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {payable.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">لا يوجد موردون مستحقون</div>
            ) : (
              <div className="divide-y">
                {payable.map(r => (
                  <div key={`s-${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        إجمالي الآجل: {r.totalDebit.toFixed(2)} — دفعنا: {r.totalCredit.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-red-700">{r.balance.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {payable.length > 0 && (
              <div className="border-t px-4 py-2 bg-red-50 flex justify-between text-sm font-bold text-red-800">
                <span>الإجمالي</span>
                <span>{payable.reduce((s, r) => s + r.balance, 0).toFixed(2)} ج.م</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
