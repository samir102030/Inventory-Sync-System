import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Edit, Trash2, Download, Upload } from "lucide-react";
import { exportToExcel, parseExcelFile } from "@/lib/excel";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  openingBalance?: number;
  createdAt: string;
};

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", whatsapp: "", address: "", taxNumber: "", notes: "", openingBalance: "" });

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();
  const qKey = ["suppliers", search];

  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: qKey,
    queryFn: () => fetchJSON(search ? `${BASE}/suppliers?search=${encodeURIComponent(search)}` : `${BASE}/suppliers`),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/suppliers`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم إضافة المورد" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); setIsDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetch(`${BASE}/suppliers/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تحديث المورد" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["supplier-balances"] }); setIsDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/suppliers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف المورد" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
  });

  const handleOpenDialog = (s?: Supplier) => {
    if (s) {
      setEditingSupplier(s);
      setFormData({ name: s.name, phone: s.phone || "", whatsapp: s.whatsapp || "", address: s.address || "", taxNumber: s.taxNumber || "", notes: s.notes || "", openingBalance: s.openingBalance ? String(s.openingBalance) : "" });
    } else {
      setEditingSupplier(null);
      setFormData({ name: "", phone: "", whatsapp: "", address: "", taxNumber: "", notes: "", openingBalance: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      phone: formData.phone || undefined,
      whatsapp: formData.whatsapp || undefined,
      address: formData.address || undefined,
      taxNumber: formData.taxNumber || undefined,
      notes: formData.notes || undefined,
      openingBalance: formData.openingBalance ? Number(formData.openingBalance) : 0,
    };
    if (editingSupplier) updateMutation.mutate({ id: editingSupplier.id, data });
    else createMutation.mutate(data);
  };

  const handleExport = () => {
    const rows = (suppliers ?? []).map(s => [s.name, s.phone ?? "", s.whatsapp ?? "", s.address ?? "", s.taxNumber ?? "", s.openingBalance ?? 0, s.notes ?? ""]);
    exportToExcel(["الاسم", "الهاتف", "واتساب", "العنوان", "الرقم الضريبي", "الرصيد الافتتاحي", "ملاحظات"], rows, "suppliers", "الموردون");
  };

  // ---------- Import ----------
  const FIELD_LABELS: Record<string, string> = {
    name: "الاسم *", phone: "الهاتف", whatsapp: "واتساب",
    address: "العنوان", taxNumber: "الرقم الضريبي",
    openingBalance: "الرصيد الافتتاحي (ما يُستحق لهم)",
  };

  const autoDetect = (headers: string[]): Record<string, string> => {
    const map: Record<string, string> = {};
    const patterns: Record<string, RegExp> = {
      name: /اسم|name/i,
      phone: /هاتف|تليفون|phone|tel|mob/i,
      whatsapp: /whatsapp|واتس/i,
      address: /عنوان|address/i,
      taxNumber: /ضريب|tax/i,
      openingBalance: /رصيد|balance|مبلغ|حساب/i,
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
    const suppliersData = importRows
      .filter(r => r[importHeaders.indexOf(importMapping.name)]?.trim())
      .map(r => {
        const get = (f: string) => f && importMapping[f] ? r[importHeaders.indexOf(importMapping[f])]?.trim() || "" : "";
        const balRaw = get("openingBalance");
        return {
          name: get("name"),
          phone: get("phone"),
          whatsapp: get("whatsapp"),
          address: get("address"),
          taxNumber: get("taxNumber"),
          openingBalance: balRaw ? Number(balRaw.replace(/,/g, "")) : 0,
        };
      });
    try {
      const res = await fetch(`${BASE}/suppliers/bulk-import`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers: suppliersData }),
      });
      const data = await res.json();
      toast({ title: `تم استيراد ${data.created} مورد${data.skipped ? `، تم تجاهل ${data.skipped}` : ""}` });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["supplier-balances"] });
      setImportOpen(false);
    } catch { toast({ title: "حدث خطأ أثناء الاستيراد", variant: "destructive" }); }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الموردون</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="text-blue-600 border-blue-400 hover:bg-blue-50">
            <Upload className="h-4 w-4 ml-2" />استيراد من Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4 ml-2" />إضافة مورد</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث عن مورد..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>واتساب</TableHead>
                <TableHead>الرقم الضريبي</TableHead>
                <TableHead>الرصيد الافتتاحي</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : suppliers?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا يوجد موردون</TableCell></TableRow>
              ) : suppliers?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{s.phone || "-"}</TableCell>
                  <TableCell dir="ltr" className="text-right">{s.whatsapp || "-"}</TableCell>
                  <TableCell>{s.taxNumber || "-"}</TableCell>
                  <TableCell className={s.openingBalance && s.openingBalance > 0 ? "font-bold text-orange-600" : "text-muted-foreground"}>
                    {s.openingBalance && s.openingBalance > 0 ? `${Number(s.openingBalance).toFixed(2)} ج.م` : "-"}
                  </TableCell>
                  <TableCell>{s.address || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(s)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("حذف المورد؟")) deleteMutation.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingSupplier ? "تعديل مورد" : "إضافة مورد جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2"><Label>الاسم *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} dir="ltr" className="text-right" /></div>
              <div className="space-y-2"><Label>واتساب</Label><Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} dir="ltr" className="text-right" /></div>
              <div className="space-y-2"><Label>الرقم الضريبي</Label><Input value={formData.taxNumber} onChange={e => setFormData({ ...formData, taxNumber: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>الرصيد الافتتاحي (ج.م)</Label>
                <Input type="number" min="0" step="0.01" value={formData.openingBalance} onChange={e => setFormData({ ...formData, openingBalance: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2"><Label>العنوان</Label><Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>ملاحظات</Label><Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
            </div>
            {formData.openingBalance && Number(formData.openingBalance) > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                ⚡ الرصيد الافتتاحي يعني أن هذا المبلغ مستحق للمورد من قبل بدء استخدام النظام
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600" />استيراد موردين من Excel</DialogTitle>
            <DialogDescription>حدد أي عمود من ملفك يقابل كل حقل — عمود "الرصيد الافتتاحي" مهم لتسجيل ما هو مستحق لهم</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">الأعمدة الموجودة: <span className="font-medium text-foreground">{importHeaders.join("، ")}</span></p>
            <p className="text-sm text-muted-foreground">عدد الصفوف: <span className="font-bold">{importRows.length}</span></p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} className={`space-y-1 ${field === "openingBalance" ? "col-span-2" : ""}`}>
                  <label className={`text-xs font-medium ${field === "openingBalance" ? "text-orange-700" : ""}`}>{label}</label>
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
              {importing ? "جاري الاستيراد..." : `استيراد ${importRows.length} مورد`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
