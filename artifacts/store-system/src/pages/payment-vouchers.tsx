import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type PaymentVoucher = { id: number; voucherNumber: string; paidTo: string; category: string; amount: number; date: string; accountId?: number | null; reference?: string | null; notes?: string | null; createdAt: string };
type Supplier = { id: number; name: string };
type Account = { id: number; name: string };

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

const CATEGORIES: Record<string, string> = { supplier: "مورد", employee: "موظف", other: "أخرى" };

export default function PaymentVouchers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ supplierId: "", paidTo: "", category: "supplier", amount: "", date: format(new Date(), "yyyy-MM-dd"), accountId: "", reference: "", notes: "" });

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: vouchers, isLoading } = useQuery<PaymentVoucher[]>({ queryKey: ["payment-vouchers"], queryFn: () => fetchJSON(`${BASE}/payment-vouchers`) });
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchJSON(`${BASE}/suppliers`) });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => fetchJSON(`${BASE}/accounts`) });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/payment-vouchers`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تسجيل سند الصرف" }); qc.invalidateQueries({ queryKey: ["payment-vouchers"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); setIsDialogOpen(false); resetForm(); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/payment-vouchers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف السند" }); qc.invalidateQueries({ queryKey: ["payment-vouchers"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); },
  });

  const resetForm = () => setFormData({ supplierId: "", paidTo: "", category: "supplier", amount: "", date: format(new Date(), "yyyy-MM-dd"), accountId: accounts[0] ? String(accounts[0].id) : "", reference: "", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId) {
      toast({ title: "الرجاء اختيار الحساب / الخزينة التي سيُخصم منها السند", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      supplierId: formData.supplierId ? Number(formData.supplierId) : undefined,
      paidTo: formData.paidTo,
      category: formData.category,
      amount: parseFloat(formData.amount),
      date: formData.date,
      accountId: Number(formData.accountId),
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
    });
  };

  const totalAmount = vouchers?.reduce((s, v) => s + v.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سندات الصرف</h1>
          <p className="text-sm text-muted-foreground mt-1">إجمالي المدفوعات: <span className="font-bold text-destructive">{totalAmount.toFixed(2)} ج.م</span></p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          سند صرف جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>الجهة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ (ج.م)</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : vouchers?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد سندات صرف</TableCell></TableRow>
              ) : vouchers?.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-bold text-destructive">{v.voucherNumber}</TableCell>
                  <TableCell>{v.paidTo}</TableCell>
                  <TableCell><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{CATEGORIES[v.category] || v.category}</span></TableCell>
                  <TableCell>{format(new Date(v.date), "yyyy/MM/dd")}</TableCell>
                  <TableCell className="font-bold text-destructive">{v.amount.toFixed(2)} ج.م</TableCell>
                  <TableCell className="text-muted-foreground">{v.reference || "-"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("حذف السند؟")) deleteMutation.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>سند صرف جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v, supplierId: v !== "supplier" ? "" : formData.supplierId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">مورد</SelectItem>
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.category === "supplier" && (
              <div className="space-y-2">
                <Label>المورد</Label>
                <Select value={formData.supplierId} onValueChange={v => { setFormData({ ...formData, supplierId: v, paidTo: suppliers?.find(s => s.id === Number(v))?.name || formData.paidTo }); }}>
                  <SelectTrigger><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
                  <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>مدفوع إلى *</Label>
              <Input value={formData.paidTo} onChange={e => setFormData({ ...formData, paidTo: e.target.value })} required placeholder={formData.category === "employee" ? "اسم الموظف..." : "اسم الجهة..."} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ج.م) *</Label>
                <Input type="number" min="0" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الحساب / الخزينة *</Label>
              <Select value={formData.accountId} onValueChange={v => setFormData({ ...formData, accountId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الحساب..." /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>رقم مرجعي</Label>
              <Input value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder="شيك / تحويل..." />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>حفظ السند</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
