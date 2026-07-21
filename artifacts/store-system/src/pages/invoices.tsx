import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetInvoices, useGetInvoice, useGetInvoiceSettings, getGetInvoicesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Printer, Eye, Edit, RotateCcw, MessageCircle, Download } from "lucide-react";
import { exportToExcel } from "@/lib/excel";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp, buildInvoiceMessage } from "@/lib/whatsapp";

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

type Account = { id: number; name: string; balance: number };

function ReturnDialog({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const { data: invoice } = useGetInvoice(invoiceId);
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => fetchJSON(`${BASE}/accounts`) });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [returnAccountId, setReturnAccountId] = useState<string>("");

  const createReturn = useMutation({
    mutationFn: (data: object) => fetchJSON(`${BASE}/invoices/${invoiceId}/return`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "تم تسجيل المرتجع بنجاح", description: "تم إعادة المخزون وتحديث الخزنة" });
      qc.invalidateQueries({ queryKey: getGetInvoicesQueryKey({}) });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoice-returns", invoiceId] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
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
    const effectiveAccountId = returnAccountId || (invoice as any).accountId;
    createReturn.mutate({ reason, items, accountId: effectiveAccountId ? Number(effectiveAccountId) : undefined });
  };

  const totalReturn = invoice.items?.reduce((s, item) => s + (Number(returnQty[item.productId] ?? 0) * item.unitPrice), 0) ?? 0;
  const invoiceAccountId = String((invoice as any).accountId ?? "");

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="text-sm text-muted-foreground bg-orange-50 border border-orange-200 rounded p-3">
        اختر الأصناف والكميات المراد إرجاعها — سيتم إعادة المخزون وتحديث الخزنة تلقائياً
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>الخصم من الخزنة</Label>
          <Select value={returnAccountId || invoiceAccountId} onValueChange={setReturnAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="بدون خصم من الخزنة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون خصم من الخزنة</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name} — {Number(a.balance).toFixed(2)} ج.م
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>سبب الإرجاع</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="منتج معيب، العميل غير راضٍ..." rows={1} />
        </div>
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

function printInvoiceWindow(invoice: any, settings: any, returns: any[]) {
  const companyName = settings?.companyName || "شركتي";
  const companyPhone = settings?.companyPhone || "";
  const companyAddress = settings?.companyAddress || "";
  const companyEmail = settings?.companyEmail || "";
  const companyLogo = settings?.companyLogo || "";
  const footerNote = settings?.footerNote || "";
  const primaryColor = settings?.primaryColor || "#1e40af";

  const itemRows = (invoice.items || []).map((item: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${Number(item.unitPrice).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;">${(item.quantity * item.unitPrice).toFixed(2)}</td>
    </tr>`).join("");

  const returnRows = returns.map(ret => `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px;margin-top:6px;">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;">
        <span>${ret.returnNumber}</span><span style="color:#ea580c;">${Number(ret.total).toFixed(2)} ج.م</span>
      </div>
      <div style="font-size:11px;color:#666;margin-top:4px;">${new Date(ret.createdAt).toLocaleString('ar-EG')}${ret.reason ? ` — ${ret.reason}` : ''}</div>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>فاتورة #${invoice.invoiceNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size:14px; color:#1a1a1a; background:#fff; direction:rtl; }
  @page { size: A4; margin: 15mm 12mm; }
  .page { max-width:780px; margin:0 auto; padding:20px; }
  /* ===== COMPANY HEADER ===== */
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:3px solid ${primaryColor}; margin-bottom:20px; }
  .logo { max-height:80px; max-width:180px; object-fit:contain; }
  .company-info { text-align:right; }
  .company-name { font-size:22px; font-weight:700; color:${primaryColor}; }
  .company-detail { font-size:12px; color:#555; margin-top:3px; }
  /* ===== INVOICE META ===== */
  .meta { display:flex; justify-content:space-between; background:#f8f9fa; border-radius:8px; padding:14px 18px; margin-bottom:20px; }
  .meta-block h3 { font-size:11px; text-transform:uppercase; color:#888; letter-spacing:.5px; margin-bottom:4px; }
  .meta-block p { font-weight:600; font-size:14px; }
  .badge { display:inline-block; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:600; }
  .badge-paid { background:#dcfce7; color:#166534; }
  .badge-draft { background:#f3f4f6; color:#374151; }
  .badge-cancelled { background:#fee2e2; color:#991b1b; }
  .badge-returned { background:#fed7aa; color:#9a3412; }
  /* ===== ITEMS TABLE ===== */
  .items-table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  .items-table thead { background:${primaryColor}; color:#fff; }
  .items-table thead th { padding:10px 12px; text-align:right; font-size:13px; font-weight:600; }
  .items-table thead th:not(:first-child) { text-align:center; }
  .items-table tbody tr:nth-child(even) { background:#f9fafb; }
  /* ===== TOTALS ===== */
  .totals { display:flex; justify-content:flex-end; margin-bottom:16px; }
  .totals-box { width:260px; }
  .totals-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; border-bottom:1px solid #f0f0f0; }
  .totals-final { display:flex; justify-content:space-between; padding:8px 0 0; font-size:16px; font-weight:700; color:${primaryColor}; }
  /* ===== FOOTER ===== */
  .footer { margin-top:24px; padding-top:12px; border-top:1px solid #e5e7eb; text-align:center; font-size:11px; color:#888; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<div class="page">
  <!-- COMPANY HEADER -->
  <div class="header">
    <div class="company-info">
      <div class="company-name">${companyName}</div>
      ${companyPhone ? `<div class="company-detail">📞 ${companyPhone}</div>` : ""}
      ${companyAddress ? `<div class="company-detail">📍 ${companyAddress}</div>` : ""}
      ${companyEmail ? `<div class="company-detail">✉ ${companyEmail}</div>` : ""}
    </div>
    ${companyLogo ? `<img src="${companyLogo}" class="logo" alt="logo"/>` : `<div style="width:100px;height:60px;background:${primaryColor};border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;text-align:center;padding:4px;">${companyName}</div>`}
  </div>

  <!-- INVOICE META -->
  <div class="meta">
    <div class="meta-block">
      <h3>رقم الفاتورة</h3>
      <p>${invoice.invoiceNumber}</p>
    </div>
    <div class="meta-block">
      <h3>التاريخ</h3>
      <p>${new Date(invoice.createdAt).toLocaleDateString('ar-EG')}</p>
    </div>
    <div class="meta-block">
      <h3>العميل</h3>
      <p>${invoice.customerName || "عميل نقدي"}</p>
    </div>
    <div class="meta-block">
      <h3>طريقة الدفع</h3>
      <p>${getPaymentLabel(invoice.paymentMethod || "")}</p>
    </div>
    <div class="meta-block">
      <h3>الحالة</h3>
      <span class="badge badge-${invoice.status}">${(({ paid:"مدفوعة", draft:"مسودة", cancelled:"ملغاة", returned:"مرتجعة", partial_return:"مرتجع جزئي" } as Record<string,string>)[invoice.status as string]) || invoice.status}</span>
    </div>
  </div>

  <!-- ITEMS -->
  <table class="items-table">
    <thead>
      <tr>
        <th>المنتج</th>
        <th style="text-align:center;">الكمية</th>
        <th style="text-align:center;">سعر الوحدة (ج.م)</th>
        <th style="text-align:center;">المجموع (ج.م)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>المجموع الفرعي</span><span>${Number(invoice.subtotal || 0).toFixed(2)} ج.م</span></div>
      ${Number(invoice.discount) > 0 ? `<div class="totals-row" style="color:#dc2626;"><span>الخصم</span><span>-${Number(invoice.discount).toFixed(2)} ج.م</span></div>` : ""}
      ${Number(invoice.tax) > 0 ? `<div class="totals-row"><span>الضريبة</span><span>+${Number(invoice.tax).toFixed(2)} ج.م</span></div>` : ""}
      <div class="totals-final"><span>الإجمالي</span><span>${Number(invoice.total).toFixed(2)} ج.م</span></div>
    </div>
  </div>

  ${invoice.notes ? `<div style="background:#f8f9fa;border-radius:6px;padding:10px 14px;font-size:12px;color:#555;margin-bottom:16px;"><strong>ملاحظات:</strong> ${invoice.notes}</div>` : ""}

  ${returns.length > 0 ? `<div style="margin-bottom:16px;"><div style="font-weight:600;color:#ea580c;margin-bottom:6px;">سجل المرتجعات</div>${returnRows}</div>` : ""}

  <!-- FOOTER -->
  <div class="footer">${footerNote || `شكراً لتعاملكم مع ${companyName}`}</div>
</div>
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) { win.document.write(html); win.document.close(); }
}

function printReceiptWindow(invoice: any, settings: any, returns: any[]) {
  const companyName = settings?.companyName || "شركتي";
  const companyPhone = settings?.companyPhone || "";
  const companyAddress = settings?.companyAddress || "";
  const footerNote = settings?.footerNote || "";

  const itemLines = (invoice.items || []).map((item: any) => {
    const name = String(item.productName);
    const qty = item.quantity;
    const price = Number(item.unitPrice).toFixed(2);
    const total = (item.quantity * item.unitPrice).toFixed(2);
    return `<div class="item-name">${name}</div>
            <div class="item-row"><span>${qty} × ${price}</span><span>${total} ج</span></div>`;
  }).join('<div class="sep-thin"></div>');

  const returnLines = returns.map(ret =>
    `<div class="item-row"><span>${ret.returnNumber}</span><span style="color:#000;">-${Number(ret.total).toFixed(2)} ج</span></div>`
  ).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>ريسيت #${invoice.invoiceNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { margin: 4mm 3mm; }
  body {
    font-family: Arial, 'Segoe UI', sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    direction: rtl;
    width: 100%;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .large { font-size: 18px; font-weight: bold; }
  .sep { border-top: 2px dashed #000; margin: 6px 0; }
  .sep-thin { border-top: 1px dotted #666; margin: 4px 0; }
  .item-name { font-weight: bold; margin-top: 6px; word-break: break-word; font-size: 15px; }
  .item-row { display: flex; justify-content: space-between; font-size: 14px; color: #222; margin-bottom: 3px; }
  .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 15px; }
  .total-final { display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; padding: 6px 0; border-top: 3px solid #000; margin-top: 6px; }
  .footer { text-align: center; font-size: 13px; margin-top: 10px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="center bold large">${companyName}</div>
  ${companyPhone ? `<div class="center" style="font-size:15px;">${companyPhone}</div>` : ""}
  ${companyAddress ? `<div class="center" style="font-size:13px;">${companyAddress}</div>` : ""}
  <div class="sep"></div>

  <div class="total-row"><span>فاتورة #</span><span class="bold">${invoice.invoiceNumber}</span></div>
  <div class="total-row"><span>التاريخ</span><span dir="ltr">${new Date(invoice.createdAt).toLocaleDateString('en-GB')} ${new Date(invoice.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="total-row"><span>العميل</span><span>${invoice.customerName || "نقدي"}</span></div>
  <div class="total-row"><span>الدفع</span><span>${getPaymentLabel(invoice.paymentMethod || "")}</span></div>
  <div class="sep"></div>

  ${itemLines}

  <div class="sep"></div>
  <div class="total-row"><span>المجموع الفرعي</span><span>${Number(invoice.subtotal || 0).toFixed(2)} ج</span></div>
  ${Number(invoice.discount) > 0 ? `<div class="total-row"><span>الخصم</span><span>-${Number(invoice.discount).toFixed(2)} ج</span></div>` : ""}
  ${Number(invoice.tax) > 0 ? `<div class="total-row"><span>الضريبة</span><span>+${Number(invoice.tax).toFixed(2)} ج</span></div>` : ""}
  <div class="total-final"><span>الإجمالي</span><span>${Number(invoice.total).toFixed(2)} ج.م</span></div>

  ${invoice.notes ? `<div class="sep"></div><div style="font-size:10px;">ملاحظة: ${invoice.notes}</div>` : ""}

  ${returns.length > 0 ? `<div class="sep"></div><div class="bold" style="font-size:11px;">مرتجعات:</div>${returnLines}` : ""}

  <div class="sep"></div>
  <div class="footer">${footerNote || `شكراً لتعاملكم مع ${companyName}`}</div>
  <div style="margin-top:16px;"></div>
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=350,height=600");
  if (win) { win.document.write(html); win.document.close(); }
}

function InvoiceDetail({ id, onEdit, onReturn }: { id: number; onEdit: () => void; onReturn: () => void }) {
  const { data: invoice, isLoading } = useGetInvoice(id);
  const { data: settings } = useGetInvoiceSettings();
  const { data: returns = [] } = useQuery<InvoiceReturn[]>({
    queryKey: ["invoice-returns", id],
    queryFn: () => fetchJSON(`${BASE}/invoices/${id}/returns`),
    enabled: !!id,
  });

  if (isLoading || !invoice) return <div className="p-8 text-center">جاري التحميل...</div>;

  const canReturn = invoice.status === "paid" || invoice.status === "partial_return";
  const isCancelled = invoice.status === "cancelled";
  const companyName = (settings as any)?.companyName || "شركتي";
  const companyPhone = (settings as any)?.companyPhone || "";
  const companyAddress = (settings as any)?.companyAddress || "";
  const companyLogo = (settings as any)?.companyLogo || "";
  const primaryColor = (settings as any)?.primaryColor || "#1e40af";

  return (
    <div className="space-y-5">
      {/* Company Header — visible in view & print */}
      <div className="flex justify-between items-start pb-4 border-b-2" style={{ borderColor: primaryColor }}>
        <div>
          <h2 className="text-xl font-bold" style={{ color: primaryColor }}>{companyName}</h2>
          {companyPhone && <p className="text-sm text-muted-foreground">📞 {companyPhone}</p>}
          {companyAddress && <p className="text-sm text-muted-foreground">📍 {companyAddress}</p>}
        </div>
        {companyLogo
          ? <img src={companyLogo} className="h-14 max-w-[140px] object-contain" alt="logo" />
          : <div className="text-2xl font-black opacity-20">{companyName.slice(0, 2)}</div>
        }
      </div>

      {/* Invoice Meta */}
      <div className="flex justify-between items-start">
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
            <TableHead className="text-left text-green-700">الربح 🔒</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.items?.map((item) => {
            const cost = (item as any).costPrice ?? 0;
            const itemProfit = (item.unitPrice - cost) * item.quantity - (item.discount ?? 0);
            return (
              <TableRow key={item.id}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.unitPrice} ج.م</TableCell>
                <TableCell className="text-left font-bold">{(item.quantity * item.unitPrice - item.discount).toFixed(2)} ج.م</TableCell>
                <TableCell className={`text-left font-bold text-sm ${itemProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {cost > 0 ? `${itemProfit.toFixed(2)} ج.م` : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Totals + Profit */}
      <div className="flex justify-end pt-2 border-t gap-4 flex-wrap">
        {(() => {
          const items = invoice.items ?? [];
          const totalCost = items.reduce((s, i) => s + (((i as any).costPrice ?? 0) * i.quantity), 0);
          const hasAnyCost = items.some(i => ((i as any).costPrice ?? 0) > 0);
          const grossProfit = invoice.total - totalCost;
          const margin = invoice.total > 0 ? (grossProfit / invoice.total) * 100 : 0;
          return hasAnyCost ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm space-y-1 min-w-52">
              <div className="font-semibold text-green-800 flex items-center gap-1 mb-1">🔒 الربح (داخلي فقط)</div>
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي التكلفة:</span><span>{totalCost.toFixed(2)} ج.م</span></div>
              <div className="flex justify-between font-bold text-green-700"><span>صافي الربح:</span><span>{grossProfit.toFixed(2)} ج.م</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>هامش الربح:</span><span>{margin.toFixed(1)}%</span></div>
            </div>
          ) : null;
        })()}
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
      <div className="flex justify-between items-center pt-3 border-t">
        <div className="flex gap-2 flex-wrap">
          {!isCancelled && (
            <Button variant="outline" onClick={onEdit} size="sm">
              <Edit className="h-4 w-4 ml-1" />تعديل
            </Button>
          )}
          {canReturn && (
            <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={onReturn} size="sm">
              <RotateCcw className="h-4 w-4 ml-1" />مرتجع
            </Button>
          )}
          {(invoice as any).customerWhatsapp && (
            <Button variant="outline" size="sm" className="text-green-600 border-green-500 hover:bg-green-50 gap-1"
              onClick={() => openWhatsApp((invoice as any).customerWhatsapp, buildInvoiceMessage({ ...invoice, items: invoice.items }))}>
              <MessageCircle className="h-4 w-4" />إرسال واتساب
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => printReceiptWindow(invoice, settings, returns)} size="sm" variant="outline" className="gap-1">
            <Printer className="h-4 w-4" />ريسيت
          </Button>
          <Button onClick={() => printInvoiceWindow(invoice, settings, returns)} size="sm" className="gap-1">
            <Download className="h-4 w-4" />A4 / PDF
          </Button>
        </div>
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

  const handleExport = () => {
    const rows = (invoices ?? []).map(inv => [
      inv.invoiceNumber, inv.createdAt ? inv.createdAt.slice(0, 10) : "",
      inv.customerName ?? "", inv.total, inv.discount ?? 0, inv.tax ?? 0,
      STATUS_MAP[inv.status]?.label ?? inv.status,
      getPaymentLabel(inv.paymentMethod ?? ""), inv.notes ?? "",
    ]);
    exportToExcel(["رقم الفاتورة","التاريخ","العميل","الإجمالي","الخصم","الضريبة","الحالة","طريقة الدفع","ملاحظات"], rows, "invoices", "الفواتير");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الفواتير</h1>
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
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
