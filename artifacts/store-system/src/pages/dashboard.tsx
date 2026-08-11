import { jsonOrThrow } from "@/lib/http";
import { useGetSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Key, TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Link } from "wouter";

type BalancesData = {
  rows: { customerId: number; name: string; totalInvoiced: number; totalPaid: number; balance: number }[];
  totalOwedByCustomers: number;
  totalOwedToCustomers: number;
};

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(jsonOrThrow);

export default function Dashboard() {
  const { data: summary, isLoading } = useGetSummary();
  const { data: balances } = useQuery<BalancesData>({
    queryKey: ["credit-accounts-balances"],
    queryFn: () => fetchJSON("/api/credit-accounts/balances"),
  });
  const { isAdmin } = useRole();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;
  }

  const monthRevenue = summary?.monthRevenue ?? 0;
  const monthPurchases = (summary as any)?.monthPurchases ?? 0;
  const owedByCustomers = balances?.totalOwedByCustomers ?? 0;
  const owedToCustomers = balances?.totalOwedToCustomers ?? 0;

  // Top 5 customers with highest outstanding balance
  const topOwing = (balances?.rows ?? []).filter(r => r.balance > 0).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">لوحة القيادة</h1>

      {/* KPI cards */}
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

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عليهم فلوس</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{owedByCustomers.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground">عملاء مديونون للشركة</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ليهم فلوس</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{owedToCustomers.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground">عملاء دفعوا زيادة</p>
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
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">إجمالي المبيعات</span>
              <span className="font-bold text-green-600">{monthRevenue.toFixed(2)} ج.م</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">إجمالي المشتريات</span>
              <span className="font-bold text-blue-600">{monthPurchases.toFixed(2)} ج.م</span>
            </div>

            {/* Customer balances summary */}
            <div className="rounded-lg border bg-muted/20 divide-y">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-muted-foreground">عليهم فلوس (عملاء)</span>
                </div>
                <span className="font-semibold text-red-600">{owedByCustomers.toFixed(2)} ج.م</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-muted-foreground">ليهم فلوس (عملاء)</span>
                </div>
                <span className="font-semibold text-green-600">{owedToCustomers.toFixed(2)} ج.م</span>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">هامش الربح</span>
                <span className={`font-bold ${monthRevenue - monthPurchases >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {(monthRevenue - monthPurchases).toFixed(2)} ج.م
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

        {/* Right column */}
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

          {topOwing.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">أعلى أرصدة العملاء</CardTitle>
                  <Link href="/balances" className="text-xs text-primary hover:underline">عرض الكل</Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topOwing.map(r => (
                    <div key={r.customerId} className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-sm">{r.name}</span>
                      </div>
                      <span className="text-sm font-bold text-red-600 tabular-nums">{r.balance.toFixed(2)} ج.م</span>
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
