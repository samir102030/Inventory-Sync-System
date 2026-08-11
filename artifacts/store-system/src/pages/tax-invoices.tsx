import { jsonOrThrow } from "@/lib/http";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, Printer, Search, CalendarRange, X, Building2, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

/* ── types ── */
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
type InvoiceItem = { id: number; productName: string; barcode: string | null; quantity: number; unitPrice: number; discount: number; total: number };
type InvoiceDetail = TaxInvoice & { items: InvoiceItem[]; customerId: number | null; status: string; notes: string | null };
type InvoiceSettings = { companyName: string; companyAddress: string | null; companyPhone: string | null; companyEmail: string | null; companyLogo: string | null; taxRate: number; footerNote: string | null; primaryColor: string };

/* ── helpers ── */
const fmt = (n: number) => n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
const PAY: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل", credit: "آجل" };

/* ── Tax Invoice Print View ── */
function TaxInvoicePrint({ inv, settings, onClose }: { inv: InvoiceDetail; settings: InvoiceSettings; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const taxRate = inv.taxRate || Number(settings.taxRate) || 14;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة ضريبية ${inv.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; color: #111; background: #fff; direction: rtl; }
  @page { size: A4; margin: 16mm; }
  .page { padding: 0; max-width: 780px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid ${settings.primaryColor}; }
  .logo { max-height: 64px; max-width: 160px; object-fit: contain; }
  .company-name { font-size: 22px; font-weight: 800; color: ${settings.primaryColor}; }
  .company-info { font-size: 11px; color: #555; line-height: 1.8; margin-top: 4px; }
  .invoice-badge { background: ${settings.primaryColor}; color: #fff; padding: 6px 18px; border-radius: 6px; font-size: 15px; font-weight: 700; text-align: center; }
  .invoice-num { font-size: 18px; font-weight: 800; color: ${settings.primaryColor}; text-align: center; margin-top: 6px; }
  .invoice-date { font-size: 11px; color: #666; text-align: center; margin-top: 2px; }
  .customer-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-right: 4px solid ${settings.primaryColor}; padding: 12px 16px; margin: 18px 0 14px; border-radius: 6px; }
  .customer-box h3 { font-size: 12px; color: #888; margin-bottom: 4px; font-weight: 500; }
  .customer-box p { font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  thead { background: ${settings.primaryColor}; color: #fff; }
  th { padding: 9px 12px; font-size: 12px; text-align: right; font-weight: 600; }
  td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #eee; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .totals { margin-top: 16px; display: flex; justify-content: flex-start; }
  .totals-table { min-width: 300px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .totals-table td { padding: 8px 14px; font-size: 12.5px; border-bottom: 1px solid #eee; }
  .totals-table tr:last-child td { border-bottom: none; }
  .totals-table .grand { background: ${settings.primaryColor}; color: #fff; font-size: 14px; font-weight: 800; }
  .tax-note { background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 8px 14px; margin-top: 16px; font-size: 11px; color: #795548; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #ccc; font-size: 11px; color: #888; text-align: center; }
</style>
</head>
<body><div class="page">${content}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const subtotalBeforeTax = inv.subtotal / (1 + taxRate / 100);
  const taxAmount = inv.tax;

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-semibold">فاتورة ضريبية — {inv.invoiceNumber}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> طباعة
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Scrollable preview */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div ref={printRef} className="bg-white rounded-xl shadow border max-w-3xl mx-auto p-8" dir="rtl">

          {/* Header */}
          <div className="flex justify-between items-start pb-5 border-b-4" style={{ borderColor: settings.primaryColor }}>
            <div>
              {settings.companyLogo
                ? <img src={settings.companyLogo} alt="logo" className="h-16 w-auto object-contain mb-2" />
                : null}
              <p className="text-2xl font-black" style={{ color: settings.primaryColor }}>{settings.companyName}</p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {settings.companyAddress && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{settings.companyAddress}</p>}
                {settings.companyPhone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{settings.companyPhone}</p>}
                {settings.companyEmail && <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{settings.companyEmail}</p>}
              </div>
            </div>
            <div className="text-center">
              <div className="text-white text-sm font-bold px-5 py-2 rounded-lg" style={{ background: settings.primaryColor }}>
                فاتورة ضريبية
              </div>
              <p className="text-xl font-black mt-2" style={{ color: settings.primaryColor }}>{inv.invoiceNumber}</p>
              <p className="text-xs text-gray-500 mt-1">{fmtDate(inv.createdAt)}</p>
              <p className="text-xs text-gray-500">{PAY[inv.paymentMethod] ?? inv.paymentMethod}</p>
            </div>
          </div>

          {/* Customer */}
          <div className="my-5 bg-gray-50 border border-gray-200 rounded-lg p-4" style={{ borderRightColor: settings.primaryColor, borderRightWidth: 4 }}>
            <p className="text-xs text-gray-400 mb-1">فاتورة إلى</p>
            <p className="font-bold text-base">{inv.customerName ?? "عميل نقدي"}</p>
          </div>

          {/* Items table */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: settings.primaryColor, color: "#fff" }}>
                <th className="text-right py-2.5 px-3 font-semibold rounded-tr-lg">#</th>
                <th className="text-right py-2.5 px-3 font-semibold">الصنف</th>
                <th className="text-right py-2.5 px-3 font-semibold">الكمية</th>
                <th className="text-right py-2.5 px-3 font-semibold">سعر الوحدة (شامل الضريبة)</th>
                <th className="text-right py-2.5 px-3 font-semibold rounded-tl-lg">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{item.productName}</td>
                  <td className="py-2 px-3">{item.quantity}</td>
                  <td className="py-2 px-3">{fmt(item.unitPrice)}</td>
                  <td className="py-2 px-3 font-semibold">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-5 flex justify-start">
            <div className="min-w-72 border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2.5 px-4 text-gray-500">المجموع قبل الضريبة</td>
                    <td className="py-2.5 px-4 font-semibold text-left">{fmt(subtotalBeforeTax)}</td>
                  </tr>
                  {inv.discount > 0 && (
                    <tr className="border-b">
                      <td className="py-2.5 px-4 text-gray-500">الخصم</td>
                      <td className="py-2.5 px-4 font-semibold text-left text-red-500">- {fmt(inv.discount)}</td>
                    </tr>
                  )}
                  <tr className="border-b bg-amber-50">
                    <td className="py-2.5 px-4 text-amber-700 font-medium">ضريبة القيمة المضافة ({taxRate}%)</td>
                    <td className="py-2.5 px-4 font-semibold text-left text-amber-700">{fmt(taxAmount)}</td>
                  </tr>
                  <tr style={{ background: settings.primaryColor }}>
                    <td className="py-3 px-4 font-bold text-white text-base">الإجمالي شامل الضريبة</td>
                    <td className="py-3 px-4 font-black text-white text-base text-left">{fmt(inv.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tax breakdown note */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            <span className="font-bold">إشعار ضريبي: </span>
            المبلغ الخاضع للضريبة = {fmt(subtotalBeforeTax)} — ضريبة القيمة المضافة {taxRate}% = {fmt(taxAmount)}
          </div>

          {/* Footer */}
          {settings.footerNote && (
            <div className="mt-6 pt-4 border-t border-dashed text-center text-xs text-gray-400">{settings.footerNote}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function TaxInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: firstOfMonth, to: today });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ invoices: TaxInvoice[]; totalTax: number; totalSubtotal: number; totalAmount: number; count: number }>({
    queryKey: ["tax-invoices", applied.from, applied.to],
    queryFn: () => fetch(`/api/invoices/tax-ledger?from=${applied.from}&to=${applied.to}`, { credentials: "include" }).then(jsonOrThrow),
  });

  const { data: detail } = useQuery<InvoiceDetail>({
    queryKey: ["invoice-detail", selectedId],
    queryFn: () => fetch(`/api/invoices/${selectedId}`, { credentials: "include" }).then(jsonOrThrow),
    enabled: selectedId != null,
  });

  const { data: settings } = useQuery<InvoiceSettings>({
    queryKey: ["invoice-settings"],
    queryFn: () => fetch("/api/settings/invoice", { credentials: "include" }).then(jsonOrThrow),
  });

  const invoices = (data?.invoices ?? []).filter(inv =>
    !search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || (inv.customerName ?? "").includes(search)
  );

  const defaultSettings: InvoiceSettings = {
    companyName: "شركتي", companyAddress: null, companyPhone: null, companyEmail: null,
    companyLogo: null, taxRate: 14, footerNote: null, primaryColor: "#1e40af",
  };
  const s = settings ?? defaultSettings;

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <FileText className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الفواتير الضريبية</h1>
            <p className="text-sm text-muted-foreground">الفواتير التي تشمل ضريبة القيمة المضافة</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">من</span>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
              <span className="text-sm font-medium">إلى</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
              <Button size="sm" onClick={() => setApplied({ from, to })}>تطبيق</Button>
            </div>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالرقم أو اسم العميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">عدد الفواتير الضريبية</p>
          <p className="text-2xl font-bold mt-1">{data?.count ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">إجمالي الضريبة</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(data?.totalTax ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">إجمالي المبيعات الخاضعة</p>
          <p className="text-2xl font-bold mt-1">{fmt(data?.totalAmount ?? 0)}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">رقم الفاتورة</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">قبل الضريبة</TableHead>
                <TableHead className="text-right">الضريبة</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">نسبة الضريبة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">لا توجد فواتير ضريبية في هذه الفترة</TableCell></TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedId(inv.id)}>
                  <TableCell className="font-mono font-semibold text-primary">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.customerName ?? <span className="text-muted-foreground">عميل نقدي</span>}</TableCell>
                  <TableCell>{fmt(inv.subtotal - inv.discount)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">{fmt(inv.tax)}</Badge>
                  </TableCell>
                  <TableCell className="font-bold">{fmt(inv.total)}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.taxRate}%</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmtDate(inv.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                      <Printer className="h-3.5 w-3.5" /> عرض وطباعة
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail / Print dialog */}
      <Dialog open={selectedId != null && detail != null} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-4xl p-0 gap-0 max-h-[92vh] overflow-hidden" dir="rtl">
          {detail && (
            <TaxInvoicePrint
              inv={{ ...detail, taxRate: detail.taxRate || Number(s.taxRate) || 14 }}
              settings={s}
              onClose={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
