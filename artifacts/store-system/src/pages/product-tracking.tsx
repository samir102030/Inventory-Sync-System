import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ScanBarcode, TrendingUp, TrendingDown, Package } from "lucide-react";
import { format } from "date-fns";

type TrackingResult = {
  product: { id: number; name: string; barcode: string | null; stock: number; price: number; costPrice: number | null };
  sales: Array<{ invoiceId: number; invoiceNumber: string; date: string; quantity: number; unitPrice: number; total: number; customerName: string | null }>;
  purchases: Array<{ purchaseId: number; purchaseNumber: string; date: string; quantity: number; unitCost: number; total: number; supplierName: string | null }>;
  totalSold: number;
  totalPurchased: number;
  totalSalesRevenue: number;
  totalPurchaseCost: number;
};

const api = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function ProductTracking() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data: results, isLoading, error } = useQuery<TrackingResult[]>({
    queryKey: ["product-tracking", query],
    queryFn: () => api(`/api/products/tracking?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });

  const [selected, setSelected] = useState<TrackingResult | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
    setSelected(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ScanBarcode className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">تتبع المنتج</h1>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pr-9"
                placeholder="ابحث باسم المنتج أو الباركود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit">بحث</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">يمكنك استخدام ماسح الباركود مباشرة في خانة البحث</p>
        </CardContent>
      </Card>

      {/* Search results list */}
      {isLoading && <p className="text-center text-muted-foreground py-8">جاري البحث...</p>}
      {error && <p className="text-center text-destructive py-8">حدث خطأ أثناء البحث</p>}

      {results && !selected && (
        results.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد نتائج للبحث عن &quot;{query}&quot;</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الباركود</TableHead>
                    <TableHead>المخزون الحالي</TableHead>
                    <TableHead>إجمالي المبيعات</TableHead>
                    <TableHead>إجمالي المشتريات</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(r => (
                    <TableRow key={r.product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                      <TableCell className="font-medium">{r.product.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{r.product.barcode || "—"}</TableCell>
                      <TableCell><Badge variant={r.product.stock < 5 ? "destructive" : "secondary"}>{r.product.stock}</Badge></TableCell>
                      <TableCell className="text-green-600 font-medium">{r.totalSold} وحدة</TableCell>
                      <TableCell className="text-blue-600 font-medium">{r.totalPurchased} وحدة</TableCell>
                      <TableCell><Button size="sm" variant="outline">عرض التفاصيل</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      )}

      {/* Product detail view */}
      {selected && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>← رجوع</Button>
            <h2 className="text-xl font-bold">{selected.product.name}</h2>
            {selected.product.barcode && (
              <Badge variant="outline" className="font-mono">{selected.product.barcode}</Badge>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">المخزون الحالي</span>
                </div>
                <p className="text-2xl font-bold">{selected.product.stock}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">إجمالي المبيعات</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{selected.totalSold} وحدة</p>
                <p className="text-xs text-muted-foreground">{selected.totalSalesRevenue.toFixed(2)} ج.م</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">إجمالي المشتريات</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{selected.totalPurchased} وحدة</p>
                <p className="text-xs text-muted-foreground">{selected.totalPurchaseCost.toFixed(2)} ج.م</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground">هامش الربح</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {selected.totalPurchaseCost > 0
                    ? `${(((selected.totalSalesRevenue - selected.totalPurchaseCost) / selected.totalPurchaseCost) * 100).toFixed(1)}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selected.totalSalesRevenue - selected.totalPurchaseCost).toFixed(2)} ج.م صافي
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="sales">
            <TabsList>
              <TabsTrigger value="sales">المبيعات ({selected.sales.length})</TabsTrigger>
              <TabsTrigger value="purchases">المشتريات ({selected.purchases.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الفاتورة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>سعر الوحدة</TableHead>
                        <TableHead>الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.sales.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">لا توجد مبيعات لهذا المنتج</TableCell></TableRow>
                      ) : selected.sales.map(s => (
                        <TableRow key={`${s.invoiceId}`}>
                          <TableCell className="font-mono">{s.invoiceNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(s.date), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell>{s.customerName || "عميل نقدي"}</TableCell>
                          <TableCell><Badge variant="outline">{s.quantity}</Badge></TableCell>
                          <TableCell>{s.unitPrice.toFixed(2)} ج.م</TableCell>
                          <TableCell className="font-medium text-green-600">{s.total.toFixed(2)} ج.م</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchases">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الفاتورة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المورد</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>سعر الوحدة</TableHead>
                        <TableHead>الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.purchases.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">لا توجد مشتريات لهذا المنتج</TableCell></TableRow>
                      ) : selected.purchases.map(p => (
                        <TableRow key={`${p.purchaseId}`}>
                          <TableCell className="font-mono">{p.purchaseNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(p.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{p.supplierName || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{p.quantity}</Badge></TableCell>
                          <TableCell>{p.unitCost.toFixed(2)} ج.م</TableCell>
                          <TableCell className="font-medium text-blue-600">{p.total.toFixed(2)} ج.م</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
