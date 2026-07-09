import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, DollarSign, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api";
const fetchJSON = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", ...opts }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "خطأ");
    return d;
  });

type Employee = { id: number; name: string; position: string; baseSalary: number; phone?: string | null; hireDate?: string | null; status: string; notes?: string | null; createdAt: string };
type SalaryPayment = { id: number; employeeId: number; amount: number; month: string; accountId?: number | null; notes?: string | null; paidAt: string; createdAt: string };
type Account = { id: number; name: string; balance: number };

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function Employees() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSalaryOpen, setIsSalaryOpen] = useState(false);
  const [salaryEmployee, setSalaryEmployee] = useState<Employee | null>(null);

  const emptyForm = { name: "", position: "", baseSalary: "", phone: "", hireDate: "", status: "active", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const emptySalary = { amount: "", month: currentMonth(), accountId: "", notes: "", paidAt: today() };
  const [salaryForm, setSalaryForm] = useState(emptySalary);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({ queryKey: ["employees"], queryFn: () => fetchJSON(`${BASE}/employees`) });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => fetchJSON(`${BASE}/accounts`) });

  const salaryKey = (id: number) => ["employee-salaries", id];
  const { data: salaries = [] } = useQuery<SalaryPayment[]>({
    queryKey: salaryKey(expandedId!),
    queryFn: () => fetchJSON(`${BASE}/employees/${expandedId}/salaries`),
    enabled: expandedId !== null,
  });

  const createEmp = useMutation({
    mutationFn: (data: object) => fetchJSON(`${BASE}/employees`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "تم إضافة الموظف" }); qc.invalidateQueries({ queryKey: ["employees"] }); setIsFormOpen(false); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateEmp = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetchJSON(`${BASE}/employees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "تم تحديث الموظف" }); qc.invalidateQueries({ queryKey: ["employees"] }); setIsFormOpen(false); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteEmp = useMutation({
    mutationFn: (id: number) => fetchJSON(`${BASE}/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم حذف الموظف" }); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const paySalary = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetchJSON(`${BASE}/employees/${id}/salary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "تم صرف الراتب" });
      qc.invalidateQueries({ queryKey: salaryKey(salaryEmployee!.id) });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setIsSalaryOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteSalary = useMutation({
    mutationFn: ({ empId, id }: { empId: number; id: number }) => fetchJSON(`${BASE}/employees/${empId}/salary/${id}`, { method: "DELETE" }),
    onSuccess: (_d, v) => { toast({ title: "تم حذف صرف الراتب" }); qc.invalidateQueries({ queryKey: salaryKey(v.empId) }); qc.invalidateQueries({ queryKey: ["accounts"] }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => { setEditingEmployee(null); setForm(emptyForm); setIsFormOpen(true); };
  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({ name: emp.name, position: emp.position, baseSalary: String(emp.baseSalary), phone: emp.phone ?? "", hireDate: emp.hireDate ?? "", status: emp.status, notes: emp.notes ?? "" });
    setIsFormOpen(true);
  };
  const openSalary = (emp: Employee) => {
    setSalaryEmployee(emp);
    setSalaryForm({ amount: String(emp.baseSalary), month: currentMonth(), accountId: accounts[0] ? String(accounts[0].id) : "", notes: "", paidAt: today() });
    setIsSalaryOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, position: form.position, baseSalary: parseFloat(form.baseSalary) || 0, phone: form.phone || undefined, hireDate: form.hireDate || undefined, status: form.status, notes: form.notes || undefined };
    if (editingEmployee) updateEmp.mutate({ id: editingEmployee.id, data });
    else createEmp.mutate(data);
  };

  const handleSalary = (e: React.FormEvent) => {
    e.preventDefault();
    paySalary.mutate({ id: salaryEmployee!.id, data: { amount: parseFloat(salaryForm.amount), month: salaryForm.month, accountId: salaryForm.accountId ? parseInt(salaryForm.accountId) : undefined, notes: salaryForm.notes || undefined, paidAt: salaryForm.paidAt } });
  };

  const filtered = employees.filter(emp => !search || emp.name.includes(search) || emp.position.includes(search));
  const totalMonthly = employees.filter(e => e.status === "active").reduce((s, e) => s + e.baseSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الموظفون</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 ml-2" />إضافة موظف</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">إجمالي الموظفين</p><p className="text-2xl font-bold">{employees.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">الموظفون النشطون</p><p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === "active").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">إجمالي الرواتب الشهرية</p><p className="text-2xl font-bold">{totalMonthly.toLocaleString()} ج.م</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث عن موظف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>تاريخ التعيين</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">لا يوجد موظفون</TableCell></TableRow>
              ) : filtered.map(emp => (
                <>
                  <TableRow key={emp.id} className={expandedId === emp.id ? "bg-muted/30" : ""}>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}>
                        {expandedId === emp.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.position || "—"}</TableCell>
                    <TableCell className="font-bold">{emp.baseSalary.toLocaleString()} ج.م</TableCell>
                    <TableCell>{emp.phone || "—"}</TableCell>
                    <TableCell>{emp.hireDate || "—"}</TableCell>
                    <TableCell>
                      {emp.status === "active"
                        ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">نشط</Badge>
                        : <Badge variant="secondary">غير نشط</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="default" size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openSalary(emp)}>
                          <DollarSign className="h-3 w-3" />صرف راتب
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(emp)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("حذف الموظف وكل سجلات رواتبه؟")) deleteEmp.mutate(emp.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === emp.id && (
                    <TableRow key={`${emp.id}-expand`}>
                      <TableCell colSpan={8} className="bg-muted/20 p-4">
                        <p className="text-sm font-semibold mb-2">سجل الرواتب</p>
                        {salaries.length === 0 ? (
                          <p className="text-sm text-muted-foreground">لا توجد رواتب مسجلة</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead><tr className="text-right text-muted-foreground"><th className="pb-1 font-medium">الشهر</th><th className="pb-1 font-medium">المبلغ</th><th className="pb-1 font-medium">تاريخ الصرف</th><th className="pb-1 font-medium">ملاحظات</th><th></th></tr></thead>
                            <tbody>
                              {salaries.map(p => (
                                <tr key={p.id} className="border-t">
                                  <td className="py-1">{p.month}</td>
                                  <td className="py-1 font-bold">{p.amount.toLocaleString()} ج.م</td>
                                  <td className="py-1">{p.paidAt}</td>
                                  <td className="py-1 text-muted-foreground">{p.notes || "—"}</td>
                                  <td className="py-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("حذف صرف الراتب؟")) deleteSalary.mutate({ empId: emp.id, id: p.id }); }}><Trash2 className="h-3 w-3" /></Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingEmployee ? "تعديل موظف" : "إضافة موظف جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>الوظيفة</Label>
                <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="مثال: محاسب، فني..." />
              </div>
              <div className="space-y-2">
                <Label>الراتب الأساسي (ج.م)</Label>
                <Input type="number" step="0.01" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ التعيين</Label>
                <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createEmp.isPending || updateEmp.isPending}>{editingEmployee ? "حفظ التعديلات" : "إضافة"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay Salary Dialog */}
      <Dialog open={isSalaryOpen} onOpenChange={setIsSalaryOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>صرف راتب — {salaryEmployee?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleSalary} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ج.م) *</Label>
                <Input type="number" step="0.01" value={salaryForm.amount} onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>الشهر *</Label>
                <Input type="month" value={salaryForm.month} onChange={e => setSalaryForm({ ...salaryForm, month: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الصرف *</Label>
                <Input type="date" value={salaryForm.paidAt} onChange={e => setSalaryForm({ ...salaryForm, paidAt: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>الخصم من الخزنة</Label>
                <Select value={salaryForm.accountId} onValueChange={v => setSalaryForm({ ...salaryForm, accountId: v })}>
                  <SelectTrigger><SelectValue placeholder="بدون خصم" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون خصم من الخزنة</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name} — {Number(a.balance).toFixed(2)} ج.م</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>ملاحظات</Label>
                <Textarea value={salaryForm.notes} onChange={e => setSalaryForm({ ...salaryForm, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSalaryOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={paySalary.isPending} className="bg-emerald-600 hover:bg-emerald-700">صرف الراتب</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
