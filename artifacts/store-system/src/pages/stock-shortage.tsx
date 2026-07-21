import { useState, useMemo } from "react";
import * as XLSX from "@e965/xlsx";
import { useGetProducts, useGetCategories } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, PackageX, Search, Download, ShoppingCart, TrendingDown } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type StatusFilter = "all" | "out" | "low";

export default function StockShortage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: products = [] } = useGetProducts({});
  const { data: categories = [] } = useGetCategories();

  const shortageProducts = useMemo(() => {
    return products
      .filter(p => p.stock <= (p.minStock ?? 0))
      .map(p => ({
        ...p,
        shortage: Math.max(0, (p.minStock ?? 0) - p.stock),
        isOut: p.stock === 0,
      }))
      .sort((a, b) => {
        if (a.isOut !== b.isOut) return a.isOut ? -1 : 1;
        return (b.shortage - a.shortage);
      });
  }, [products]);

  const filtered = useMemo(() => {
    return shortageProducts.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? "").includes(search);
      const matchCat = categoryFilter === "all" || String(p.categoryId) === categoryFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "out" && p.isOut) ||
        (statusFilter === "low" && !p.isOut);
      return matchSearch && matchCat && matchStatus;
    });
  }, [shortageProducts, search, categoryFilter, statusFilter]);

  const outCount = shortageProducts.filter(p => p.isOut).length;
  const lowCount = shortageProducts.filter(p => !p.isOut).length;
  const totalShortageValue = filtered.reduce(
    (s, p) => s + p.shortage * (p.costPrice ?? p.price),
    0
  );
  const totalShortageUnits = filtered.reduce((s, p) => s + p.shortage, 0);

  function exportExcel() {
    const rows = [
      ["اسم المنتج", "الباركود", "القسم", "المخزون الحالي", "الحد الأدنى", "الناقص", "سعر التكلفة", "تكلفة التعبئة", "الحالة"],
      ...filtered.map(p => [
        p.name,
        p.barcode ?? "",
        p.categoryName ?? "",
        p.stock,
        p.minStock ?? 0,
        p.shortage,
        p.costPrice ?? p.price,
        p.shortage * (p.costPrice ?? p.price),
        p.isOut ? "نفذ" : "منخفض",
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [20, 14, 16, 12, 12, 10, 14, 16, 10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "نواقص البضاعة");
    XLSX.writeFile(wb, `نواقص-البضاعة-${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            نواقص البضاعة
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            المنتجات التي وصلت إلى الحد الأدنى للمخزون أو نفدت
          </p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 ml-2" />
          تصدير Excel
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-1">
              <PackageX className="h-4 w-4" />
              نفذ من المخزون
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-red-700">{outCount}</div>
            <p className="text-xs text-red-500 mt-1">منتج</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-amber-700 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              منخفض المخزون
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-amber-700">{lowCount}</div>
            <p className="text-xs text-amber-500 mt-1">منتج</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              إجمالي الوحدات الناقصة
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-blue-700">{totalShortageUnits.toLocaleString("ar-EG")}</div>
            <p className="text-xs text-blue-500 mt-1">وحدة</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              تكلفة التعبئة المقدرة
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-purple-700">{fmt(totalShortageValue)}</div>
            <p className="text-xs text-purple-500 mt-1">جنيه</p>
          </CardContent>
        </Card>
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
              <SelectTrigger className="w-44 bg-background">
                <SelectValue placeholder="كل الأقسام" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-44 bg-background">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="out">نفذ من المخزون</SelectItem>
                <SelectItem value="low">منخفض المخزون</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <PackageX className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">
                {shortageProducts.length === 0
                  ? "لا توجد نواقص في المخزون 🎉"
                  : "لا توجد نتائج تطابق البحث"}
              </p>
              {shortageProducts.length === 0 && (
                <p className="text-sm mt-1 text-green-600">جميع المنتجات فوق الحد الأدنى</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">المنتج</TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">القسم</TableHead>
                  <TableHead className="text-right">المخزون الحالي</TableHead>
                  <TableHead className="text-right">الحد الأدنى</TableHead>
                  <TableHead className="text-right">الناقص</TableHead>
                  <TableHead className="text-right">تكلفة التعبئة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, i) => (
                  <TableRow
                    key={p.id}
                    className={p.isOut ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-amber-50/40"}
                  >
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {p.barcode || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.categoryName || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold text-base ${p.isOut ? "text-red-600" : "text-amber-600"}`}>
                        {p.stock}
                      </span>
                      <span className="text-xs text-muted-foreground mr-1">{p.unit ?? "قطعة"}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.minStock ?? 0}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${p.shortage > 0 ? "text-red-600" : "text-green-600"}`}>
                        {p.shortage > 0 ? `${p.shortage}+` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.shortage > 0
                        ? `${fmt(p.shortage * (p.costPrice ?? p.price))} ج`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {p.isOut ? (
                        <Badge variant="destructive" className="text-xs">نفذ</Badge>
                      ) : (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                          منخفض
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          يتم عرض {filtered.length} منتج من إجمالي {shortageProducts.length} منتج ناقص
        </p>
      )}
    </div>
  );
}
