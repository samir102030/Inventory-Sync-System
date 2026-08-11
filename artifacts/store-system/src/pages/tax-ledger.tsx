import { jsonOrThrow } from "@/lib/http";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, TrendingUp, FileText, DollarSign, CalendarRange } from "lucide-react";

type TaxInvoice = {
  id: number;
  invoiceNumber: string;
  customerName: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  taxRate: number;
};

type TaxLedgerResponse = {
  invoices: TaxInvoice[];
  totalTax: number;
  totalSubtotal: number;
  totalAmount: number;
  count: number;
};

const PAY_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  transfer: "تحويل",
  credit: "آجل",
};

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export default function TaxLedger() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: firstOfMonth, to: today });

  const { data, isLoading } = useQuery<TaxLedgerResponse>({
    queryKey: ["tax-ledger", applied.from, applied.to],
    queryFn: () =>
      fetch(`/api/invoices/tax-ledger?from=${applied.from}&to=${applied.to}`, { credentials: "include" }).then(jsonOrThrow),
  });

  const handleApply = () => setApplied({ from, to });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-amber-600" />
            سجل الضريبة
          </h1>
          <p className="text-muted-foreground text-sm mt-1">جميع الفواتير التي تحمل ضريبة — مخزون ضريبي تراكمي</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">الفترة:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">من</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40 bg-background" dir="ltr" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">إلى</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40 bg-background" dir="ltr" />
            </div>
            <Button onClick={handleApply} size="sm">تطبيق</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const y = new Date().getFullYear();
              const m = new Date().getMonth();
              const f = new Date(y, m, 1).toISOString().slice(0, 10);
              const t = new Date().toISOString().slice(0, 10);
              setFrom(f); setTo(t); setApplied({ from: f, to: t });
            }}>الشهر الحالي</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const y = new Date().getFullYear();
              const f = `${y}-01-01`;
              const t = new Date().toISOString().slice(0, 10);
              setFrom(f); setTo(t); setApplied({ from: f, to: t });
            }}>السنة الحالية</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-4 w-4" />
              فواتير خاضعة للضريبة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{isLoading ? "..." : data?.count ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">فاتورة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              الوعاء الضريبي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? "..." : fmt(data?.totalSubtotal ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">ج.م</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              إجمالي الضريبة المحصلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{isLoading ? "..." : fmt(data?.totalTax ?? 0)}</p>
            <p className="text-xs text-amber-600 mt-1">ج.م — مستحقة للضرائب</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              إجمالي المبيعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{isLoading ? "..." : fmt(data?.totalAmount ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">ج.م (شامل الضريبة)</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">تفاصيل الفواتير الضريبية</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : !data?.invoices.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              لا توجد فواتير خاضعة للضريبة في هذه الفترة
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>طريقة الدفع</TableHead>
                  <TableHead className="text-left">الوعاء الضريبي</TableHead>
                  <TableHead className="text-left">نسبة الضريبة</TableHead>
                  <TableHead className="text-left text-amber-700">الضريبة</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-semibold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(inv.createdAt)}</TableCell>
                    <TableCell>{inv.customerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PAY_LABELS[inv.paymentMethod] ?? inv.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="text-left" dir="ltr">{fmt(inv.subtotal)}</TableCell>
                    <TableCell className="text-left">
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        {inv.taxRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left font-semibold text-amber-700" dir="ltr">
                      {fmt(inv.tax)}
                    </TableCell>
                    <TableCell className="text-left font-bold text-green-700" dir="ltr">{fmt(inv.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Footer total row */}
      {data && data.invoices.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <span className="font-bold text-amber-800">إجمالي الضريبة المستحقة للفترة المحددة</span>
              <span className="text-2xl font-bold text-amber-700">{fmt(data.totalTax)} ج.م</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
