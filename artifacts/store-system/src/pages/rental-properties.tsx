import { jsonOrThrow } from "@/lib/http";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Download, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/excel";
import { format } from "date-fns";

type Account = { id: number; name: string };
type RentalPayment = {
  id: number;
  propertyName: string;
  tenantName: string;
  amount: number;
  period: string;
  date: string;
  accountId: number | null;
  notes: string | null;
};

const fetchRental = () => fetch("/api/rental", { credentials: "include" }).then(jsonOrThrow);
const fetchAccounts = () => fetch("/api/accounts", { credentials: "include" }).then(jsonOrThrow);

const emptyForm = () => ({
  propertyName: "", tenantName: "", amount: "", period: "",
  date: format(new Date(), "yyyy-MM-dd"), accountId: "", notes: "",
});

export default function RentalProperties() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RentalPayment | null>(null);
  const [form, setForm] = useState(emptyForm());
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payments = [], isLoading } = useQuery<RentalPayment[]>({ queryKey: ["rental"], queryFn: fetchRental });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: fetchAccounts });

  const totalIncome = payments.reduce((s, p) => s + p.amount, 0);

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm(), accountId: accounts[0] ? String(accounts[0].id) : "" }); setOpen(true); };
  const openEdit = (p: RentalPayment) => {
    setEditing(p);
    setForm({ propertyName: p.propertyName, tenantName: p.tenantName, amount: String(p.amount), period: p.period, date: p.date, accountId: p.accountId ? String(p.accountId) : "", notes: p.notes ?? "" });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.propertyName || !form.tenantName || !form.amount || !form.period || !form.date) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" }); return;
    }
    const body = { propertyName: form.propertyName, tenantName: form.tenantName, amount: parseFloat(form.amount), period: form.period, date: form.date, accountId: form.accountId ? Number(form.accountId) : null, notes: form.notes || null };
    const url = editing ? `/api/rental/${editing.id}` : "/api/rental";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: editing ? "تم تحديث سجل الإيجار" : "تم تسجيل إيجار جديد" });
    qc.invalidateQueries({ queryKey: ["rental"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    setOpen(false);
  };

  const handleDelete = async (p: RentalPayment) => {
    if (!confirm(`حذف إيجار "${p.propertyName}"؟`)) return;
    await fetch(`/api/rental/${p.id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "تم الحذف" });
    qc.invalidateQueries({ queryKey: ["rental"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  const accountName = (id: number | null) => accounts.find(a => a.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إيجار الممتلكات</h1>
            <p className="text-sm text-muted-foreground">تسجيل دخل الإيجارات وتتبع المستأجرين</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => exportToExcel(payments.map(p => ({ "العقار": p.propertyName, "المستأجر": p.tenantName, "المبلغ": p.amount, "الفترة": p.period, "التاريخ": p.date, "الحساب": accountName(p.accountId), "ملاحظات": p.notes ?? "" })), "rental-income")}>
            <Download className="h-4 w-4" /> تصدير
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> تسجيل إيجار
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">إجمالي دخل الإيجار</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{totalIncome.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">عدد السجلات</p>
            <p className="text-2xl font-bold mt-1">{payments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">عدد العقارات</p>
            <p className="text-2xl font-bold mt-1">{new Set(payments.map(p => p.propertyName)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العقار / الوحدة</TableHead>
                <TableHead className="text-right">المستأجر</TableHead>
                <TableHead className="text-right">الفترة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الحساب</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">لا توجد سجلات إيجار بعد</TableCell></TableRow>
              ) : payments.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.propertyName}</TableCell>
                  <TableCell>{p.tenantName}</TableCell>
                  <TableCell>{p.period}</TableCell>
                  <TableCell className="font-medium text-green-600">{p.amount.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>{accountName(p.accountId)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.notes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل سجل الإيجار" : "تسجيل إيجار جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>العقار / الوحدة *</Label>
                <Input placeholder="مثال: شقة A1" value={form.propertyName} onChange={e => setForm(f => ({ ...f, propertyName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>اسم المستأجر *</Label>
                <Input placeholder="اسم المستأجر" value={form.tenantName} onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>المبلغ *</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>الفترة *</Label>
                <Input placeholder="مثال: يناير 2024" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>تاريخ الاستلام *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>الحساب / الخزينة</Label>
                <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input placeholder="أي ملاحظات إضافية..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1">{editing ? "حفظ التعديلات" : "تسجيل الإيجار"}</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
