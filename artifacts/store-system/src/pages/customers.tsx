import { useState, useRef } from "react";
import { useGetCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getGetCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Edit, Trash2, MessageCircle, Send, Download, Upload } from "lucide-react";
import { exportToExcel, parseExcelFile } from "@/lib/excel";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@workspace/api-client-react/src/generated/api.schemas";
import { openWhatsApp, buildCustomMessage, formatPhone } from "@/lib/whatsapp";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", whatsapp: "", email: "", address: "", taxNumber: "" });
  const [bulkMsgOpen, setBulkMsgOpen] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: customers, isLoading } = useGetCustomers({ search }, { query: { queryKey: getGetCustomersQueryKey({ search }) } });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const customersWithWA = customers?.filter(c => !!(c as any).whatsapp) ?? [];

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || "",
        whatsapp: (customer as any).whatsapp || "",
        email: customer.email || "",
        address: customer.address || "",
        taxNumber: (customer as any).taxNumber || "",
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: "", phone: "", whatsapp: "", email: "", address: "", taxNumber: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      phone: formData.phone || undefined,
      whatsapp: formData.whatsapp || undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      taxNumber: formData.taxNumber || undefined,
    } as any;

    if (editingCustomer) {
      updateCustomer.mutate({ id: editingCustomer.id, data }, {
        onSuccess: () => { toast({ title: "تم تحديث العميل" }); queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() }); setIsDialogOpen(false); }
      });
    } else {
      createCustomer.mutate({ data }, {
        onSuccess: () => { toast({ title: "تم إضافة العميل" }); queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() }); setIsDialogOpen(false); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا العميل؟")) {
      deleteCustomer.mutate({ id }, {
        onSuccess: () => { toast({ title: "تم حذف العميل" }); queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() }); }
      });
    }
  };

  const handleQuickWA = (customer: Customer) => {
    const wa = (customer as any).whatsapp || customer.phone;
    if (!wa) { toast({ title: "لا يوجد رقم واتساب لهذا العميل", variant: "destructive" }); return; }
    openWhatsApp(wa, buildCustomMessage(customer.name, ""));
  };

  const handleExport = () => {
    const rows = (customers ?? []).map(c => [
      c.name, c.phone ?? "", (c as any).whatsapp ?? "", c.email ?? "",
      c.address ?? "", (c as any).taxNumber ?? "", c.totalPurchases ?? 0,
    ]);
    exportToExcel(["الاسم","الهاتف","واتساب","الإيميل","العنوان","الرقم الضريبي","إجمالي المشتريات"], rows, "customers", "العملاء");
  };

  const FIELD_LABELS: Record<string, string> = { name: "الاسم *", phone: "الهاتف", whatsapp: "واتساب", email: "الإيميل", address: "العنوان", taxNumber: "الرقم الضريبي" };

  const autoDetect = (headers: string[]): Record<string, string> => {
    const map: Record<string, string> = {};
    const patterns: Record<string, RegExp> = {
      name: /اسم|name/i, phone: /هاتف|تليفون|phone|tel|mob/i,
      whatsapp: /whatsapp|واتس/i, email: /email|mail|بريد/i,
      address: /عنوان|address/i, taxNumber: /ضريب|tax/i,
    };
    for (const [field, re] of Object.entries(patterns)) {
      const h = headers.find(h => re.test(h));
      if (h) map[field] = h;
    }
    return map;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { headers, rows } = await parseExcelFile(file);
      setImportHeaders(headers);
      setImportRows(rows);
      setImportMapping(autoDetect(headers));
      setImportOpen(true);
    } catch { toast({ title: "تعذر قراءة الملف", variant: "destructive" }); }
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!importMapping.name) { toast({ title: "يجب تحديد عمود الاسم", variant: "destructive" }); return; }
    setImporting(true);
    const customers = importRows.filter(r => r[importHeaders.indexOf(importMapping.name)]?.trim()).map(r => {
      const get = (f: string) => f && importMapping[f] ? r[importHeaders.indexOf(importMapping[f])]?.trim() || "" : "";
      return { name: get("name"), phone: get("phone"), whatsapp: get("whatsapp"), email: get("email"), address: get("address"), taxNumber: get("taxNumber") };
    });
    try {
      const res = await fetch("/api/customers/bulk-import", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers }) });
      const data = await res.json();
      toast({ title: `تم استيراد ${data.created} عميل${data.skipped ? `، تم تجاهل ${data.skipped}` : ""}` });
      queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
      setImportOpen(false);
    } catch { toast({ title: "حدث خطأ أثناء الاستيراد", variant: "destructive" }); }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">العملاء</h1>
        <div className="flex gap-2 flex-wrap">
          {customersWithWA.length > 0 && (
            <Button variant="outline" onClick={() => setBulkMsgOpen(true)} className="text-green-600 border-green-500 hover:bg-green-50">
              <MessageCircle className="h-4 w-4 ml-2" />
              رسالة جماعية ({customersWithWA.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="text-blue-600 border-blue-400 hover:bg-blue-50">
            <Upload className="h-4 w-4 ml-2" />استيراد من Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 ml-2" />إضافة عميل</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث عن عميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead>واتساب</TableHead>
                <TableHead>الرقم الضريبي</TableHead>
                <TableHead>إجمالي المشتريات</TableHead>
                <TableHead className="w-[130px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : customers?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">لا يوجد عملاء</TableCell></TableRow>
              ) : customers?.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{customer.phone || "-"}</TableCell>
                  <TableCell dir="ltr" className="text-right">
                    {(customer as any).whatsapp ? (
                      <span className="text-green-600 font-medium">{(customer as any).whatsapp}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>{(customer as any).taxNumber || "-"}</TableCell>
                  <TableCell className="font-bold">{customer.totalPurchases?.toFixed(2) || "0.00"} ج.م</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {((customer as any).whatsapp || customer.phone) && (
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="إرسال واتساب"
                          onClick={() => handleQuickWA(customer)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(customer)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(customer.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "تعديل عميل" : "إضافة عميل جديد"}</DialogTitle>
            <DialogDescription>بيانات العميل — رقم الواتساب مهم لإرسال الفواتير</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>الاسم *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  واتساب
                </Label>
                <Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label>الرقم الضريبي</Label>
                <Input value={formData.taxNumber} onChange={e => setFormData({ ...formData, taxNumber: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>العنوان</Label>
                <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600" />استيراد عملاء من Excel</DialogTitle>
            <DialogDescription>حدد أي عمود من ملفك يقابل كل حقل</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">الأعمدة الموجودة في ملفك: <span className="font-medium text-foreground">{importHeaders.join("، ")}</span></p>
            <p className="text-sm text-muted-foreground">عدد الصفوف: <span className="font-bold">{importRows.length}</span></p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium">{label}</label>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                    value={importMapping[field] ?? ""}
                    onChange={e => setImportMapping(m => ({ ...m, [field]: e.target.value }))}
                  >
                    <option value="">— لا شيء —</option>
                    {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>إلغاء</Button>
            <Button onClick={handleImport} disabled={importing || !importMapping.name} className="bg-blue-600 hover:bg-blue-700">
              {importing ? "جاري الاستيراد..." : `استيراد ${importRows.length} عميل`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk WhatsApp Message Dialog */}
      <Dialog open={bulkMsgOpen} onOpenChange={setBulkMsgOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              رسالة جماعية على واتساب
            </DialogTitle>
            <DialogDescription>اكتب الرسالة وافتح واتساب لكل عميل على حدة بضغطة واحدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>نص الرسالة</Label>
              <Textarea
                value={bulkMsg}
                onChange={e => setBulkMsg(e.target.value)}
                rows={5}
                placeholder="مثال: عروض خاصة هذا الشهر! تواصلوا معنا للاستفادة..."
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 text-sm font-medium">
                العملاء الذين لديهم واتساب ({customersWithWA.length})
              </div>
              <div className="divide-y max-h-64 overflow-auto">
                {customersWithWA.map(customer => (
                  <div key={customer.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground dir-ltr">{(customer as any).whatsapp}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-500 hover:bg-green-50 gap-1"
                      disabled={!bulkMsg.trim()}
                      onClick={() => {
                        const wa = (customer as any).whatsapp;
                        openWhatsApp(wa, buildCustomMessage(customer.name, bulkMsg));
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                      إرسال
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {customersWithWA.length > 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                💡 اضغط "إرسال" لكل عميل على حدة — واتساب بيفتح بالرسالة جاهزة وما عليك غير الإرسال
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
