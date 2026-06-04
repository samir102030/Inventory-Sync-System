import { useState } from "react";
import { useGetCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Category } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Categories() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: categories, isLoading } = useGetCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, description: category.description || "" });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: formData.name, description: formData.description || undefined };

    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, data }, {
        onSuccess: () => {
          toast({ title: "تم تحديث القسم" });
          queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
          setIsDialogOpen(false);
        }
      });
    } else {
      createCategory.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "تم إضافة القسم" });
          queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا القسم؟")) {
      deleteCategory.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم حذف القسم" });
          queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">الأقسام</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          إضافة قسم
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : categories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">لا توجد أقسام</TableCell>
                </TableRow>
              ) : (
                categories?.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(category.id)}>
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
            <DialogTitle>{editingCategory ? "تعديل قسم" : "إضافة قسم جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>الوصف (اختياري)</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
