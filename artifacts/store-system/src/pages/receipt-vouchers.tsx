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

type ReceiptVoucher = { id: number; voucherNumber: string; customerName?: string | null; amount: number; date: string; reference?: string | null; notes?: string | null; createdAt: string };
type Customer = { id: number; name: string };

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function ReceiptVouchers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ customerId: "", customerName: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), reference: "", notes: "" });

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: vouchers, isLoading } = useQuery<ReceiptVoucher[]>({ queryKey: ["receipt-vouchers"], queryFn: () => fetchJSON(`${BASE}/receipt-vouchers`) });
  const { data: customers } = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: () => fetchJSON(`${BASE}/customers`) });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/receipt-vouchers`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تسجيل سند القبض" }); qc.invalidateQueries({ queryKey: ["receipt-vouchers"] }); setIsDialogOpen(false); resetForm(); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/receipt-vouchers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف السند" }); qc.invalidateQueries({ queryKey: ["receipt-vouchers"] }); },
  });

  const resetForm = () => setFormData({ customerId: "", customerName: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), reference: "", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      customerId: formData.customerId ? Number(formData.customerId) : undefined,
      customerName: formData.customerName || undefined,
      amount: parseFloat(formData.amount),
      date: formData.date,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
    });
  };

  const totalAmount = vouchers?.reduce((s, v) => s + v.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سندات القبض</h1>
          <p className="text-sm text-muted-foreground mt-1">إجمالي المقبوضات: <span className="font-bold text-green-600">{totalAmount.toFixed(2)} ج.م</span></p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          سند قبض جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ (ج.م)</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : vouchers?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">لا توجد سندات قبض</TableCell></TableRow>
              ) : vouchers?.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-bold text-green-700">{v.voucherNumber}</TableCell>
                  <TableCell>{v.customerName || "-"}</TableCell>
                  <TableCell>{format(new Date(v.date), "yyyy/MM/dd")}</TableCell>
                  <TableCell className="font-bold text-green-600">{v.amount.toFixed(2)} ج.م</TableCell>
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
          <DialogHeader><DialogTitle>سند قبض جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select value={formData.customerId} onValueChange={v => { setFormData({ ...formData, customerId: v, customerName: customers?.find(c => c.id === Number(v))?.name || "" }); }}>
                <SelectTrigger><SelectValue placeholder="اختر عميل..." /></SelectTrigger>
                <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>أو اكتب اسم العميل</Label>
              <Input value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} placeholder="عميل غير مسجل..." disabled={!!formData.customerId} />
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
              <Label>رقم مرجعي</Label>
              <Input value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder="شيك / تحويل / رقم عملية..." />
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
