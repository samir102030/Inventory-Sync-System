import { useGetSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Key, TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Link } from "wouter";

type BalanceSummary = {
  rows: { id: number; name: string; type: "customer" | "supplier"; balance: number }[];
  summary: { totalReceivable: number; totalPayable: number };
};

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function Dashboard() {
  const { data: summary, isLoading } = useGetSummary();
  const { data: balances } = useQuery<BalanceSummary>({
    queryKey: ["credit-accounts-balances"],
    queryFn: () => fetchJSON("/api/credit-accounts/balances"),
  });
  const { isAdmin } = useRole();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;
  }

  const monthRevenue = summary?.monthRevenue ?? 0;
  const totalReceivable = balances?.summary.totalReceivable ?? 0;
  const totalPayable = balances?.summary.totalPayable ?? 0;
  const net = totalReceivable - totalPayable;

  // top 5 people with highest balance
  const topBalances = (balances?.rows ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">لوحة القيادة</h1>

      {/* Top KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات اليوم</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.todayRevenue.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground">من {summary?.todaySales} فاتورة</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عليهم فلوس</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{totalReceivable.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground">عملاء مديونون لصالحنا</p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ليهم فلوس</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalPayable.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground">موردون مستحقون علينا</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نواقص المخزون</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">منتجات تحتاج لإعادة طلب</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Monthly summary */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>ملخص الشهر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">إجمالي المبيعات</span>
              <span className="font-bold text-green-600">{monthRevenue.toFixed(2)} ج.م</span>
            </div>
            {/* Balances summary replacing "إجمالي المشتريات" */}
            <div className="rounded-lg border bg-muted/20 divide-y">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowDownCircle className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-muted-foreground">عليهم فلوس (عملاء)</span>
                </div>
                <span className="font-semibold text-green-700">{totalReceivable.toFixed(2)} ج.م</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-muted-foreground">ليهم فلوس (موردين)</span>
                </div>
                <span className="font-semibold text-red-600">{totalPayable.toFixed(2)} ج.م</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                <span className="text-sm font-medium">الصافي</span>
                <span className={`font-bold ${net >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {net >= 0 ? "+" : ""}{net.toFixed(2)} ج.م
                </span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">هامش الربح الشهري</span>
                <span className={`font-bold ${monthRevenue - totalPayable >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {(monthRevenue - totalPayable).toFixed(2)} ج.م
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">رخص تنتهي خلال 30 يوم</span>
              </div>
              <span className="font-bold text-orange-500">{summary?.expiringLicenses}</span>
            </div>
          </CardContent>
        </Card>

        {/* Right column: recent invoices + top balances */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>أحدث الفواتير</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary?.recentInvoices?.map(invoice => (
                  <div key={invoice.id} className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{invoice.customerName || "عميل نقدي"}</p>
                      <p className="text-sm text-muted-foreground font-mono">{invoice.invoiceNumber}</p>
                    </div>
                    <div className="mr-auto font-bold text-green-600">+{invoice.total.toFixed(2)} ج.م</div>
                  </div>
                ))}
                {!summary?.recentInvoices?.length && (
                  <div className="text-sm text-muted-foreground text-center py-4">لا توجد فواتير حديثة</div>
                )}
              </div>
            </CardContent>
          </Card>

          {topBalances.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">أعلى الأرصدة</CardTitle>
                  <Link href="/balances" className="text-xs text-primary hover:underline">عرض الكل</Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topBalances.map(r => (
                    <div key={`${r.type}-${r.id}`} className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2">
                        {r.type === "customer"
                          ? <Users className="h-3.5 w-3.5 text-green-600" />
                          : <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />}
                        <span className="text-sm">{r.name}</span>
                      </div>
                      <span className={`text-sm font-bold ${r.type === "customer" ? "text-green-700" : "text-red-600"}`}>
                        {r.balance.toFixed(2)} ج.م
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
