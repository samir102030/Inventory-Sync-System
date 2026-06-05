import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  createdAt: string;
};

const BASE = "/api";

async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  const url = search ? `${BASE}/suppliers?search=${encodeURIComponent(search)}` : `${BASE}/suppliers`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", whatsapp: "", address: "", taxNumber: "", notes: "" });

  const qc = useQueryClient();
  const { toast } = useToast();
  const qKey = ["suppliers", search];

  const { data: suppliers, isLoading } = useQuery({ queryKey: qKey, queryFn: () => fetchSuppliers(search) });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/suppliers`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم إضافة المورد" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); setIsDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetch(`${BASE}/suppliers/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تحديث المورد" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); setIsDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/suppliers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف المورد" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
  });

  const handleOpenDialog = (s?: Supplier) => {
    if (s) {
      setEditingSupplier(s);
      setFormData({ name: s.name, phone: s.phone || "", whatsapp: s.whatsapp || "", address: s.address || "", taxNumber: s.taxNumber || "", notes: s.notes || "" });
    } else {
      setEditingSupplier(null);
      setFormData({ name: "", phone: "", whatsapp: "", address: "", taxNumber: "", notes: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: formData.name, phone: formData.phone || undefined, whatsapp: formData.whatsapp || undefined, address: formData.address || undefined, taxNumber: formData.taxNumber || undefined, notes: formData.notes || undefined };
    if (editingSupplier) updateMutation.mutate({ id: editingSupplier.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الموردون</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          إضافة مورد
        </Button>
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
                <TableHead>العنوان</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : suppliers?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">لا يوجد موردون</TableCell></TableRow>
              ) : suppliers?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{s.phone || "-"}</TableCell>
                  <TableCell dir="ltr" className="text-right">{s.whatsapp || "-"}</TableCell>
                  <TableCell>{s.taxNumber || "-"}</TableCell>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingSupplier ? "تعديل مورد" : "إضافة مورد جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2"><Label>الاسم *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} dir="ltr" className="text-right" /></div>
              <div className="space-y-2"><Label>واتساب</Label><Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} dir="ltr" className="text-right" /></div>
              <div className="space-y-2"><Label>الرقم الضريبي</Label><Input value={formData.taxNumber} onChange={e => setFormData({ ...formData, taxNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>العنوان</Label><Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>ملاحظات</Label><Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
