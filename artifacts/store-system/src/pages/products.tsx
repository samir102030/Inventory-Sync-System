import { useState, useRef, useMemo } from "react";
import * as XLSX from "@e965/xlsx";
import { useGetProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Upload, Download, CheckCircle, XCircle, AlertCircle, SlidersHorizontal, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";

type ImportRow = {
  name: string;
  price: number;
  costPrice?: number;
  categoryName?: string;
  barcode?: string;
  stock?: number;
  minStock?: number;
  unit?: string;
  _valid: boolean;
  _error?: string;
};

const TEMPLATE_COLUMNS = [
  "اسم المنتج",
  "السعر",
  "سعر التكلفة",
  "القسم",
  "الباركود",
  "المخزون",
  "الحد الأدنى للمخزون",
  "الوحدة",
];

const TEMPLATE_SAMPLE = [
  ["كاميرا Hikvision 4MP", 1500, 1100, "كاميرات مراقبة", "HIK004", 10, 2, "قطعة"],
  ["سويتش 8 بورت", 800, 550, "أجهزة شبكات", "SW008", 5, 1, "قطعة"],
];

function exportProducts(products: Product[]) {
  const rows = [
    TEMPLATE_COLUMNS,
    ...products.map(p => [
      p.name,
      p.price,
      p.costPrice ?? "",
      p.categoryName ?? "",
      p.barcode ?? "",
      p.stock,
      p.minStock ?? "",
      p.unit ?? "قطعة",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
  XLSX.writeFile(wb, `products_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...TEMPLATE_SAMPLE]);
  ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
  XLSX.writeFile(wb, "template_products.xlsx");
}

function parseExcelRows(data: unknown[][]): ImportRow[] {
  const colMap: Record<string, number> = {};
  const header = (data[0] as string[]) ?? [];
  header.forEach((h, i) => { if (h) colMap[String(h).trim()] = i; });

  const nameCol = colMap["اسم المنتج"] ?? colMap["name"] ?? colMap["Name"] ?? 0;
  const priceCol = colMap["السعر"] ?? colMap["price"] ?? colMap["Price"] ?? 1;
  const costCol = colMap["سعر التكلفة"] ?? colMap["costPrice"] ?? 2;
  const catCol = colMap["القسم"] ?? colMap["category"] ?? 3;
  const barcodeCol = colMap["الباركود"] ?? colMap["barcode"] ?? 4;
  const stockCol = colMap["المخزون"] ?? colMap["stock"] ?? 5;
  const minStockCol = colMap["الحد الأدنى للمخزون"] ?? colMap["minStock"] ?? 6;
  const unitCol = colMap["الوحدة"] ?? colMap["unit"] ?? 7;

  return (data.slice(1) as unknown[][])
    .filter(row => row.some(cell => cell != null && cell !== ""))
    .map(row => {
      const name = String(row[nameCol] ?? "").trim();
      const priceRaw = row[priceCol];
      const price = priceRaw != null ? parseFloat(String(priceRaw)) : NaN;
      const costRaw = row[costCol];
      const costPrice = costRaw != null && costRaw !== "" ? parseFloat(String(costRaw)) : undefined;
      const categoryName = row[catCol] != null ? String(row[catCol]).trim() : undefined;
      const barcode = row[barcodeCol] != null && row[barcodeCol] !== "" ? String(row[barcodeCol]).trim() : undefined;
      const stockRaw = row[stockCol];
      const stock = stockRaw != null && stockRaw !== "" ? parseInt(String(stockRaw)) : 0;
      const minStockRaw = row[minStockCol];
      const minStock = minStockRaw != null && minStockRaw !== "" ? parseInt(String(minStockRaw)) : 5;
      const unit = row[unitCol] != null && row[unitCol] !== "" ? String(row[unitCol]).trim() : "قطعة";

      let _valid = true;
      let _error: string | undefined;
      if (!name) { _valid = false; _error = "اسم المنتج مطلوب"; }
      else if (isNaN(price) || price < 0) { _valid = false; _error = "السعر غير صالح"; }

      return { name, price, costPrice, categoryName, barcode, stock, minStock, unit, _valid, _error };
    });
}

export default function Products() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterCostMin, setFilterCostMin] = useState("");
  const [filterCostMax, setFilterCostMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: "", categoryId: "", price: "", costPrice: "", stock: "", minStock: "", barcode: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading } = useGetProducts({ search }, { query: { queryKey: getGetProductsQueryKey({ search }) } });
  const { data: categories } = useGetCategories();

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      if (filterCategory !== "all" && String(p.categoryId) !== filterCategory) return false;
      if (filterPriceMin !== "" && p.price < Number(filterPriceMin)) return false;
      if (filterPriceMax !== "" && p.price > Number(filterPriceMax)) return false;
      if (filterCostMin !== "" && (p.costPrice ?? 0) < Number(filterCostMin)) return false;
      if (filterCostMax !== "" && (p.costPrice ?? 0) > Number(filterCostMax)) return false;
      return true;
    });
  }, [products, filterCategory, filterPriceMin, filterPriceMax, filterCostMin, filterCostMax]);

  const hasActiveFilters = filterCategory !== "all" || filterPriceMin !== "" || filterPriceMax !== "" || filterCostMin !== "" || filterCostMax !== "";

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterPriceMin("");
    setFilterPriceMax("");
    setFilterCostMin("");
    setFilterCostMax("");
  };
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: (items: ImportRow[]) =>
      fetch("/api/products/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.filter(r => r._valid) }),
      }).then(r => r.json()),
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    },
    onError: () => toast({ title: "حدث خطأ أثناء الاستيراد", variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      const parsed = parseExcelRows(rows);
      setImportRows(parsed);
      setImportResult(null);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleOpenImport = () => { setImportRows([]); setImportResult(null); setIsImportOpen(true); };

  const validRows = importRows.filter(r => r._valid);
  const invalidRows = importRows.filter(r => !r._valid);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ name: product.name, categoryId: product.categoryId.toString(), price: product.price.toString(), costPrice: product.costPrice?.toString() || "", stock: product.stock.toString(), minStock: product.minStock?.toString() || "", barcode: product.barcode || "" });
    } else {
      setEditingProduct(null);
      setFormData({ name: "", categoryId: "", price: "", costPrice: "", stock: "", minStock: "", barcode: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: formData.name, categoryId: parseInt(formData.categoryId), price: parseFloat(formData.price), costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined, stock: parseInt(formData.stock), minStock: formData.minStock ? parseInt(formData.minStock) : undefined, barcode: formData.barcode || undefined };
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data }, { onSuccess: () => { toast({ title: "تم تحديث المنتج" }); queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); setIsDialogOpen(false); } });
    } else {
      createProduct.mutate({ data }, { onSuccess: () => { toast({ title: "تم إضافة المنتج" }); queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); setIsDialogOpen(false); } });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      deleteProduct.mutate({ id }, { onSuccess: () => { toast({ title: "تم حذف المنتج" }); queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); } });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">المنتجات</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportProducts(filteredProducts)} title="تصدير المنتجات إلى Excel">
            <Download className="h-4 w-4 ml-2" />
            تصدير Excel
          </Button>
          <Button variant="outline" onClick={downloadTemplate} title="تحميل نموذج Excel" className="text-muted-foreground">
            <Download className="h-4 w-4 ml-2" />
            نموذج فارغ
          </Button>
          <Button variant="outline" onClick={handleOpenImport}>
            <Upload className="h-4 w-4 ml-2" />
            استيراد Excel
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة منتج
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث عن منتج..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(v => !v)}
              className="gap-2 shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4" />
              فلترة
              {hasActiveFilters && <Badge className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">{[filterCategory !== "all", filterPriceMin, filterPriceMax, filterCostMin, filterCostMax].filter(Boolean).length}</Badge>}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground shrink-0">
                <X className="h-4 w-4" />
                مسح
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">القسم</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="كل الأقسام" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأقسام</SelectItem>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">السعر (ج.م)</label>
                <div className="flex gap-1 items-center">
                  <Input type="number" min="0" placeholder="من" value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} className="h-9 text-sm" />
                  <span className="text-muted-foreground text-xs shrink-0">—</span>
                  <Input type="number" min="0" placeholder="إلى" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">التكلفة (ج.م)</label>
                <div className="flex gap-1 items-center">
                  <Input type="number" min="0" placeholder="من" value={filterCostMin} onChange={e => setFilterCostMin(e.target.value)} className="h-9 text-sm" />
                  <span className="text-muted-foreground text-xs shrink-0">—</span>
                  <Input type="number" min="0" placeholder="إلى" value={filterCostMax} onChange={e => setFilterCostMax(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">
              عرض <span className="font-semibold text-foreground">{filteredProducts.length}</span> من {products?.length ?? 0} منتج
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المنتج</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>السعر (ج.م)</TableHead>
                <TableHead>التكلفة (ج.م)</TableHead>
                <TableHead>مخزون عادي</TableHead>
                <TableHead>مخزون ضريبي</TableHead>
                <TableHead>الباركود</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">لا توجد منتجات تطابق الفلتر</TableCell></TableRow>
              ) : filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.categoryName}</TableCell>
                  <TableCell>{product.price} ج.م</TableCell>
                  <TableCell>{product.costPrice ? `${product.costPrice} ج.م` : "-"}</TableCell>
                  <TableCell>
                    {product.stock <= (product.minStock || 0)
                      ? <Badge variant="destructive">{product.stock}</Badge>
                      : <Badge variant="secondary">{product.stock}</Badge>}
                  </TableCell>
                  <TableCell>
                    {(product as any).taxStock > 0
                      ? <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{(product as any).taxStock}</Badge>
                      : <span className="text-muted-foreground text-sm">0</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{product.barcode || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(product)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(product.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── Add/Edit Dialog ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>القسم *</Label>
                <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>السعر (ج.م) *</Label>
                <Input type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>التكلفة (ج.م)</Label>
                <Input type="number" step="0.01" value={formData.costPrice} onChange={e => setFormData({ ...formData, costPrice: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>المخزون الحالي</Label>
                <Input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى</Label>
                <Input type="number" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>الباركود</Label>
                <Input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Import Excel Dialog ─── */}
      <Dialog open={isImportOpen} onOpenChange={open => { if (!open) { setIsImportOpen(false); setImportRows([]); setImportResult(null); } }}>
        <DialogContent dir="rtl" className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>استيراد المنتجات من Excel</DialogTitle>
            <DialogDescription>
              اختر ملف Excel يحتوي على بيانات المنتجات. يمكنك تحميل النموذج أولاً للتعرف على الأعمدة المطلوبة.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1 — no file yet */}
          {importRows.length === 0 && !importResult && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">اضغط لاختيار ملف Excel</p>
                <p className="text-sm text-muted-foreground mt-1">يدعم ملفات .xlsx و .xls و .csv</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold">الأعمدة المطلوبة في الملف:</p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {TEMPLATE_COLUMNS.map((col, i) => (
                    <div key={col} className="flex items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${i < 2 ? "bg-destructive/10 text-destructive font-bold" : "bg-muted"}`}>
                        {i < 2 ? "مطلوب" : "اختياري"}
                      </span>
                      <span>{col}</span>
                    </div>
                  ))}
                </div>
                <Button variant="link" className="p-0 h-auto text-sm" onClick={downloadTemplate}>
                  <Download className="h-3 w-3 ml-1" />
                  تحميل النموذج الجاهز
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — preview parsed rows */}
          {importRows.length > 0 && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" /> {validRows.length} صف صالح
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1 text-destructive font-medium">
                      <XCircle className="h-4 w-4" /> {invalidRows.length} صف به خطأ
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  تغيير الملف
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                </Button>
              </div>

              <div className="rounded border overflow-auto max-h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>اسم المنتج</TableHead>
                      <TableHead>القسم</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>التكلفة</TableHead>
                      <TableHead>المخزون</TableHead>
                      <TableHead>الباركود</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.map((row, i) => (
                      <TableRow key={i} className={!row._valid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.name || <span className="text-destructive">فارغ</span>}</TableCell>
                        <TableCell className="text-sm">{row.categoryName || "-"}</TableCell>
                        <TableCell>{row.price > 0 ? `${row.price} ج.م` : <span className="text-destructive">خطأ</span>}</TableCell>
                        <TableCell>{row.costPrice != null ? `${row.costPrice} ج.م` : "-"}</TableCell>
                        <TableCell>{row.stock ?? 0}</TableCell>
                        <TableCell className="font-mono text-xs">{row.barcode || "-"}</TableCell>
                        <TableCell>
                          {row._valid
                            ? <CheckCircle className="h-4 w-4 text-green-500" />
                            : <AlertCircle className="h-4 w-4 text-destructive" title={row._error} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {invalidRows.length > 0 && (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
                  <p className="font-semibold">الصفوف التي بها أخطاء سيتم تخطيها:</p>
                  {invalidRows.map((r, i) => <p key={i}>• {r.name || `صف ${i + 1}`}: {r._error}</p>)}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportRows([])}>إلغاء</Button>
                <Button
                  onClick={() => importMutation.mutate(importRows)}
                  disabled={validRows.length === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? "جاري الاستيراد..." : `استيراد ${validRows.length} منتج`}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — result */}
          {importResult && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <p className="text-xl font-bold">تم الاستيراد!</p>
                <p className="text-muted-foreground mt-1">
                  تم إضافة <span className="font-bold text-green-600">{importResult.created}</span> منتج بنجاح
                  {importResult.failed > 0 && <>, فشل <span className="font-bold text-destructive">{importResult.failed}</span> منتج</>}
                </p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="text-right rounded border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                  {importResult.errors.map((err, i) => <p key={i} className="text-destructive">• {err}</p>)}
                </div>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => { setIsImportOpen(false); setImportRows([]); setImportResult(null); }}>إغلاق</Button>
                <Button onClick={() => { setImportRows([]); setImportResult(null); }}>استيراد ملف آخر</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
