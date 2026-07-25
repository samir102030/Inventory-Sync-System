import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download } from "lucide-react";
import { exportToExcel } from "@/lib/excel";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type ReceiptVoucher = {
  id: number;
  voucherNumber: string;
  customerName?: string | null;
  amount: number;
  date: string;
  accountId?: number | null;
  type?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
};
type Customer = { id: number; name: string };
type Account = { id: number; name: string };

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

const TYPE_LABEL: Record<string, string> = {
  payment: "سند قبض",
  deposit: "عربون",
};

export default function ReceiptVouchers() {
  const { isAdmin } = useRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    accountId: "",
    type: "payment",
    reference: "",
    notes: "",
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: vouchers, isLoading } = useQuery<ReceiptVoucher[]>({
    queryKey: ["receipt-vouchers"],
    queryFn: () => fetchJSON(`${BASE}/receipt-vouchers`),
  });
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => fetchJSON(`${BASE}/customers`),
  });
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => fetchJSON(`${BASE}/accounts`),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      fetch(`${BASE}/receipt-vouchers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم تسجيل السند" });
      qc.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["credit-accounts-balances"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/receipt-vouchers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم حذف السند" });
      qc.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["credit-accounts-balances"] });
    },
  });

  const resetForm = () =>
    setFormData({
      customerId: "",
      customerName: "",
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      accountId: accounts[0] ? String(accounts[0].id) : "",
      type: "payment",
      reference: "",
      notes: "",
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId) {
      toast({ title: "الرجاء اختيار الحساب / الخزينة المستلمة", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      customerId: formData.customerId ? Number(formData.customerId) : undefined,
      customerName: formData.customerName || undefined,
      amount: parseFloat(formData.amount),
      date: formData.date,
      accountId: Number(formData.accountId),
      type: formData.type,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
    });
  };

  const totalAmount = vouchers?.reduce((s, v) => s + v.amount, 0) ?? 0;
  const totalDeposits = vouchers?.filter(v => v.type === "deposit").reduce((s, v) => s + v.amount, 0) ?? 0;

  const handleExport = () => {
    const rows = (vouchers ?? []).map(v => [
      v.voucherNumber, v.date, v.customerName ?? "",
      TYPE_LABEL[v.type ?? "payment"] ?? v.type ?? "",
      v.amount, v.reference ?? "", v.notes ?? "",
    ]);
    exportToExcel(
      ["رقم السند", "التاريخ", "العميل", "النوع", "المبلغ", "المرجع", "ملاحظات"],
      rows, "receipt_vouchers", "سندات القبض"
    );
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3 text-muted-foreground">
      <span className="text-5xl">🔒</span>
      <p className="text-lg font-medium">هذه الصفحة للمدير فقط</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سندات القبض</h1>
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
            <span>إجمالي المقبوضات: <span className="font-bold text-green-600">{totalAmount.toFixed(2)} ج.م</span></span>
            {totalDeposits > 0 && (
              <span>منها عربون: <span className="font-bold text-amber-600">{totalDeposits.toFixed(2)} ج.م</span></span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4 ml-2" />سند قبض جديد</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>العميل</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد سندات قبض</TableCell></TableRow>
              ) : vouchers?.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-bold text-green-700">{v.voucherNumber}</TableCell>
                  <TableCell>
                    {v.type === "deposit" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">عربون</span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">سند قبض</span>
                    )}
                  </TableCell>
                  <TableCell>{v.customerName || "-"}</TableCell>
                  <TableCell>{format(new Date(v.date), "yyyy/MM/dd")}</TableCell>
                  <TableCell className={`font-bold ${v.type === "deposit" ? "text-amber-600" : "text-green-600"}`}>
                    {v.amount.toFixed(2)} ج.م
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.reference || "-"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("حذف السند؟")) deleteMutation.mutate(v.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>سند قبض جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Type selector */}
            <div className="space-y-2">
              <Label>نوع السند *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: "payment" }))}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                    formData.type === "payment"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-muted bg-background text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">سند قبض</div>
                  <div className="text-xs mt-0.5 opacity-75">سداد فاتورة أو دفعة عادية</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: "deposit" }))}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                    formData.type === "deposit"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-muted bg-background text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">عربون</div>
                  <div className="text-xs mt-0.5 opacity-75">دفعة مقدمة تُحسب من رصيد العميل</div>
                </button>
              </div>
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select
                value={formData.customerId}
                onValueChange={v => setFormData(f => ({
                  ...f,
                  customerId: v,
                  customerName: customers?.find(c => c.id === Number(v))?.name || "",
                }))}>
                <SelectTrigger><SelectValue placeholder="اختر عميل..." /></SelectTrigger>
                <SelectContent>
                  {customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!formData.customerId && (
              <div className="space-y-2">
                <Label>أو اكتب اسم العميل</Label>
                <Input
                  value={formData.customerName}
                  onChange={e => setFormData(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="عميل غير مسجل..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ج.م) *</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الحساب / الخزينة *</Label>
              <Select value={formData.accountId} onValueChange={v => setFormData(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الحساب..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>رقم مرجعي</Label>
              <Input
                value={formData.reference}
                onChange={e => setFormData(f => ({ ...f, reference: e.target.value }))}
                placeholder="شيك / تحويل / رقم عملية..."
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {formData.type === "deposit" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚡ هذا المبلغ سيُخصم من رصيد العميل فور الحفظ
              </div>
            )}

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
