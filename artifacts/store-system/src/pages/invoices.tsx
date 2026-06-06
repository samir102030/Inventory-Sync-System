import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetInvoices, useGetInvoice, getGetInvoicesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Printer, Eye, Edit, RotateCcw, XCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api";
const fetchJSON = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", ...opts }).then(r => r.json());

type ReturnItem = { productId: number; productName: string; quantity: number; unitPrice: number; total: number };
type InvoiceReturn = { id: number; returnNumber: string; reason?: string | null; total: number; createdAt: string; items: ReturnItem[] };

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid: { label: "مدفوعة", color: "bg-green-500 hover:bg-green-600" },
  draft: { label: "مسودة", color: "bg-secondary text-secondary-foreground" },
  cancelled: { label: "ملغاة", color: "bg-destructive text-destructive-foreground" },
  returned: { label: "مرتجعة", color: "bg-orange-500 hover:bg-orange-600" },
  partial_return: { label: "مرتجع جزئي", color: "bg-yellow-500 hover:bg-yellow-600" },
};

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة بنكية" },
  { value: "transfer", label: "تحويل بنكي" },
  { value: "credit", label: "آجل" },
  { value: "instapay", label: "انستا باي" },
  { value: "vodafone_cash", label: "فودافون كاش" },
];

function getPaymentLabel(method: string) {
  return PAYMENT_METHODS.find(m => m.value === method)?.label ?? method;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "bg-secondary" };
  return <Badge className={s.color}>{s.label}</Badge>;
}

function EditInvoiceDialog({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const { data: invoice } = useGetInvoice(invoiceId);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<{ paymentMethod: string; discount: string; tax: string; notes: string; status: string } | null>(null);

  if (invoice && !form) {
    setForm({
      paymentMethod: invoice.paymentMethod ?? "cash",
      discount: String(invoice.discount ?? 0),
      tax: String(invoice.tax ?? 0),
      notes: invoice.notes ?? "",
      status: invoice.status,
    });
  }

  const update = useMutation({
    mutationFn: (data: object) => fetchJSON(`${BASE}/invoices/${invoiceId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "تم تحديث الفاتورة" });
      qc.invalidateQueries({ queryKey: getGetInvoicesQueryKey({}) });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      onClose();
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  if (!invoice || !form) return null;
  const isCancelled = invoice.status === "cancelled";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ paymentMethod: form.paymentMethod, discount: parseFloat(form.discount || "0"), tax: parseFloat(form.tax || "0"), notes: form.notes, status: form.status });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {isCancelled && <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">هذه الفاتورة ملغاة — لا يمكن تعديل بعض البيانات</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>طريقة الدفع</Label>
          <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الحالة</Label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">مدفوعة</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="credit">آجل</SelectItem>
              <SelectItem value="cancelled">ملغاة ⚠ (يُرجع المخزون)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>الخصم (ج.م)</Label>
          <Input type="number" min="0" step="0.01" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>الضريبة (ج.م)</Label>
          <Input type="number" min="0" step="0.01" value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>ملاحظات</Label>
        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>

      <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>المجموع الفرعي:</span><span>{invoice.subtotal?.toFixed(2)} ج.م</span></div>
        <div className="flex justify-between text-destructive"><span>الخصم:</span><span>-{parseFloat(form.discount || "0").toFixed(2)} ج.م</span></div>
        <div className="flex justify-between"><span>الضريبة:</span><span>+{parseFloat(form.tax || "0").toFixed(2)} ج.م</span></div>
        <div className="flex justify-between font-bold border-t pt-1 mt-1">
          <span>الإجمالي الجديد:</span>
          <span>{(Number(invoice.subtotal) - parseFloat(form.discount || "0") + parseFloat(form.tax || "0")).toFixed(2)} ج.م</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={update.isPending}>حفظ التعديلات</Button>
      </div>
    </form>
  );
}

function ReturnDialog({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const { data: invoice } = useGetInvoice(invoiceId);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");

  const createReturn = useMutation({
    mutationFn: (data: object) => fetchJSON(`${BASE}/invoices/${invoiceId}/return`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "تم تسجيل المرتجع بنجاح", description: "تم إعادة المخزون تلقائياً" });
      qc.invalidateQueries({ queryKey: getGetInvoicesQueryKey({}) });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoice-returns", invoiceId] });
      onClose();
    },
    onError: async (err: any) => toast({ title: "خطأ في المرتجع", description: err?.message, variant: "destructive" }),
  });

  if (!invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = invoice.items
      ?.filter(item => Number(returnQty[item.productId] ?? 0) > 0)
      .map(item => ({ productId: item.productId, quantity: Number(returnQty[item.productId] ?? 0) }));
    if (!items?.length) { toast({ title: "اختر كمية للإرجاع", variant: "destructive" }); return; }
    createReturn.mutate({ reason, items });
  };

  const totalReturn = invoice.items?.reduce((s, item) => s + (Number(returnQty[item.productId] ?? 0) * item.unitPrice), 0) ?? 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="text-sm text-muted-foreground bg-orange-50 border border-orange-200 rounded p-3">
        اختر الأصناف والكميات المراد إرجاعها — سيتم إعادة المخزون تلقائياً
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المنتج</TableHead>
            <TableHead>الكمية الأصلية</TableHead>
            <TableHead>سعر الوحدة</TableHead>
            <TableHead>كمية الإرجاع</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.items?.map(item => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{item.unitPrice} ج.م</TableCell>
              <TableCell>
                <Input
                  type="number" min="0" max={item.quantity} step="1"
                  className="w-24" placeholder="0"
                  value={returnQty[item.productId] ?? ""}
                  onChange={e => setReturnQty(prev => ({ ...prev, [item.productId]: e.target.value }))}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalReturn > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded p-3 flex justify-between font-bold">
          <span>إجمالي المرتجع:</span>
          <span className="text-orange-600">{totalReturn.toFixed(2)} ج.م</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>سبب الإرجاع</Label>
        <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: منتج معيب، العميل غير راضٍ..." rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={createReturn.isPending || totalReturn === 0} className="bg-orange-500 hover:bg-orange-600">
          {createReturn.isPending ? "جاري التسجيل..." : "تأكيد المرتجع"}
        </Button>
      </div>
    </form>
  );
}

function InvoiceDetail({ id, onEdit, onReturn }: { id: number; onEdit: () => void; onReturn: () => void }) {
  const { data: invoice, isLoading } = useGetInvoice(id);
  const { data: returns = [] } = useQuery<InvoiceReturn[]>({
    queryKey: ["invoice-returns", id],
    queryFn: () => fetchJSON(`${BASE}/invoices/${id}/returns`),
    enabled: !!id,
  });

  if (isLoading || !invoice) return <div className="p-8 text-center">جاري التحميل...</div>;

  const canReturn = invoice.status === "paid" || invoice.status === "partial_return";
  const isCancelled = invoice.status === "cancelled";

  return (
    <div className="space-y-5 print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">فاتورة #{invoice.invoiceNumber}</h2>
          <p className="text-muted-foreground text-sm">{format(new Date(invoice.createdAt), 'yyyy/MM/dd HH:mm')}</p>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="text-left space-y-1">
          <p className="font-bold">{invoice.customerName || 'عميل نقدي'}</p>
          <p className="text-sm text-muted-foreground">طريقة الدفع: {getPaymentLabel(invoice.paymentMethod || '')}</p>
          {invoice.notes && <p className="text-sm text-muted-foreground">ملاحظات: {invoice.notes}</p>}
        </div>
      </div>

      {/* Items */}
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
          {invoice.items?.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.productName}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{item.unitPrice} ج.م</TableCell>
              <TableCell className="text-left font-bold">{(item.quantity * item.unitPrice).toFixed(2)} ج.م</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Totals */}
      <div className="flex justify-end pt-2 border-t">
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع الفرعي:</span><span>{invoice.subtotal?.toFixed(2)} ج.م</span></div>
          {invoice.discount > 0 && <div className="flex justify-between text-sm text-destructive"><span>الخصم:</span><span>-{invoice.discount.toFixed(2)} ج.م</span></div>}
          {invoice.tax > 0 && <div className="flex justify-between text-sm"><span>الضريبة:</span><span>+{invoice.tax.toFixed(2)} ج.م</span></div>}
          <div className="flex justify-between text-lg font-bold border-t pt-1"><span>الإجمالي:</span><span>{invoice.total.toFixed(2)} ج.م</span></div>
        </div>
      </div>

      {/* Returns history */}
      {returns.length > 0 && (
        <div className="border rounded-lg p-4 bg-orange-50/50 space-y-3">
          <h3 className="font-semibold text-orange-700 flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            سجل المرتجعات ({returns.length})
          </h3>
          {returns.map(ret => (
            <div key={ret.id} className="bg-white border border-orange-200 rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-sm">{ret.returnNumber}</span>
                <span className="text-orange-600 font-bold">{ret.total.toFixed(2)} ج.م</span>
              </div>
              <div className="text-xs text-muted-foreground">{format(new Date(ret.createdAt), 'yyyy/MM/dd HH:mm')}{ret.reason && ` — ${ret.reason}`}</div>
              <div className="text-xs space-y-0.5">
                {ret.items.map((item, i) => (
                  <div key={i} className="flex justify-between"><span>{item.productName}</span><span>× {item.quantity} = {item.total.toFixed(2)} ج.م</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-3 border-t no-print">
        <div className="flex gap-2">
          {!isCancelled && (
            <Button variant="outline" onClick={onEdit} size="sm">
              <Edit className="h-4 w-4 ml-1" />
              تعديل
            </Button>
          )}
          {canReturn && (
            <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={onReturn} size="sm">
              <RotateCcw className="h-4 w-4 ml-1" />
              مرتجع
            </Button>
          )}
        </div>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="h-4 w-4 ml-1" />
          طباعة
        </Button>
      </div>
    </div>
  );
}

type DialogMode = "view" | "edit" | "return";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("view");

  const { data: invoices, isLoading } = useGetInvoices({});

  const filteredInvoices = invoices?.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customerName && inv.customerName.toLowerCase().includes(search.toLowerCase()))
  );

  const openInvoice = (id: number) => { setSelectedInvoice(id); setDialogMode("view"); };
  const closeDialog = () => { setSelectedInvoice(null); setDialogMode("view"); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الفواتير</h1>
      </div>

      <Card>
        <CardHeader className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث برقم الفاتورة أو العميل..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
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
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filteredInvoices?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
              ) : (
                filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openInvoice(invoice.id)}>
                    <TableCell className="font-medium font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{format(new Date(invoice.createdAt), 'yyyy/MM/dd HH:mm')}</TableCell>
                    <TableCell>{invoice.customerName || 'عميل نقدي'}</TableCell>
                    <TableCell className="font-bold">{invoice.total.toFixed(2)} ج.م</TableCell>
                    <TableCell>{getPaymentLabel(invoice.paymentMethod || '')}</TableCell>
                    <TableCell><StatusBadge status={invoice.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => { e.stopPropagation(); openInvoice(invoice.id); }}>
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

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "view" && "تفاصيل الفاتورة"}
              {dialogMode === "edit" && "تعديل الفاتورة"}
              {dialogMode === "return" && "تسجيل مرتجع"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "view" && "عرض تفاصيل الفاتورة مع إمكانية التعديل أو المرتجع"}
              {dialogMode === "edit" && "تعديل بيانات الفاتورة — تغيير الحالة إلى ملغاة يُرجع المخزون تلقائياً"}
              {dialogMode === "return" && "اختر الأصناف والكميات المراد إرجاعها"}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <>
              {dialogMode === "view" && (
                <InvoiceDetail
                  id={selectedInvoice}
                  onEdit={() => setDialogMode("edit")}
                  onReturn={() => setDialogMode("return")}
                />
              )}
              {dialogMode === "edit" && (
                <EditInvoiceDialog invoiceId={selectedInvoice} onClose={() => setDialogMode("view")} />
              )}
              {dialogMode === "return" && (
                <ReturnDialog invoiceId={selectedInvoice} onClose={() => setDialogMode("view")} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
