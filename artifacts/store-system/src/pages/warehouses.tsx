import { jsonOrThrow } from "@/lib/http";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, ArrowLeftRight, Warehouse, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type WarehouseRow = { id: number; name: string; description: string | null; isMain: boolean; createdAt: string };
type StockRow = { id: number; name: string; barcode: string | null; quantity: number };
type TransferItem = { productId: number; productName?: string; quantity: number };
type Transfer = { id: number; transferNumber: string; fromWarehouseId: number | null; toWarehouseId: number | null; fromWarehouseName: string | null; toWarehouseName: string | null; notes: string | null; createdAt: string; items?: TransferItem[] };
type Product = { id: number; name: string; barcode: string | null; stock: number };

const api = (url: string, opts?: RequestInit) => fetch(url, { credentials: "include", ...opts }).then(jsonOrThrow);

export default function Warehouses() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: warehouses = [] } = useQuery<WarehouseRow[]>({ queryKey: ["warehouses"], queryFn: () => api("/api/warehouses") });
  const { data: transfers = [] } = useQuery<Transfer[]>({ queryKey: ["warehouse-transfers"], queryFn: () => api("/api/warehouse-transfers") });
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ["products-all"], queryFn: () => api("/api/products") });

  // Warehouse form
  const [whDialog, setWhDialog] = useState(false);
  const [editingWh, setEditingWh] = useState<WarehouseRow | null>(null);
  const [whForm, setWhForm] = useState({ name: "", description: "" });

  // Stock view
  const [stockWhId, setStockWhId] = useState<number | null>(null);
  const { data: stockRows = [] } = useQuery<StockRow[]>({
    queryKey: ["warehouse-stock", stockWhId],
    queryFn: () => api(`/api/warehouses/${stockWhId}/stock`),
    enabled: stockWhId !== null,
  });

  // Transfer form
  const [trDialog, setTrDialog] = useState(false);
  const [trForm, setTrForm] = useState({ fromWarehouseId: "", toWarehouseId: "", notes: "" });
  const [trItems, setTrItems] = useState<Array<{ productId: string; quantity: string }>>([{ productId: "", quantity: "1" }]);
  const [trLoading, setTrLoading] = useState(false);

  // Transfer detail
  const [viewTransferId, setViewTransferId] = useState<number | null>(null);
  const { data: transferDetail } = useQuery<Transfer>({
    queryKey: ["warehouse-transfer", viewTransferId],
    queryFn: () => api(`/api/warehouse-transfers/${viewTransferId}`),
    enabled: viewTransferId !== null,
  });

  const openWhDialog = (wh?: WarehouseRow) => {
    setEditingWh(wh || null);
    setWhForm({ name: wh?.name || "", description: wh?.description || "" });
    setWhDialog(true);
  };

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingWh ? `/api/warehouses/${editingWh.id}` : "/api/warehouses";
    const method = editingWh ? "PUT" : "POST";
    const res = await api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(whForm) });
    if (res.error) { toast({ title: "خطأ", description: res.error, variant: "destructive" }); return; }
    toast({ title: editingWh ? "تم التعديل" : "تم الإضافة" });
    qc.invalidateQueries({ queryKey: ["warehouses"] });
    setWhDialog(false);
  };

  const handleWhDelete = async (id: number) => {
    if (!confirm("هل تريد حذف هذا المستودع؟")) return;
    const res = await api(`/api/warehouses/${id}`, { method: "DELETE" });
    if (res.error) { toast({ title: "خطأ", description: res.error, variant: "destructive" }); return; }
    toast({ title: "تم الحذف" });
    qc.invalidateQueries({ queryKey: ["warehouses"] });
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrLoading(true);
    const items = trItems.filter(i => i.productId && Number(i.quantity) > 0).map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity) }));
    const res = await api("/api/warehouse-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWarehouseId: Number(trForm.fromWarehouseId), toWarehouseId: Number(trForm.toWarehouseId), notes: trForm.notes, items }),
    });
    setTrLoading(false);
    if (res.error) { toast({ title: "خطأ", description: res.error, variant: "destructive" }); return; }
    toast({ title: "تم التحويل بنجاح", description: `رقم التحويل: ${res.transferNumber}` });
    qc.invalidateQueries({ queryKey: ["warehouse-transfers"] });
    qc.invalidateQueries({ queryKey: ["warehouse-stock"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products-all"] });
    setTrDialog(false);
    setTrForm({ fromWarehouseId: "", toWarehouseId: "", notes: "" });
    setTrItems([{ productId: "", quantity: "1" }]);
  };

  const addTrItem = () => setTrItems(p => [...p, { productId: "", quantity: "1" }]);
  const removeTrItem = (i: number) => setTrItems(p => p.filter((_, idx) => idx !== i));
  const updateTrItem = (i: number, key: "productId" | "quantity", val: string) =>
    setTrItems(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const mainWh = warehouses.find(w => w.isMain);
  const otherWhs = warehouses.filter(w => !w.isMain);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">إدارة المستودعات</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTrDialog(true)} variant="outline" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            تحويل بين المستودعات
          </Button>
          <Button onClick={() => openWhDialog()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            مستودع جديد
          </Button>
        </div>
      </div>

      <Tabs defaultValue="warehouses">
        <TabsList>
          <TabsTrigger value="warehouses">المستودعات</TabsTrigger>
          <TabsTrigger value="transfers">سجل التحويلات</TabsTrigger>
          {stockWhId !== null && <TabsTrigger value="stock">مخزون المستودع</TabsTrigger>}
        </TabsList>

        {/* ── Warehouses tab ── */}
        <TabsContent value="warehouses" className="space-y-4">
          {/* Main warehouse card */}
          {mainWh && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge className="bg-primary">المخزن الرئيسي</Badge>
                  {mainWh.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mainWh.description || "المستودع الافتراضي — البيع يخصم منه"}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setStockWhId(mainWh.id); }}>
                  <Eye className="h-4 w-4 ml-2" />
                  عرض المخزون
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Other warehouses */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم المستودع</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherWhs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد مستودعات فرعية — أضف مستودعاً جديداً</TableCell>
                    </TableRow>
                  ) : otherWhs.map(wh => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-medium">{wh.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{wh.description || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(wh.createdAt), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setStockWhId(wh.id); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openWhDialog(wh)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleWhDelete(wh.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Transfers tab ── */}
        <TabsContent value="transfers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم التحويل</TableHead>
                    <TableHead>من</TableHead>
                    <TableHead>إلى</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>تفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد تحويلات</TableCell></TableRow>
                  ) : transfers.map(tr => (
                    <TableRow key={tr.id}>
                      <TableCell className="font-mono font-medium">{tr.transferNumber}</TableCell>
                      <TableCell>{tr.fromWarehouseName || "—"}</TableCell>
                      <TableCell>{tr.toWarehouseName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tr.notes || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(tr.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setViewTransferId(tr.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Stock tab ── */}
        {stockWhId !== null && (
          <TabsContent value="stock">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  مخزون: {warehouses.find(w => w.id === stockWhId)?.name}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setStockWhId(null)}><X className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الباركود</TableHead>
                      <TableHead>الكمية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockRows.filter(r => r.quantity > 0).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">لا يوجد مخزون في هذا المستودع</TableCell></TableRow>
                    ) : stockRows.filter(r => r.quantity > 0).map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{r.barcode || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.quantity < 5 ? "destructive" : "secondary"}>{r.quantity}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Warehouse form dialog ── */}
      <Dialog open={whDialog} onOpenChange={setWhDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWh ? "تعديل المستودع" : "مستودع جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWhSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المستودع</Label>
              <Input required value={whForm.name} onChange={e => setWhForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: مستودع فرع الهرم" />
            </div>
            <div className="space-y-2">
              <Label>الوصف (اختياري)</Label>
              <Input value={whForm.description} onChange={e => setWhForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف قصير" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWhDialog(false)}>إلغاء</Button>
              <Button type="submit">{editingWh ? "حفظ التعديل" : "إضافة"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Transfer form dialog ── */}
      <Dialog open={trDialog} onOpenChange={setTrDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              تحويل بين المستودعات
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>من مستودع</Label>
                <Select value={trForm.fromWarehouseId} onValueChange={v => setTrForm(p => ({ ...p, fromWarehouseId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} {w.isMain ? "(رئيسي)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>إلى مستودع</Label>
                <Select value={trForm.toWarehouseId} onValueChange={v => setTrForm(p => ({ ...p, toWarehouseId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => String(w.id) !== trForm.fromWarehouseId).map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} {w.isMain ? "(رئيسي)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Input value={trForm.notes} onChange={e => setTrForm(p => ({ ...p, notes: e.target.value }))} placeholder="سبب التحويل أو ملاحظة" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>الأصناف</Label>
                <Button type="button" size="sm" variant="outline" onClick={addTrItem}>
                  <Plus className="h-4 w-4 ml-1" />إضافة صنف
                </Button>
              </div>
              {trItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select value={item.productId} onValueChange={v => updateTrItem(idx, "productId", v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                    <SelectContent>
                      {allProducts.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} (مخزون رئيسي: {p.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    className="w-24"
                    value={item.quantity}
                    onChange={e => updateTrItem(idx, "quantity", e.target.value)}
                    placeholder="الكمية"
                  />
                  {trItems.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeTrItem(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTrDialog(false)}>إلغاء</Button>
              <Button type="submit" disabled={trLoading || !trForm.fromWarehouseId || !trForm.toWarehouseId}>
                {trLoading ? "جاري التحويل..." : "تنفيذ التحويل"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Transfer detail dialog ── */}
      <Dialog open={viewTransferId !== null} onOpenChange={() => setViewTransferId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل التحويل {transferDetail?.transferNumber}</DialogTitle>
          </DialogHeader>
          {transferDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">من: </span><span className="font-medium">{transferDetail.fromWarehouseName}</span></div>
                <div><span className="text-muted-foreground">إلى: </span><span className="font-medium">{transferDetail.toWarehouseName}</span></div>
                <div><span className="text-muted-foreground">التاريخ: </span>{format(new Date(transferDetail.createdAt), "dd/MM/yyyy HH:mm")}</div>
                {transferDetail.notes && <div><span className="text-muted-foreground">ملاحظات: </span>{transferDetail.notes}</div>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الكمية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferDetail.items?.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.productName || item.productId}</TableCell>
                      <TableCell><Badge variant="secondary">{item.quantity}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
