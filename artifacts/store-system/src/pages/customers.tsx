import { useState } from "react";
import { useGetCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getGetCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Customer } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", whatsapp: "", email: "", address: "", taxNumber: "" });

  const { data: customers, isLoading } = useGetCustomers({ search }, { query: { queryKey: getGetCustomersQueryKey({ search }) } });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">العملاء</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          إضافة عميل
        </Button>
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
                <TableHead className="w-[100px]"></TableHead>
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
                  <TableCell dir="ltr" className="text-right">{(customer as any).whatsapp || "-"}</TableCell>
                  <TableCell>{(customer as any).taxNumber || "-"}</TableCell>
                  <TableCell className="font-bold">{customer.totalPurchases?.toFixed(2) || "0.00"} ج.م</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingCustomer ? "تعديل عميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>الاسم *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label>واتساب</Label>
                <Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} dir="ltr" className="text-right" />
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
    </div>
  );
}
