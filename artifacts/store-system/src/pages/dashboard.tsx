import { useGetSummary, getGetSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, Users, AlertTriangle, Key } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetSummary();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">لوحة القيادة</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات اليوم</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.todayRevenue.toFixed(2)} د.ك</div>
            <p className="text-xs text-muted-foreground">
              من {summary?.todaySales} عملية بيع
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المنتجات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              منتج مسجل في النظام
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نواقص المخزون</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">
              منتجات تحتاج لإعادة طلب
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">رخص تنتهي قريباً</CardTitle>
            <Key className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{summary?.expiringLicenses}</div>
            <p className="text-xs text-muted-foreground">
              رخصة تنتهي خلال 30 يوماً
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>نظرة عامة على الإيرادات</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] w-full bg-muted/20 rounded flex items-center justify-center text-muted-foreground">
              مخطط الإيرادات
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>أحدث الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {summary?.recentInvoices?.map((invoice) => (
                <div key={invoice.id} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{invoice.customerName || 'عميل نقدي'}</p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.invoiceNumber}
                    </p>
                  </div>
                  <div className="mr-auto font-medium">+{invoice.total.toFixed(2)} د.ك</div>
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
