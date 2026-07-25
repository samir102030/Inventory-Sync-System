import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Download, Upload, Building } from "lucide-react";
import { parseExcelFile } from "@/lib/excel";
import * as XLSX from "@e965/xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Bank {
  id: number;
  name: string;
  accountNumber?: string;
  accountName?: string;
  branch?: string;
  balance: number;
  notes?: string;
  createdAt: string;
}

interface BankForm {
  name: string;
  accountNumber: string;
  accountName: string;
  branch: string;
  balance: string;
  notes: string;
}

const empty: BankForm = { name: "", accountNumber: "", accountName: "", branch: "", balance: "0", notes: "" };

async function fetchBanks(search = ""): Promise<Bank[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const r = await fetch(`${BASE}/api/banks${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("فشل تحميل البنوك");
  return r.json();
}

export default function Banks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BankForm>(empty);
  const [importOpen, setImportOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["banks", search],
    queryFn: () => fetchBanks(search),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["banks"] });

  const saveMutation = useMutation({
    mutationFn: async (data: BankForm) => {
      const url = editId ? `${BASE}/api/banks/${editId}` : `${BASE}/api/banks`;
      const method = editId ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, balance: Number(data.balance) || 0 }),
      });
      if (!r.ok) throw new Error("فشل الحفظ");
      return r.json();
    },
    onSuccess: () => { invalidate(); setOpen(false); toast({ title: editId ? "تم التعديل" : "تمت الإضافة" }); },
    onError: () => toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}/api/banks/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => { invalidate(); toast({ title: "تم الحذف" }); },
  });

  const importMutation = useMutation({
    mutationFn: async (banks: object[]) => {
      const r = await fetch(`${BASE}/api/banks/bulk-import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banks }),
      });
      if (!r.ok) throw new Error("فشل الاستيراد");
      return r.json();
    },
    onSuccess: (data) => {
      invalidate();
      setMappingOpen(false);
      setImportOpen(false);
      toast({ title: `تم الاستيراد: ${data.created} بنك${data.skipped ? ` (تخطي ${data.skipped})` : ""}` });
    },
    onError: () => toast({ title: "خطأ", description: "فشل الاستيراد", variant: "destructive" }),
  });

  function openAdd() { setEditId(null); setForm(empty); setOpen(true); }
  function openEdit(b: Bank) {
    setEditId(b.id);
    setForm({
      name: b.name,
      accountNumber: b.accountNumber || "",
      accountName: b.accountName || "",
      branch: b.branch || "",
      balance: String(b.balance),
      notes: b.notes || "",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    saveMutation.mutate(form);
  }

  /* ─── Excel template download ─── */
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اسم البنك", "رقم الحساب", "اسم الحساب", "الفرع", "الرصيد", "ملاحظات"],
      ["بنك مصر", "1234567890", "شركة المثال", "فرع وسط البلد", "50000", ""],
      ["البنك الأهلي", "0987654321", "أحمد محمد", "فرع المعادي", "0", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "البنوك");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "نموذج_البنوك.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── File upload & column mapping ─── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const { headers, rows } = await parseExcelFile(file);
      setExcelHeaders(headers);
      setExcelRows(rows);
      const fields = ["name", "accountNumber", "accountName", "branch", "balance", "notes"];
      const autoMap: Record<string, string> = {};
      fields.forEach(f => {
        const match = headers.find(h => {
          const lower = h.toLowerCase();
          if (f === "name") return /اسم البنك|اسم|name/i.test(h);
          if (f === "accountNumber") return /رقم الحساب|رقم|account.?number/i.test(h);
          if (f === "accountName") return /اسم الحساب|account.?name/i.test(h);
          if (f === "branch") return /فرع|branch/i.test(h);
          if (f === "balance") return /رصيد|balance/i.test(h);
          if (f === "notes") return /ملاحظات|notes/i.test(h);
          return false;
        });
        if (match) autoMap[f] = match;
      });
      setMapping(autoMap);
      setImportOpen(false);
      setMappingOpen(true);
    } catch {
      toast({ title: "خطأ", description: "تعذر قراءة الملف", variant: "destructive" });
    }
  }

  function confirmImport() {
    if (!mapping.name) { toast({ title: "يجب تحديد عمود اسم البنك", variant: "destructive" }); return; }
    const banks = excelRows.map(row => ({
      name: row[mapping.name] || "",
      accountNumber: mapping.accountNumber ? row[mapping.accountNumber] : undefined,
      accountName: mapping.accountName ? row[mapping.accountName] : undefined,
      branch: mapping.branch ? row[mapping.branch] : undefined,
      balance: mapping.balance ? Number(row[mapping.balance]) || 0 : 0,
      notes: mapping.notes ? row[mapping.notes] : undefined,
    }));
    importMutation.mutate(banks);
  }

  const fieldLabels: Record<string, string> = {
    name: "اسم البنك *",
    accountNumber: "رقم الحساب",
    accountName: "اسم الحساب",
    branch: "الفرع",
    balance: "الرصيد",
    notes: "ملاحظات",
  };

  const totalBalance = banks.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">البنوك</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 ml-1" /> تحميل نموذج
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 ml-1" /> استيراد Excel
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 ml-1" /> إضافة بنك
          </Button>
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border bg-primary/5 p-4 flex items-center gap-4 w-fit">
        <Building className="h-8 w-8 text-primary" />
        <div>
          <p className="text-sm text-muted-foreground">إجمالي الأرصدة</p>
          <p className="text-2xl font-bold text-primary">{totalBalance.toLocaleString("ar-EG")} ج.م</p>
        </div>
        <div className="mr-6 border-r pr-6">
          <p className="text-sm text-muted-foreground">عدد البنوك</p>
          <p className="text-2xl font-bold">{banks.length}</p>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="بحث باسم البنك..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">اسم البنك</TableHead>
              <TableHead className="text-right">رقم الحساب</TableHead>
              <TableHead className="text-right">اسم الحساب</TableHead>
              <TableHead className="text-right">الفرع</TableHead>
              <TableHead className="text-right">الرصيد</TableHead>
              <TableHead className="text-right">ملاحظات</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
            ) : banks.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد بنوك</TableCell></TableRow>
            ) : banks.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.accountNumber || "—"}</TableCell>
                <TableCell>{b.accountName || "—"}</TableCell>
                <TableCell>{b.branch || "—"}</TableCell>
                <TableCell className={b.balance >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {b.balance.toLocaleString("ar-EG")} ج.م
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{b.notes || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { if (confirm(`حذف ${b.name}؟`)) deleteMutation.mutate(b.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editId ? "تعديل البنك" : "إضافة بنك جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { key: "name", label: "اسم البنك *", placeholder: "بنك مصر" },
              { key: "accountNumber", label: "رقم الحساب", placeholder: "1234567890" },
              { key: "accountName", label: "اسم الحساب", placeholder: "اسم صاحب الحساب" },
              { key: "branch", label: "الفرع", placeholder: "فرع المعادي" },
              { key: "balance", label: "الرصيد", placeholder: "0" },
              { key: "notes", label: "ملاحظات", placeholder: "" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  value={form[key as keyof BankForm]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  type={key === "balance" ? "number" : "text"}
                  required={key === "name"}
                />
              </div>
            ))}
            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import file picker */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>استيراد البنوك من Excel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اختر ملف Excel يحتوي على بيانات البنوك. يمكنك أولاً تحميل النموذج للتعرف على الأعمدة المطلوبة.</p>
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="h-4 w-4 ml-2" /> تحميل النموذج أولاً
            </Button>
            <Button className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 ml-2" /> اختيار ملف Excel
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Column mapping dialog */}
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>ربط الأعمدة ({excelRows.length} صف)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">حدد الأعمدة في الملف المقابلة لكل حقل.</p>
            {Object.keys(fieldLabels).map(f => (
              <div key={f} className="flex items-center gap-3">
                <Label className="w-32 shrink-0 text-sm">{fieldLabels[f]}</Label>
                <select
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-background"
                  value={mapping[f] || ""}
                  onChange={e => setMapping(m => ({ ...m, [f]: e.target.value }))}
                >
                  <option value="">— تجاهل —</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            {excelRows.length > 0 && (
              <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground mb-1">معاينة أول صف:</p>
                {Object.entries(mapping).filter(([, v]) => v).map(([f, col]) => (
                  <p key={f}><span className="text-muted-foreground">{fieldLabels[f]}: </span>{excelRows[0]?.[col] ?? "—"}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setMappingOpen(false); setImportOpen(true); }}>رجوع</Button>
            <Button onClick={confirmImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? "جاري الاستيراد..." : `استيراد ${excelRows.length} صف`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
