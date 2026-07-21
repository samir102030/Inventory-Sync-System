import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetInvoiceSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Eye, Edit, Trash2, Printer, FileCheck, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/excel";
import { downloadPDF } from "@/lib/pdf";

const BASE = "/api";
const fetchJSON = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", ...opts }).then(r => r.json());

type QItem = { productId?: number | null; productName: string; quantity: number; unitPrice: number };
type Quotation = {
  id: number; quotationNumber: string; customerId?: number | null; customerName?: string | null;
  subtotal: number; discount: number; tax: number; total: number;
  status: string; notes?: string | null; validUntil?: string | null; createdAt: string;
  items?: QItem[];
};
type Product = { id: number; name: string; barcode?: string | null; price: number; stock: number; costPrice?: number | null };
type Customer = { id: number; name: string; phone?: string | null };

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة", sent: "مُرسل", accepted: "مقبول", rejected: "مرفوض",
  expired: "منتهي الصلاحية", converted: "تم التحويل",
};
const STATUS_VARIANTS: Record<string, string> = {
  draft: "secondary", sent: "outline", accepted: "default",
  rejected: "destructive", expired: "destructive", converted: "default",
};

function StatusBadge({ status }: { status: string }) {
  const variant = (STATUS_VARIANTS[status] || "secondary") as any;
  return <Badge variant={variant}>{STATUS_LABELS[status] || status}</Badge>;
}

async function downloadQuotationPDF(q: Quotation, settings: any) {
  const html = buildQuotationHTML(q, settings);
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    await downloadPDF(container, `عرض-سعر-${q.quotationNumber}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

function buildQuotationHTML(q: Quotation, settings: any): string {
  const companyName = settings?.companyName || "شركتي";
  const companyPhone = settings?.companyPhone || "";
  const companyAddress = settings?.companyAddress || "";
  const companyEmail = (settings as any)?.companyEmail || "";
  const companyLogo = (settings as any)?.companyLogo || "";
  const footerNote = (settings as any)?.footerNote || "";
  const primaryColor = settings?.primaryColor || "#1e40af";

  const itemRows = (q.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${Number(item.unitPrice).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;">${(item.quantity * item.unitPrice).toFixed(2)}</td>
    </tr>`).join("");

  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;background:#fff;padding:24px;direction:rtl;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid ${primaryColor};margin-bottom:20px;">
    <div>
      <div style="font-size:22px;font-weight:700;color:${primaryColor};">${companyName}</div>
      ${companyPhone ? `<div style="font-size:12px;color:#555;margin-top:4px;">📞 ${companyPhone}</div>` : ""}
      ${companyAddress ? `<div style="font-size:12px;color:#555;margin-top:2px;">📍 ${companyAddress}</div>` : ""}
      ${companyEmail ? `<div style="font-size:12px;color:#555;margin-top:2px;">✉ ${companyEmail}</div>` : ""}
    </div>
    ${companyLogo ? `<img src="${companyLogo}" style="max-height:80px;max-width:180px;object-fit:contain;" crossorigin="anonymous"/>` : `<div style="width:90px;height:50px;background:${primaryColor};border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;text-align:center;padding:4px;">${companyName}</div>`}
  </div>
  <div style="background:${primaryColor};color:#fff;text-align:center;padding:10px;font-size:18px;font-weight:700;border-radius:6px;margin-bottom:16px;">عرض سعر / Quotation</div>
  <div style="display:flex;justify-content:space-between;background:#f8f9fa;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
    <div><div style="font-size:11px;color:#888;margin-bottom:4px;">رقم العرض</div><div style="font-weight:600;">${q.quotationNumber}</div></div>
    <div><div style="font-size:11px;color:#888;margin-bottom:4px;">التاريخ</div><div style="font-weight:600;">${new Date(q.createdAt).toLocaleDateString('en-GB')}</div></div>
    <div><div style="font-size:11px;color:#888;margin-bottom:4px;">العميل</div><div style="font-weight:600;">${q.customerName || "—"}</div></div>
    <div><div style="font-size:11px;color:#888;margin-bottom:4px;">صالح حتى</div><div style="font-weight:600;">${q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-GB') : "—"}</div></div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead><tr style="background:${primaryColor};color:#fff;">
      <th style="padding:10px 12px;text-align:right;">المنتج / الخدمة</th>
      <th style="padding:10px 12px;text-align:center;">الكمية</th>
      <th style="padding:10px 12px;text-align:center;">سعر الوحدة (ج.م)</th>
      <th style="padding:10px 12px;text-align:center;">المجموع (ج.م)</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
    <div style="width:260px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #f0f0f0;"><span>المجموع الفرعي</span><span>${Number(q.subtotal).toFixed(2)} ج.م</span></div>
      ${Number(q.discount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#dc2626;border-bottom:1px solid #f0f0f0;"><span>الخصم</span><span>-${Number(q.discount).toFixed(2)} ج.م</span></div>` : ""}
      ${Number(q.tax) > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #f0f0f0;"><span>الضريبة</span><span>+${Number(q.tax).toFixed(2)} ج.م</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:16px;font-weight:700;color:${primaryColor};"><span>الإجمالي</span><span>${Number(q.total).toFixed(2)} ج.م</span></div>
    </div>
  </div>
  ${q.notes ? `<div style="background:#f8f9fa;border-radius:6px;padding:10px 14px;font-size:12px;color:#555;margin-bottom:16px;"><strong>ملاحظات:</strong> ${q.notes}</div>` : ""}
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#888;">${footerNote || `هذا العرض صادر من ${companyName} — نتطلع للتعامل معكم`}</div>
</div>`;
}

function printQuotationA4(q: Quotation, settings: any) {
  const primaryColor = settings?.primaryColor || "#1e40af";
  const innerHtml = buildQuotationHTML(q, settings);
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<title>عرض سعر #${q.quotationNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
thead{background:${primaryColor}!important;-webkit-print-color-adjust:exact;}</style>
</head><body>${innerHtml}
<script>window.onload=function(){window.print();};<\/script></body></html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  if (win) { win.document.write(html); win.document.close(); }
}

function ItemsEditor({ items, onChange }: { items: QItem[]; onChange: (items: QItem[]) => void }) {
  const [search, setSearch] = useState("");
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => fetchJSON(`${BASE}/products`),
  });

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || "").includes(search)
  ).slice(0, 8);

  const addItem = (p: Product) => {
    const existing = items.findIndex(i => i.productId === p.id);
    if (existing >= 0) {
      const updated = [...items];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
      onChange(updated);
    } else {
      onChange([...items, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price }]);
    }
    setSearch("");
  };

  const addCustomItem = () => {
    onChange([...items, { productId: null, productName: "منتج / خدمة", quantity: 1, unitPrice: 0 }]);
  };

  const updateItem = (idx: number, field: keyof QItem, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="ابحث عن منتج بالاسم أو الباركود..." value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && filtered.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-50 bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {filtered.map(p => (
                <button key={p.id} type="button" onClick={() => addItem(p)}
                  className="w-full flex justify-between items-center px-3 py-2 hover:bg-muted text-sm text-right">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.price.toFixed(2)} ج.م</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCustomItem}>
          <Plus className="h-4 w-4 ml-1" />بند يدوي
        </Button>
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج / الخدمة</TableHead>
                <TableHead className="w-24">الكمية</TableHead>
                <TableHead className="w-32">السعر (ج.م)</TableHead>
                <TableHead className="w-28 text-left">المجموع</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input value={item.productName} onChange={e => updateItem(idx, "productName", e.target.value)} className="h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0.001" step="0.001" value={item.quantity}
                      onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" step="0.01" value={item.unitPrice}
                      onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="h-8 w-28 text-sm" />
                  </TableCell>
                  <TableCell className="text-left font-bold text-sm">
                    {(item.quantity * item.unitPrice).toFixed(2)} ج.م
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function QuotationForm({ quotation, onClose }: { quotation?: Quotation; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => fetchJSON(`${BASE}/customers`),
  });

  const [items, setItems] = useState<QItem[]>(quotation?.items || []);
  const [formData, setFormData] = useState({
    customerId: quotation?.customerId?.toString() || "",
    discount: quotation?.discount?.toString() || "0",
    tax: quotation?.tax?.toString() || "0",
    notes: quotation?.notes || "",
    validUntil: quotation?.validUntil || "",
  });

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = parseFloat(formData.discount) || 0;
  const tax = parseFloat(formData.tax) || 0;
  const total = subtotal - discount + tax;

  const saveMutation = useMutation({
    mutationFn: (data: any) => fetchJSON(
      quotation ? `${BASE}/quotations/${quotation.id}` : `${BASE}/quotations`,
      { method: quotation ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
    ),
    onSuccess: () => {
      toast({ title: quotation ? "تم تحديث عرض السعر" : "تم إنشاء عرض السعر" });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      onClose();
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast({ title: "أضف منتجاً على الأقل", variant: "destructive" }); return; }
    const customer = customers.find(c => c.id === parseInt(formData.customerId));
    saveMutation.mutate({
      customerId: formData.customerId ? parseInt(formData.customerId) : null,
      customerName: customer?.name || null,
      items,
      discount,
      tax,
      notes: formData.notes || null,
      validUntil: formData.validUntil || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>العميل</Label>
          <Select value={formData.customerId} onValueChange={v => setFormData(f => ({ ...f, customerId: v }))}>
            <SelectTrigger><SelectValue placeholder="اختر عميلاً..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون عميل</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>صالح حتى</Label>
          <Input type="date" value={formData.validUntil} onChange={e => setFormData(f => ({ ...f, validUntil: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>المنتجات والخدمات</Label>
        <ItemsEditor items={items} onChange={setItems} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>الخصم (ج.م)</Label>
          <Input type="number" min="0" step="0.01" value={formData.discount}
            onChange={e => setFormData(f => ({ ...f, discount: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>الضريبة (ج.م)</Label>
          <Input type="number" min="0" step="0.01" value={formData.tax}
            onChange={e => setFormData(f => ({ ...f, tax: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>الإجمالي</Label>
          <div className="h-10 flex items-center px-3 bg-muted rounded-md font-bold text-lg">{total.toFixed(2)} ج.م</div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>ملاحظات</Label>
        <Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
          placeholder="شروط وأحكام، ملاحظات إضافية..." rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "جاري الحفظ..." : (quotation ? "حفظ التعديلات" : "إنشاء عرض السعر")}
        </Button>
      </div>
    </form>
  );
}

function QuotationDetail({ quotation, onEdit, onClose }: { quotation: Quotation; onEdit: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetInvoiceSettings();
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: full, isLoading } = useQuery<Quotation>({
    queryKey: ["quotations", quotation.id],
    queryFn: () => fetchJSON(`${BASE}/quotations/${quotation.id}`),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => fetchJSON(`${BASE}/quotations/${quotation.id}/status`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotations"] }); },
  });

  const convertMutation = useMutation({
    mutationFn: () => fetchJSON(`${BASE}/quotations/${quotation.id}/convert`, { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: `تم التحويل إلى فاتورة ${data.invoiceNumber}` });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      onClose();
    },
    onError: () => toast({ title: "حدث خطأ أثناء التحويل", variant: "destructive" }),
  });

  if (isLoading || !full) return <div className="p-8 text-center">جاري التحميل...</div>;

  const primaryColor = (settings as any)?.primaryColor || "#1e40af";

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start pb-4 border-b-2" style={{ borderColor: primaryColor }}>
        <div>
          <h2 className="text-xl font-bold" style={{ color: primaryColor }}>عرض سعر #{full.quotationNumber}</h2>
          <p className="text-sm text-muted-foreground">{format(new Date(full.createdAt), 'yyyy/MM/dd HH:mm')}</p>
          <StatusBadge status={full.status} />
        </div>
        <div className="text-left space-y-1">
          <p className="font-bold">{full.customerName || "—"}</p>
          {full.validUntil && (
            <p className="text-sm text-muted-foreground">
              صالح حتى: {format(new Date(full.validUntil), 'yyyy/MM/dd')}
            </p>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المنتج / الخدمة</TableHead>
            <TableHead>الكمية</TableHead>
            <TableHead>السعر</TableHead>
            <TableHead className="text-left">المجموع</TableHead>
            <TableHead className="text-left text-green-700">الربح 🔒</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {full.items?.map((item, idx) => {
            const product = (products as Product[]).find(p => p.id === item.productId);
            const cost = product?.costPrice ?? 0;
            const itemProfit = (item.unitPrice - cost) * item.quantity;
            return (
              <TableRow key={idx}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{Number(item.unitPrice).toFixed(2)} ج.م</TableCell>
                <TableCell className="text-left font-bold">{(item.quantity * item.unitPrice).toFixed(2)} ج.م</TableCell>
                <TableCell className={`text-left font-bold text-sm ${cost > 0 ? (itemProfit >= 0 ? "text-green-700" : "text-red-600") : "text-muted-foreground"}`}>
                  {cost > 0 ? `${itemProfit.toFixed(2)} ج.م` : <span className="text-xs">—</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex justify-end pt-2 border-t gap-4 flex-wrap">
        {(() => {
          const items = full.items ?? [];
          const totalCost = items.reduce((s, item) => {
            const product = (products as Product[]).find(p => p.id === item.productId);
            return s + ((product?.costPrice ?? 0) * item.quantity);
          }, 0);
          const hasAnyCost = items.some(item => {
            const product = (products as Product[]).find(p => p.id === item.productId);
            return (product?.costPrice ?? 0) > 0;
          });
          const grossProfit = full.total - totalCost - full.discount;
          const margin = full.total > 0 ? (grossProfit / full.total) * 100 : 0;
          return hasAnyCost ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm space-y-1 min-w-52">
              <div className="font-semibold text-green-800 flex items-center gap-1 mb-1">🔒 الربح المتوقع (داخلي)</div>
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي التكلفة:</span><span>{totalCost.toFixed(2)} ج.م</span></div>
              <div className="flex justify-between font-bold text-green-700"><span>صافي الربح:</span><span>{grossProfit.toFixed(2)} ج.م</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>هامش الربح:</span><span>{margin.toFixed(1)}%</span></div>
            </div>
          ) : null;
        })()}
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع الفرعي:</span><span>{full.subtotal.toFixed(2)} ج.م</span></div>
          {full.discount > 0 && <div className="flex justify-between text-sm text-destructive"><span>الخصم:</span><span>-{full.discount.toFixed(2)} ج.م</span></div>}
          {full.tax > 0 && <div className="flex justify-between text-sm"><span>الضريبة:</span><span>+{full.tax.toFixed(2)} ج.م</span></div>}
          <div className="flex justify-between text-lg font-bold border-t pt-1"><span>الإجمالي:</span><span>{full.total.toFixed(2)} ج.م</span></div>
        </div>
      </div>

      {full.notes && (
        <div className="bg-muted/50 rounded p-3 text-sm text-muted-foreground">
          <strong>ملاحظات:</strong> {full.notes}
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {full.status !== "converted" && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 ml-1" />تعديل
            </Button>
          )}
          {full.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => statusMutation.mutate("sent")}>
              إرسال للعميل
            </Button>
          )}
          {full.status === "sent" && (
            <>
              <Button variant="outline" size="sm" className="text-green-600 border-green-500"
                onClick={() => statusMutation.mutate("accepted")}>قبول</Button>
              <Button variant="outline" size="sm" className="text-destructive border-destructive"
                onClick={() => statusMutation.mutate("rejected")}>رفض</Button>
            </>
          )}
          {full.status === "accepted" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
              onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
              <FileCheck className="h-4 w-4" />
              {convertMutation.isPending ? "جاري التحويل..." : "تحويل إلى فاتورة"}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => printQuotationA4(full, settings)} className="gap-1">
            <Printer className="h-4 w-4" />طباعة
          </Button>
          <Button size="sm" disabled={pdfLoading} className="gap-1"
            onClick={async () => {
              setPdfLoading(true);
              try { await downloadQuotationPDF(full, settings); }
              finally { setPdfLoading(false); }
            }}>
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfLoading ? "جاري التحضير..." : "تحميل PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type DialogMode = "view" | "create" | "edit";

export default function Quotations() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["quotations"],
    queryFn: () => fetchJSON(`${BASE}/quotations`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchJSON(`${BASE}/quotations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "تم حذف عرض السعر" });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
  });

  const selected = quotations.find(q => q.id === selectedId);

  const filtered = quotations.filter(q => {
    const matchSearch =
      q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
      (q.customerName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف عرض السعر هذا؟")) deleteMutation.mutate(id);
  };

  const handleExcel = () => {
    exportToExcel(filtered.map(q => ({
      "رقم العرض": q.quotationNumber,
      "العميل": q.customerName || "—",
      "الإجمالي": q.total,
      "الحالة": STATUS_LABELS[q.status] || q.status,
      "صالح حتى": q.validUntil ? format(new Date(q.validUntil), 'yyyy/MM/dd') : "—",
      "التاريخ": format(new Date(q.createdAt), 'yyyy/MM/dd'),
    })), "عروض_الاسعار");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">عروض الأسعار</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExcel}>
            <Download className="h-4 w-4 ml-1" />Excel
          </Button>
          <Button onClick={() => { setSelectedId(null); setDialogMode("create"); }}>
            <Plus className="h-4 w-4 ml-1" />عرض سعر جديد
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pr-9" placeholder="بحث برقم العرض أو اسم العميل..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العرض</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>صالح حتى</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد عروض أسعار</TableCell></TableRow>
              ) : (
                filtered.map(q => (
                  <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedId(q.id); setDialogMode("view"); }}>
                    <TableCell className="font-mono font-bold text-sm">{q.quotationNumber}</TableCell>
                    <TableCell>{q.customerName || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-bold">{q.total.toFixed(2)} ج.م</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell>{q.validUntil ? format(new Date(q.validUntil), 'yyyy/MM/dd') : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(q.createdAt), 'yyyy/MM/dd')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setSelectedId(q.id); setDialogMode("view"); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setSelectedId(q.id); setDialogMode("edit"); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(q.id)}>
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={dialogMode === "view"} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>عرض سعر</DialogTitle></DialogHeader>
          {selected && dialogMode === "view" && (
            <QuotationDetail
              quotation={selected}
              onEdit={() => setDialogMode("edit")}
              onClose={() => setDialogMode(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "create"} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>عرض سعر جديد</DialogTitle></DialogHeader>
          {dialogMode === "create" && <QuotationForm onClose={() => setDialogMode(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "edit" && !!selected} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>تعديل عرض السعر</DialogTitle></DialogHeader>
          {dialogMode === "edit" && selected && (
            <QuotationFormWithItems key={selected.id} quotation={selected} onClose={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuotationFormWithItems({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const { data: full, isLoading } = useQuery<Quotation>({
    queryKey: ["quotations", quotation.id],
    queryFn: () => fetchJSON(`${BASE}/quotations/${quotation.id}`),
  });
  if (isLoading || !full) return <div className="p-8 text-center">جاري التحميل...</div>;
  return <QuotationForm quotation={full} onClose={onClose} />;
}
