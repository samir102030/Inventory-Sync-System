import { useGetSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, Users, AlertTriangle, Key, TrendingDown, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetSummary();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;
  }

  const monthPurchases = (summary as any)?.monthPurchases ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">لوحة القيادة</h1>

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشتريات الشهر</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{monthPurchases.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground">إجمالي فواتير الشراء</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">{summary?.totalProducts} منتج مسجل</p>
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
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>ملخص الشهر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">إجمالي المبيعات</span>
              <span className="font-bold text-green-600">{summary?.monthRevenue.toFixed(2)} ج.م</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">إجمالي المشتريات</span>
              <span className="font-bold text-blue-600">{monthPurchases.toFixed(2)} ج.م</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">هامش الربح</span>
              <span className={`font-bold ${(summary?.monthRevenue ?? 0) - monthPurchases >= 0 ? "text-green-600" : "text-destructive"}`}>
                {((summary?.monthRevenue ?? 0) - monthPurchases).toFixed(2)} ج.م
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">رخص تنتهي خلال 30 يوم</span>
              </div>
              <span className="font-bold text-orange-500">{summary?.expiringLicenses}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
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
      </div>
    </div>
  );
}
