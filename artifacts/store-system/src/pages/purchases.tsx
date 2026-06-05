import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type Supplier = { id: number; name: string };
type Product = { id: number; name: string; costPrice?: number };
type PurchaseItem = { productId: number; productName: string; quantity: number; unitCost: number; total: number };
type Purchase = { id: number; purchaseNumber: string; supplierName?: string | null; total: number; date: string; notes?: string | null; createdAt: string };

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function Purchases() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<(Purchase & { items: PurchaseItem[] }) | null>(null);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [itemQty, setItemQty] = useState("1");
  const [itemCost, setItemCost] = useState("");

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: purchases, isLoading } = useQuery<Purchase[]>({ queryKey: ["purchases"], queryFn: () => fetchJSON(`${BASE}/purchases`) });
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchJSON(`${BASE}/suppliers`) });
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => fetchJSON(`${BASE}/products`) });

  const createMutation = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/purchases`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تسجيل المشتريات" }); qc.invalidateQueries({ queryKey: ["purchases"] }); qc.invalidateQueries({ queryKey: ["products"] }); resetForm(); setIsDialogOpen(false); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/purchases/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف الطلب" }); qc.invalidateQueries({ queryKey: ["purchases"] }); },
  });

  const resetForm = () => { setSupplierId(""); setSupplierName(""); setDate(format(new Date(), "yyyy-MM-dd")); setNotes(""); setItems([]); setSelectedProductId(""); setItemQty("1"); setItemCost(""); };

  const addItem = () => {
    if (!selectedProductId || !itemQty || !itemCost) return;
    const product = products?.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    const qty = parseFloat(itemQty);
    const cost = parseFloat(itemCost);
    setItems(prev => [...prev, { productId: product.id, productName: product.name, quantity: qty, unitCost: cost, total: qty * cost }]);
    setSelectedProductId(""); setItemQty("1"); setItemCost("");
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) { toast({ title: "أضف منتجاً على الأقل", variant: "destructive" }); return; }
    createMutation.mutate({ supplierId: supplierId ? Number(supplierId) : undefined, supplierName: supplierName || undefined, date, notes: notes || undefined, items });
  };

  const handleView = async (id: number) => {
    const data = await fetchJSON(`${BASE}/purchases/${id}`);
    setViewPurchase(data);
  };

  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">المشتريات</h1>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          طلب شراء جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الإجمالي (ج.م)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : purchases?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">لا توجد مشتريات</TableCell></TableRow>
              ) : purchases?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-bold">{p.purchaseNumber}</TableCell>
                  <TableCell>{p.supplierName || "-"}</TableCell>
                  <TableCell>{format(new Date(p.date), "yyyy/MM/dd")}</TableCell>
                  <TableCell className="font-bold text-blue-600">{p.total.toFixed(2)} ج.م</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleView(p.id)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("حذف الطلب؟")) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>طلب شراء جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المورد</Label>
                <Select value={supplierId} onValueChange={v => { setSupplierId(v); const s = suppliers?.find(s => s.id === Number(v)); if (s) setSupplierName(s.name); }}>
                  <SelectTrigger><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
                  <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>أو اكتب اسم المورد</Label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="مورد غير مسجل..." disabled={!!supplierId} />
              </div>
              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">إضافة منتج</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Select value={selectedProductId} onValueChange={v => { setSelectedProductId(v); const p = products?.find(p => p.id === Number(v)); if (p?.costPrice) setItemCost(String(p.costPrice)); }}>
                      <SelectTrigger><SelectValue placeholder="اختر منتج..." /></SelectTrigger>
                      <SelectContent>{products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input type="number" min="0.001" step="0.001" placeholder="الكمية" value={itemQty} onChange={e => setItemQty(e.target.value)} />
                  <Input type="number" min="0" step="0.01" placeholder="سعر التكلفة" value={itemCost} onChange={e => setItemCost(e.target.value)} />
                </div>
                <Button type="button" variant="outline" className="mt-2 w-full" onClick={addItem}>+ إضافة للطلب</Button>
              </CardContent>
            </Card>

            {items.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الكمية</TableHead><TableHead>سعر التكلفة</TableHead><TableHead>الإجمالي</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unitCost.toFixed(2)} ج.م</TableCell>
                      <TableCell className="font-bold">{item.total.toFixed(2)} ج.م</TableCell>
                      <TableCell><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                  <TableRow><TableCell colSpan={3} className="text-left font-bold">الإجمالي</TableCell><TableCell className="font-bold text-blue-600">{totalAmount.toFixed(2)} ج.م</TableCell><TableCell /></TableRow>
                </TableBody>
              </Table>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>تسجيل الطلب</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPurchase} onOpenChange={open => { if (!open) setViewPurchase(null); }}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>تفاصيل طلب الشراء — {viewPurchase?.purchaseNumber}</DialogTitle></DialogHeader>
          {viewPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">المورد: </span>{viewPurchase.supplierName || "-"}</div>
                <div><span className="text-muted-foreground">التاريخ: </span>{format(new Date(viewPurchase.date), "yyyy/MM/dd")}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الكمية</TableHead><TableHead>سعر التكلفة</TableHead><TableHead>الإجمالي</TableHead></TableRow></TableHeader>
                <TableBody>
                  {viewPurchase.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unitCost.toFixed(2)} ج.م</TableCell>
                      <TableCell className="font-bold">{item.total.toFixed(2)} ج.م</TableCell>
                    </TableRow>
                  ))}
                  <TableRow><TableCell colSpan={3} className="font-bold">الإجمالي</TableCell><TableCell className="font-bold text-blue-600">{viewPurchase.total.toFixed(2)} ج.م</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
