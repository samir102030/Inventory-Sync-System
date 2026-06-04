import { useGetDailyReport, useExportBackup } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

export default function Reports() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: report, isLoading } = useGetDailyReport({ date: today });
  const exportBackup = useExportBackup();

  const handleBackup = () => {
    exportBackup.mutate(undefined, {
      onSuccess: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">التقارير والإحصائيات</h1>
        <Button variant="outline" onClick={handleBackup} disabled={exportBackup.isPending}>
          <Download className="mr-2 h-4 w-4 ml-2" />
          {exportBackup.isPending ? "جاري التحميل..." : "تحميل نسخة احتياطية"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">جاري تحميل التقرير...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ملخص اليوم ({today})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">المبيعات</span>
                <span className="text-lg font-bold">{report?.totalRevenue?.toFixed(2) || 0} د.ك</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
                <span className="font-medium text-destructive">المصروفات</span>
                <span className="text-lg font-bold text-destructive">{report?.totalExpenses?.toFixed(2) || 0} د.ك</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <span className="font-bold text-primary">صافي الربح</span>
                <span className="text-xl font-bold text-primary">{report?.netProfit?.toFixed(2) || 0} د.ك</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>أكثر المنتجات مبيعاً</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report?.topProducts?.map((p, i) => (
                  <div key={p.productId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="font-medium">{p.productName}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground ml-4">{p.quantitySold} قطعة</span>
                      <span className="font-bold">{p.revenue.toFixed(2)} د.ك</span>
                    </div>
                  </div>
                ))}
                {(!report?.topProducts || report.topProducts.length === 0) && (
                  <div className="text-center text-muted-foreground py-4">لا توجد مبيعات اليوم</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
