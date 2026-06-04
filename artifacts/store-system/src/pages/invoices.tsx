import { useState } from "react";
import { useGetInvoices, useGetInvoice, getGetInvoicesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Printer, Eye } from "lucide-react";
import { format } from "date-fns";

function InvoiceDetail({ id }: { id: number }) {
  const { data: invoice, isLoading } = useGetInvoice(id);

  if (isLoading || !invoice) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="space-y-6 p-4 print:p-0">
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">فاتورة #{invoice.invoiceNumber}</h2>
          <p className="text-muted-foreground">{format(new Date(invoice.createdAt), 'yyyy/MM/dd HH:mm')}</p>
        </div>
        <div className="text-left">
          <p className="font-bold">{invoice.customerName || 'عميل نقدي'}</p>
          <p className="text-muted-foreground">طريقة الدفع: {invoice.paymentMethod}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المنتج</TableHead>
            <TableHead>الكمية</TableHead>
            <TableHead>سعر الوحدة</TableHead>
            <TableHead className="text-left">المجموع</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.productName}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{item.unitPrice} د.ك</TableCell>
              <TableCell className="text-left font-bold">{(item.quantity * item.unitPrice).toFixed(2)} د.ك</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end pt-4 border-t">
        <div className="w-64 space-y-2">
          {invoice.discount && invoice.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">الخصم:</span>
              <span>{invoice.discount} د.ك</span>
            </div>
          )}
          {invoice.tax && invoice.tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">الضريبة:</span>
              <span>{invoice.tax} د.ك</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>الإجمالي:</span>
            <span>{invoice.total.toFixed(2)} د.ك</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 no-print">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4 ml-2" />
          طباعة הפاتورة
        </Button>
      </div>
    </div>
  );
}

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  
  // Use debounced search or just standard
  const { data: invoices, isLoading } = useGetInvoices({});

  const filteredInvoices = invoices?.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customerName && inv.customerName.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid': return <Badge className="bg-green-500 hover:bg-green-600">مدفوعة</Badge>;
      case 'draft': return <Badge variant="secondary">مسودة</Badge>;
      case 'cancelled': return <Badge variant="destructive">ملغاة</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethod = (method: string) => {
    switch(method) {
      case 'cash': return "نقدي";
      case 'card': return "بطاقة بنكية";
      case 'transfer': return "تحويل بنكي";
      case 'credit': return "آجل";
      default: return method;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الفواتير</h1>
      </div>
      
      <Card>
        <CardHeader className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث برقم الفاتورة أو العميل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : filteredInvoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد فواتير</TableCell>
                </TableRow>
              ) : (
                filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedInvoice(invoice.id)}>
                    <TableCell className="font-medium font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{format(new Date(invoice.createdAt), 'yyyy/MM/dd HH:mm')}</TableCell>
                    <TableCell>{invoice.customerName || 'عميل نقدي'}</TableCell>
                    <TableCell className="font-bold">{invoice.total.toFixed(2)} د.ك</TableCell>
                    <TableCell>{getPaymentMethod(invoice.paymentMethod || '')}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-3xl" dir="rtl">
          {selectedInvoice && <InvoiceDetail id={selectedInvoice} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
