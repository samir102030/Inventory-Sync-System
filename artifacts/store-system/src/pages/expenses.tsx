import { useState } from "react";
import { useGetExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, getGetExpensesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Expense } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({ description: "", amount: "", category: "other", date: format(new Date(), 'yyyy-MM-dd') });

  const { data: expenses, isLoading } = useGetExpenses({});
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        category: expense.category,
        date: expense.date,
      });
    } else {
      setEditingExpense(null);
      setFormData({ description: "", amount: "", category: "other", date: format(new Date(), 'yyyy-MM-dd') });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date,
    };

    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, data }, {
        onSuccess: () => {
          toast({ title: "تم تحديث المصروف" });
          queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
          setIsDialogOpen(false);
        }
      });
    } else {
      createExpense.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "تم تسجيل المصروف" });
          queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المصروف؟")) {
      deleteExpense.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم حذف المصروف" });
          queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">المصروفات</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4 ml-2" />
          تسجيل مصروف
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : expenses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">لا توجد مصروفات</TableCell>
                </TableRow>
              ) : (
                expenses?.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{format(new Date(expense.date), 'yyyy/MM/dd')}</TableCell>
                    <TableCell>
                      {expense.category === 'rent' ? 'إيجار' : 
                       expense.category === 'utilities' ? 'خدمات/فواتير' : 
                       expense.category === 'salaries' ? 'رواتب' : 'أخرى'}
                    </TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell className="font-bold text-destructive">{expense.amount} ج.م</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(expense)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(expense.id)}>
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
            <DialogTitle>{editingExpense ? "تعديل مصروف" : "تسجيل مصروف جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>المبلغ</Label>
              <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">إيجار</SelectItem>
                  <SelectItem value="utilities">خدمات وفواتير</SelectItem>
                  <SelectItem value="salaries">رواتب</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createExpense.isPending || updateExpense.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
