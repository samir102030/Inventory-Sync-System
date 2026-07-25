import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Plus, Trash2, Eye, Receipt, Download, ChevronsUpDown, Check, UserPlus, ShoppingCart, X } from "lucide-react";
import { exportToExcel } from "@/lib/excel";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Supplier = { id: number; name: string; phone?: string | null };
type Product = { id: number; name: string; costPrice?: number | null; categoryId?: number; categoryName?: string | null; price?: number };
type Account = { id: number; name: string };
type PurchaseItem = { productId: number; productName: string; quantity: number; unitCost: number; total: number };
type Purchase = { id: number; purchaseNumber: string; supplierName?: string | null; total: number; tax: number; taxRate: number; date: string; paymentMethod?: string; accountId?: number | null; notes?: string | null; isTaxable?: number; createdAt: string };

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

/* ─── Product Combobox (Popover+Command via Portal) ─── */
function ProductCombobox({ products, value, onSelect }: {
  products: Product[];
  value: string;
  onSelect: (product: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("all");
  const [minCost, setMinCost] = useState("");
  const [maxCost, setMaxCost] = useState("");

  const selected = products.find(p => p.id === Number(value));

  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    products.forEach(p => { if (p.categoryId && p.categoryName) seen.set(p.categoryId, p.categoryName); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (catFilter !== "all" && String(p.categoryId) !== catFilter) return false;
      const cost = Number(p.costPrice ?? 0);
      if (minCost !== "" && cost < Number(minCost)) return false;
      if (maxCost !== "" && cost > Number(maxCost)) return false;
      return true;
    });
  }, [products, catFilter, minCost, maxCost]);

  const hasFilters = catFilter !== "all" || minCost !== "" || maxCost !== "";

  return (
    <div className="col-span-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open}
            className="w-full justify-between font-normal">
            {selected ? (
              <span className="flex items-center gap-2">
                <span>{selected.name}</span>
                {selected.categoryName && (
                  <span className="text-xs bg-muted rounded px-1 text-muted-foreground">{selected.categoryName}</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">ابحث عن منتج...</span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start" side="bottom">
          {/* Filter bar */}
          <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="كل الأقسام" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-7 text-xs w-20 shrink-0" type="number" placeholder="من" value={minCost} onChange={e => setMinCost(e.target.value)} />
            <Input className="h-7 text-xs w-20 shrink-0" type="number" placeholder="إلى" value={maxCost} onChange={e => setMaxCost(e.target.value)} />
            {hasFilters && (
              <button type="button" onClick={() => { setCatFilter("all"); setMinCost(""); setMaxCost(""); }}
                className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Command>
            <CommandInput placeholder="اكتب اسم المنتج..." className="h-9" />
            <CommandList>
              <CommandEmpty>لا توجد منتجات مطابقة</CommandEmpty>
              <CommandGroup>
                {filtered.map(p => (
                  <CommandItem key={p.id} value={p.name}
                    onSelect={() => { onSelect(p); setOpen(false); }}
                    className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className={cn("h-4 w-4 shrink-0", value === String(p.id) ? "opacity-100" : "opacity-0")} />
                      <span>{p.name}</span>
                      {p.categoryName && (
                        <span className="text-xs bg-muted rounded px-1 text-muted-foreground">{p.categoryName}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground ltr shrink-0">
                      {p.costPrice != null ? `${Number(p.costPrice).toFixed(2)} ج.م` : "—"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              {filtered.length} منتج {hasFilters ? "(مفلتر)" : ""}
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ─── Supplier Combobox (Popover+Command via Portal) ─── */
function SupplierCombobox({ suppliers, value, onChange, onAdded }: {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string, name: string) => void;
  onAdded: (s: Supplier) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const selected = suppliers.find(s => s.id === Number(value));

  const addMutation = useMutation({
    mutationFn: (data: object) =>
      fetch(`${BASE}/suppliers`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onAdded(s);
      setShowAdd(false); setNewName(""); setNewPhone(""); setOpen(false);
      toast({ title: "تم إضافة المورد" });
    },
    onError: () => toast({ title: "خطأ في إضافة المورد", variant: "destructive" }),
  });

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) { setShowAdd(false); setNewName(""); setNewPhone(""); } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex items-center gap-2">
              <span>{selected.name}</span>
              {selected.phone && <span className="text-xs text-muted-foreground">{selected.phone}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">ابحث باسم المورد أو رقم الهاتف...</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start" side="bottom">
        {!showAdd ? (
          <Command filter={(value, search) => {
            const supplier = suppliers.find(s => s.name === value || String(s.id) === value);
            if (!supplier) return 0;
            const q = search.toLowerCase();
            if (supplier.name.toLowerCase().includes(q)) return 1;
            if (supplier.phone && supplier.phone.includes(q)) return 1;
            return 0;
          }}>
            <CommandInput placeholder="الاسم أو رقم الهاتف..." className="h-9" />
            <CommandList>
              <CommandEmpty>
                <span className="text-muted-foreground text-sm">لم يُعثر على مورد</span>
              </CommandEmpty>
              <CommandGroup>
                {suppliers.map(s => (
                  <CommandItem key={s.id} value={s.name}
                    onSelect={() => { onChange(String(s.id), s.name); setOpen(false); }}
                    className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className={cn("h-4 w-4 shrink-0", value === String(s.id) ? "opacity-100" : "opacity-0")} />
                      <span>{s.name}</span>
                    </div>
                    {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <div className="p-1">
              <button type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-primary hover:bg-muted rounded-sm"
                onClick={() => setShowAdd(true)}>
                <UserPlus className="h-4 w-4" />
                إضافة مورد جديد
              </button>
            </div>
          </Command>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-sm font-medium mb-2">إضافة مورد جديد</p>
            <Input placeholder="اسم المورد *" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="رقم الهاتف (اختياري)" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            <div className="flex gap-2 pt-1">
              <Button type="button" className="flex-1" size="sm"
                disabled={!newName.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate({ name: newName.trim(), phone: newPhone.trim() || undefined })}>
                حفظ المورد
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)}>إلغاء</Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main Page ─── */
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [accountId, setAccountId] = useState<string>("");
  const [isTaxable, setIsTaxable] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(0);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: purchases, isLoading } = useQuery<Purchase[]>({ queryKey: ["purchases"], queryFn: () => fetchJSON(`${BASE}/purchases`) });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => fetchJSON(`${BASE}/suppliers`) });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => fetchJSON(`${BASE}/products`) });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => fetchJSON(`${BASE}/accounts`) });

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      fetch(`${BASE}/purchases`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم تسجيل المشتريات" });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["credit-accounts-suppliers"] });
      resetForm(); setIsDialogOpen(false);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/purchases/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم حذف الطلب" });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const resetForm = () => {
    setSupplierId(""); setSupplierName(""); setDate(format(new Date(), "yyyy-MM-dd"));
    setNotes(""); setItems([]); setSelectedProductId(""); setItemQty("1"); setItemCost("");
    setPaymentMethod("cash"); setAccountId(accounts[0] ? String(accounts[0].id) : "");
    setIsTaxable(false); setTaxRate(0);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProductId(String(product.id));
    if (product.costPrice != null) setItemCost(String(Number(product.costPrice)));
  };

  const addItem = () => {
    if (!selectedProductId || !itemQty || !itemCost) return;
    const product = products.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    const qty = parseFloat(itemQty);
    const cost = parseFloat(itemCost);
    const existingIdx = items.findIndex(it => it.productId === product.id);
    if (existingIdx >= 0) {
      setItems(prev => prev.map((it, i) => i === existingIdx
        ? { ...it, quantity: it.quantity + qty, unitCost: cost, total: (it.quantity + qty) * cost }
        : it));
    } else {
      setItems(prev => [...prev, { productId: product.id, productName: product.name, quantity: qty, unitCost: cost, total: qty * cost }]);
    }
    setSelectedProductId(""); setItemQty("1"); setItemCost("");
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) { toast({ title: "أضف منتجاً على الأقل", variant: "destructive" }); return; }
    if (paymentMethod === "cash" && !accountId) {
      toast({ title: "الرجاء اختيار الحساب / الخزينة", variant: "destructive" }); return;
    }
    if (paymentMethod === "credit" && !supplierId) {
      toast({ title: "الرجاء اختيار المورد المسجل للمشتريات الآجلة", variant: "destructive" }); return;
    }
    createMutation.mutate({
      supplierId: supplierId ? Number(supplierId) : undefined,
      supplierName: supplierName || undefined,
      date, notes: notes || undefined, items, paymentMethod,
      accountId: paymentMethod === "cash" ? Number(accountId) : undefined,
      isTaxable, taxRate,
    });
  };

  const handleView = async (id: number) => {
    const data = await fetchJSON(`${BASE}/purchases/${id}`);
    setViewPurchase(data);
  };

  const subtotalAmount = items.reduce((s, i) => s + i.total, 0);
  const taxAmount = subtotalAmount * (taxRate / 100);
  const totalAmount = subtotalAmount + taxAmount;

  const handleExport = () => {
    const rows = (purchases ?? []).map((p: Purchase) => [p.purchaseNumber, p.date, p.supplierName ?? "", p.total, p.tax ?? 0, p.paymentMethod ?? "", p.notes ?? ""]);
    exportToExcel(["رقم المشترى", "التاريخ", "المورد", "الإجمالي", "الضريبة", "طريقة الدفع", "ملاحظات"], rows, "purchases", "المشتريات");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">المشتريات</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4 ml-2" />طلب شراء جديد</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الإجمالي (ج.م)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : purchases?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد مشتريات</TableCell></TableRow>
              ) : purchases?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-bold">{p.purchaseNumber}</TableCell>
                  <TableCell>{p.supplierName || "-"}</TableCell>
                  <TableCell>{format(new Date(p.date), "yyyy/MM/dd")}</TableCell>
                  <TableCell>
                    {p.paymentMethod === "credit"
                      ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">آجل</span>
                      : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">نقدي</span>}
                  </TableCell>
                  <TableCell>
                    {p.isTaxable
                      ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">ضريبي</span>
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">عادي</span>}
                  </TableCell>
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

      {/* ── Purchase Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>طلب شراء جديد</DialogTitle></DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Supplier + meta */}
            <div className="grid grid-cols-2 gap-4">
              {/* Supplier — spans full width */}
              <div className="col-span-2 space-y-2">
                <Label>المورد</Label>
                <SupplierCombobox
                  suppliers={suppliers}
                  value={supplierId}
                  onChange={(id, name) => { setSupplierId(id); setSupplierName(name); }}
                  onAdded={(s) => { setSupplierId(String(s.id)); setSupplierName(s.name); }}
                />
                {!supplierId && (
                  <Input
                    className="text-sm mt-1"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="أو اكتب اسم مورد غير مسجل مباشرة..."
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع *</Label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as "cash" | "credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي (فوري)</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === "cash" && (
                <div className="space-y-2">
                  <Label>الحساب / الخزينة *</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="اختر الحساب..." /></SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Tax */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-amber-800">نسبة الضريبة على الفاتورة</span>
              </div>
              <Select value={taxRate.toString()} onValueChange={v => { setTaxRate(Number(v)); setIsTaxable(Number(v) > 0); }}>
                <SelectTrigger className="w-56 bg-white border-amber-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">بدون ضريبة</SelectItem>
                  <SelectItem value="5">ضريبة 5%</SelectItem>
                  <SelectItem value="10">ضريبة 10%</SelectItem>
                  <SelectItem value="14">ضريبة القيمة المضافة 14%</SelectItem>
                </SelectContent>
              </Select>
              {taxRate > 0 && <p className="text-xs text-amber-600">سيُحفظ سعر التكلفة للمنتجات شاملاً الضريبة تلقائياً</p>}
            </div>

            {/* Add product */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">إضافة منتج</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 items-end">
                  <ProductCombobox
                    products={products}
                    value={selectedProductId}
                    onSelect={handleProductSelect}
                  />
                  <Input type="number" min="0.001" step="0.001" placeholder="الكمية" value={itemQty} onChange={e => setItemQty(e.target.value)} />
                  <Input type="number" min="0" step="0.01" placeholder="سعر التكلفة" value={itemCost} onChange={e => setItemCost(e.target.value)} />
                </div>
                <Button type="button" variant="outline" className="mt-2 w-full"
                  disabled={!selectedProductId || !itemQty || !itemCost}
                  onClick={addItem}>
                  + إضافة للطلب
                </Button>
              </CardContent>
            </Card>

            {/* Items table + summary */}
            {items.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>المنتج</TableHead>
                      <TableHead className="w-20 text-center">الكمية</TableHead>
                      <TableHead className="w-28 text-center">سعر التكلفة</TableHead>
                      <TableHead className="w-28 text-center">الإجمالي</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.unitCost.toFixed(2)} ج.م</TableCell>
                        <TableCell className="text-center font-semibold">{item.total.toFixed(2)} ج.م</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Summary */}
                <div className="bg-muted/40 border-t divide-y">
                  <div className="flex justify-between items-center px-4 py-2 text-sm">
                    <span className="text-muted-foreground">عدد الأصناف</span>
                    <span className="font-medium">{items.length} صنف</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2 text-sm">
                    <span className="text-muted-foreground">المجموع الفرعي</span>
                    <span className="font-medium">{subtotalAmount.toFixed(2)} ج.م</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between items-center px-4 py-2 text-sm text-amber-700">
                      <span>الضريبة ({taxRate}%)</span>
                      <span className="font-medium">{taxAmount.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-4 py-3 bg-blue-50">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <span className="font-bold text-base">الإجمالي الكلي</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">{totalAmount.toFixed(2)} ج.م</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>تسجيل الطلب</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ── */}
      <Dialog open={!!viewPurchase} onOpenChange={open => { if (!open) setViewPurchase(null); }}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>تفاصيل طلب الشراء — {viewPurchase?.purchaseNumber}</DialogTitle></DialogHeader>
          {viewPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">المورد: </span>{viewPurchase.supplierName || "-"}</div>
                <div><span className="text-muted-foreground">التاريخ: </span>{format(new Date(viewPurchase.date), "yyyy/MM/dd")}</div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>المنتج</TableHead><TableHead>الكمية</TableHead><TableHead>سعر التكلفة</TableHead><TableHead>الإجمالي</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewPurchase.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unitCost.toFixed(2)} ج.م</TableCell>
                        <TableCell className="font-bold">{item.total.toFixed(2)} ج.م</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-muted/40 border-t divide-y">
                  {viewPurchase.taxRate > 0 && (
                    <div className="flex justify-between items-center px-4 py-2 text-sm text-amber-700">
                      <span>ضريبة {viewPurchase.taxRate}%</span>
                      <span className="font-semibold">{viewPurchase.tax?.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-4 py-3 bg-blue-50">
                    <span className="font-bold text-base">الإجمالي شامل الضريبة</span>
                    <span className="text-xl font-bold text-blue-600">{viewPurchase.total.toFixed(2)} ج.م</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
