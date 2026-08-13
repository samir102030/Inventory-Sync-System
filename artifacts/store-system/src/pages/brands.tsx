import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsonOrThrow } from "@/lib/http";
import { useRole } from "@/hooks/use-role";

/**
 * البراندات.
 *
 * المورّد يضيف ويعدّل ولا يحذف، وما يلمسه ينتظر اعتماد أدمن أو مالك. المعتمَد
 * يراه الجميع؛ ما ينتظر يراه من صنعه ومن سيعتمده فقط.
 */

type Brand = {
  id: number;
  name: string;
  description: string | null;
  website: string | null;
  approvalStatus: string;
  createdBy: string | null;
  approvedBy: string | null;
  createdAt: string;
};

type Form = { name: string; description: string; website: string };
const EMPTY: Form = { name: "", description: "", website: "" };

export default function Brands() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, role } = useRole();
  const isVendor = role === "vendor";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: brands = [], isLoading } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => fetch("/api/brands", { credentials: "include" }).then(jsonOrThrow),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["brands"] });

  const save = useMutation({
    mutationFn: (payload: Form) =>
      fetch(editing ? `/api/brands/${editing.id}` : "/api/brands", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then(jsonOrThrow),
    onSuccess: (brand: Brand) => {
      refresh();
      setOpen(false);
      toast({
        title: editing ? "تم تعديل البراند" : "تمت إضافة البراند",
        description:
          brand.approvalStatus === "pending"
            ? "هيظهر للجميع بعد اعتماد الأدمن."
            : undefined,
      });
    },
  });

  const approve = useMutation({
    mutationFn: (brand: Brand) =>
      fetch(`/api/brands/${brand.id}/approve`, { method: "POST", credentials: "include" }).then(jsonOrThrow),
    onSuccess: () => {
      refresh();
      toast({ title: "تم اعتماد البراند" });
    },
  });

  const remove = useMutation({
    mutationFn: (brand: Brand) =>
      fetch(`/api/brands/${brand.id}`, { method: "DELETE", credentials: "include" }).then(jsonOrThrow),
    onSuccess: () => {
      refresh();
      toast({ title: "تم حذف البراند" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setForm({
      name: brand.name,
      description: brand.description ?? "",
      website: brand.website ?? "",
    });
    setOpen(true);
  };

  const pending = brands.filter((b) => b.approvalStatus === "pending");

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">البراندات</h1>
          <p className="text-sm text-muted-foreground">
            {isVendor
              ? "ضيف البراندات وعدّلها. اللي تضيفه هيظهر للجميع بعد اعتماد الأدمن."
              : "البراندات المتاحة، ومراجعة اللي أضافه المورّدون."}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة براند
        </Button>
      </div>

      {isAdmin && pending.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {pending.length} براند بانتظار اعتمادك
            </CardTitle>
            <CardDescription>مش ظاهرين لباقي الموظفين لحد ما تعتمدهم.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> كل البراندات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>الموقع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>أضافه</TableHead>
                <TableHead className="w-[130px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">جاري التحميل...</TableCell></TableRow>
              ) : brands.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">مفيش براندات لسه.</TableCell></TableRow>
              ) : (
                brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{brand.description ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-right text-sm">{brand.website ?? "—"}</TableCell>
                    <TableCell>
                      {brand.approvalStatus === "approved" ? (
                        <Badge variant="outline">معتمد</Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-500">بانتظار الاعتماد</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{brand.createdBy ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isAdmin && brand.approvalStatus === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            title="اعتماد"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(brand)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="تعديل" onClick={() => openEdit(brand)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {/* المورّد لا يحذف — الزر غائب عنه، والخادم يرفضه أيضًا. */}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="حذف"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm(`حذف "${brand.name}"؟`)) remove.mutate(brand);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل براند" : "إضافة براند"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الموقع الإلكتروني</Label>
              <Input dir="ltr" className="text-left" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>

            {isVendor && editing?.approvalStatus === "approved" && (
              <p className="rounded-md bg-amber-50 p-2 text-xs dark:bg-amber-950/30">
                التعديل هيرجّع البراند لانتظار الاعتماد تاني.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={save.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
