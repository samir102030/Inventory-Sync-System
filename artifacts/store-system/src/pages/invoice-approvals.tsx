import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ClipboardCheck, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { jsonOrThrow } from "@/lib/http";

/**
 * فواتير الكاشير بانتظار مراجعة الأدمن.
 *
 * المخزون والخزينة تحرّكا لحظة البيع — الزبون أخذ وأعطى. هذه الصفحة تدقيق:
 * الأدمن يقرأ ما باعه الكاشير، يصحّح إن أخطأ، ثم يعتمد.
 *
 * الكاشير لا يفتحها ولا يعتمد فاتورة، ولا فاتورة نفسه.
 */

type PendingInvoice = {
  id: number;
  invoiceNumber: string;
  customerName: string | null;
  total: number;
  paymentMethod: string;
  createdBy: string | null;
  createdAt: string;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  credit: "آجل",
  transfer: "تحويل",
};

export default function InvoiceApprovals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pending = [], isLoading } = useQuery<PendingInvoice[]>({
    queryKey: ["invoices", "pending-approval"],
    queryFn: () =>
      fetch("/api/invoices?approval=pending", { credentials: "include" }).then(jsonOrThrow),
  });

  const approve = useMutation({
    mutationFn: (invoice: PendingInvoice) =>
      fetch(`/api/invoices/${invoice.id}/approve`, {
        method: "POST",
        credentials: "include",
      }).then(jsonOrThrow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "تم اعتماد الفاتورة" });
    },
    onError: (error: Error) =>
      toast({ title: "تعذّر الاعتماد", description: error.message, variant: "destructive" }),
  });

  const total = pending.reduce((sum, invoice) => sum + Number(invoice.total), 0);

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">فواتير بانتظار الاعتماد</h1>
        <p className="text-sm text-muted-foreground">
          فواتير أنشأها الكاشير. راجعها، وعدّلها لو فيها غلط، وبعدين اعتمدها.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            بانتظار المراجعة
            {pending.length > 0 && <Badge>{pending.length}</Badge>}
          </CardTitle>
          {pending.length > 0 && (
            <CardDescription>إجمالي قيمتها {total.toFixed(2)} ج.م</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead>الكاشير</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">جاري التحميل...</TableCell></TableRow>
              ) : pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    مفيش فواتير مستنية — كله معتمد.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.customerName ?? "—"}</TableCell>
                    <TableCell className="font-bold">{Number(invoice.total).toFixed(2)} ج.م</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PAYMENT_LABEL[invoice.paymentMethod] ?? invoice.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>{invoice.createdBy ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invoice.createdAt), "yyyy/MM/dd HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          disabled={approve.isPending}
                          title="اعتماد"
                          onClick={() => {
                            if (confirm(`اعتماد فاتورة ${invoice.invoiceNumber} بمبلغ ${Number(invoice.total).toFixed(2)} ج.م؟`)) {
                              approve.mutate(invoice);
                            }
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        {/* التعديل في شاشة الفواتير نفسها — لا نسخة ثانية منها هنا. */}
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="فتح للتعديل">
                          <Link href="/invoices">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
