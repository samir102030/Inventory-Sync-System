import { useState } from "react";
import { useGetProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Products() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    price: "",
    costPrice: "",
    stock: "",
    minStock: "",
    barcode: "",
  });

  const { data: products, isLoading } = useGetProducts({ search }, { query: { queryKey: getGetProductsQueryKey({ search }) }});
  const { data: categories } = useGetCategories();
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        categoryId: product.categoryId.toString(),
        price: product.price.toString(),
        costPrice: product.costPrice?.toString() || "",
        stock: product.stock.toString(),
        minStock: product.minStock?.toString() || "",
        barcode: product.barcode || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        categoryId: "",
        price: "",
        costPrice: "",
        stock: "",
        minStock: "",
        barcode: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      categoryId: parseInt(formData.categoryId),
      price: parseFloat(formData.price),
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
      stock: parseInt(formData.stock),
      minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
      barcode: formData.barcode || undefined,
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data }, {
        onSuccess: () => {
          toast({ title: "تم تحديث المنتج" });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
          setIsDialogOpen(false);
        }
      });
    } else {
      createProduct.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "تم إضافة المنتج" });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم حذف المنتج" });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">المنتجات</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          إضافة منتج
        </Button>
      </div>
      
      <Card>
        <CardHeader className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المنتج</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>التكلفة</TableHead>
                <TableHead>المخزون</TableHead>
                <TableHead>الباركود</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">لا توجد منتجات</TableCell>
                </TableRow>
              ) : (
                products?.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.categoryName}</TableCell>
                    <TableCell>{product.price} د.ك</TableCell>
                    <TableCell>{product.costPrice ? `${product.costPrice} د.ك` : '-'}</TableCell>
                    <TableCell>
                      {product.stock <= (product.minStock || 0) ? (
                        <Badge variant="destructive">{product.stock}</Badge>
                      ) : (
                        <Badge variant="secondary">{product.stock}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{product.barcode || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v})} required>
                  <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>السعر</Label>
                <Input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>التكلفة</Label>
                <Input type="number" step="0.01" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>المخزون الحالي</Label>
                <Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى للمخزون</Label>
                <Input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>الباركود</Label>
                <Input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
