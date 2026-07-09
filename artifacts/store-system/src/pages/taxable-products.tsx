import { useState } from "react";
import { useGetProducts, useGetCategories } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, Search, Package, TrendingUp, DollarSign, Percent } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TaxableProducts() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [taxRate, setTaxRate] = useState<number>(14);

  const { data: products = [] } = useGetProducts({});
  const { data: categories = [] } = useGetCategories();

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode ?? "").includes(search);
    const matchCat = categoryFilter === "all" || String(p.categoryId) === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalTaxValue = filtered.reduce((s, p) => s + (p.price * (taxRate / 100) * p.stock), 0);
  const totalStockValue = filtered.reduce((s, p) => s + (p.price * p.stock), 0);
  const totalStockWithTax = filtered.reduce((s, p) => s + (p.price * (1 + taxRate / 100) * p.stock), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-amber-600" />
          المنتجات الضريبية
        </h1>
        <p className="text-muted-foreground text-sm mt-1">قائمة أسعار المنتجات شاملة الضريبة مع القيم التفصيلية</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن منتج أو باركود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9 bg-background"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48 bg-background">
                <SelectValue placeholder="كل الأقسام" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">نسبة الضريبة:</span>
              <Select value={taxRate.toString()} onValueChange={v => setTaxRate(Number(v))}>
                <SelectTrigger className="w-44 bg-amber-50 border-amber-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">ضريبة 5%</SelectItem>
                  <SelectItem value="10">ضريبة 10%</SelectItem>
                  <SelectItem value="14">ضريبة القيمة المضافة 14%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Package className="h-4 w-4" />
              عدد المنتجات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
            <p className="text-xs text-muted-foreground mt-1">منتج</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              قيمة المخزون (قبل الضريبة)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalStockValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">ج.م</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              إجمالي قيمة الضريبة ({taxRate}%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{fmt(totalTaxValue)}</p>
            <p className="text-xs text-amber-600 mt-1">ج.م على المخزون الحالي</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              قيمة المخزون (شامل الضريبة)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{fmt(totalStockWithTax)}</p>
            <p className="text-xs text-green-600 mt-1">ج.م</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            قائمة المنتجات بالقيم الضريبية
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              نسبة الضريبة: {taxRate}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              لا توجد منتجات مطابقة
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الباركود</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>المخزون</TableHead>
                  <TableHead className="text-left">سعر التكلفة</TableHead>
                  <TableHead className="text-left text-amber-700">تكلفة القطعة + ضريبة {taxRate}%</TableHead>
                  <TableHead className="text-left">سعر البيع</TableHead>
                  <TableHead className="text-left text-amber-700">قيمة الضريبة ({taxRate}%)</TableHead>
                  <TableHead className="text-left text-green-700">سعر البيع شامل الضريبة</TableHead>
                  <TableHead className="text-left text-blue-700">قيمة المخزون (شامل الضريبة)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const costTaxAmt = p.costPrice != null ? p.costPrice * (taxRate / 100) : null;
                  const costWithTax = p.costPrice != null ? p.costPrice + (costTaxAmt ?? 0) : null;
                  const taxAmt = p.price * (taxRate / 100);
                  const priceWithTax = p.price + taxAmt;
                  const stockValue = priceWithTax * p.stock;
                  const stockLow = p.stock <= (p.minStock ?? 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.unit && <div className="text-xs text-muted-foreground">{p.unit}</div>}
                      </TableCell>
                      <TableCell>
                        {p.barcode
                          ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{p.barcode}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{p.categoryName ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={stockLow ? "text-red-600 font-semibold" : "font-medium"}>
                          {p.stock}
                        </span>
                        {stockLow && <span className="text-xs text-red-500 mr-1">(منخفض)</span>}
                      </TableCell>
                      <TableCell className="text-left" dir="ltr">
                        {p.costPrice != null ? fmt(p.costPrice) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-left font-bold text-amber-700" dir="ltr">
                        {costWithTax != null ? fmt(costWithTax) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-left font-medium" dir="ltr">
                        {fmt(p.price)}
                      </TableCell>
                      <TableCell className="text-left font-semibold text-amber-700" dir="ltr">
                        {fmt(taxAmt)}
                      </TableCell>
                      <TableCell className="text-left font-bold text-green-700" dir="ltr">
                        {fmt(priceWithTax)}
                      </TableCell>
                      <TableCell className="text-left font-semibold text-blue-700" dir="ltr">
                        {fmt(stockValue)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Footer totals */}
      {filtered.length > 0 && (
        <Card className="border-amber-300">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">إجمالي قبل الضريبة</p>
                <p className="text-lg font-bold mt-1">{fmt(totalStockValue)} ج.م</p>
              </div>
              <div className="text-center border-x">
                <p className="text-amber-700">إجمالي الضريبة ({taxRate}%)</p>
                <p className="text-lg font-bold text-amber-700 mt-1">{fmt(totalTaxValue)} ج.م</p>
              </div>
              <div className="text-center">
                <p className="text-green-700">إجمالي شامل الضريبة</p>
                <p className="text-lg font-bold text-green-700 mt-1">{fmt(totalStockWithTax)} ج.م</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
