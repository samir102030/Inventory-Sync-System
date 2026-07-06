import { useState, useEffect } from "react";
import { 
  useGetInvoiceSettings, 
  useUpdateInvoiceSettings,
  useGetUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useGetMe,
  getGetInvoiceSettingsQueryKey,
  getGetUsersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, UserInputRole } from "@workspace/api-client-react/src/generated/api.schemas";

function PendingApprovals({ pendingUsers }: { pendingUsers: User[] }) {
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleById, setRoleById] = useState<Record<number, UserInputRole>>({});

  if (pendingUsers.length === 0) return null;

  const handleApprove = (user: User) => {
    updateUser.mutate(
      { id: user.id, data: { status: "active", role: roleById[user.id] || "cashier" } },
      {
        onSuccess: () => {
          toast({ title: "تم قبول المستخدم" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        },
      }
    );
  };

  const handleReject = (user: User) => {
    if (confirm(`هل تريد رفض طلب ${user.name}؟`)) {
      deleteUser.mutate(
        { id: user.id },
        {
          onSuccess: () => {
            toast({ title: "تم رفض الطلب" });
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          },
        }
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>طلبات تسجيل بحساب جوجل</CardTitle>
        <CardDescription>بانتظار موافقتك قبل تفعيل الوصول للنظام</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>البريد الإلكتروني</TableHead>
              <TableHead>الصلاحية</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell dir="ltr" className="text-right">{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={roleById[user.id] || "cashier"}
                    onValueChange={(v) => setRoleById({ ...roleById, [user.id]: v as UserInputRole })}
                  >
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مدير النظام</SelectItem>
                      <SelectItem value="cashier">كاشير</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleApprove(user)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleReject(user)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ username: "", password: "", name: "", role: "cashier" as UserInputRole, phone: "" });

  const { data: users, isLoading } = useGetUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const activeUsers = users?.filter((u) => u.status !== "pending") ?? [];
  const pendingUsers = users?.filter((u) => u.status === "pending") ?? [];

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ username: user.username, password: "", name: user.name, role: user.role as UserInputRole, phone: user.phone || "" });
    } else {
      setEditingUser(null);
      setFormData({ username: "", password: "", name: "", role: "cashier", phone: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      username: formData.username,
      name: formData.name,
      role: formData.role,
      phone: formData.phone,
      ...(formData.password ? { password: formData.password } : {})
    };

    if (editingUser) {
      updateUser.mutate({ id: editingUser.id, data }, {
        onSuccess: () => {
          toast({ title: "تم تحديث المستخدم" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          setIsDialogOpen(false);
        }
      });
    } else {
      if (!formData.password) {
        toast({ title: "كلمة المرور مطلوبة", variant: "destructive" });
        return;
      }
      createUser.mutate({ data: data as any }, {
        onSuccess: () => {
          toast({ title: "تم إضافة المستخدم" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
      deleteUser.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم حذف المستخدم" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <PendingApprovals pendingUsers={pendingUsers} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>إدارة المستخدمين</CardTitle>
            <CardDescription>إضافة وتعديل صلاحيات النظام</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4 ml-2" />
            إضافة مستخدم
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>اسم المستخدم</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead>طريقة الدخول</TableHead>
                <TableHead>الصلاحية</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">جاري التحميل...</TableCell></TableRow>
              ) : (
                activeUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell dir="ltr" className="text-right">{user.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.loginMethod === "google" ? "secondary" : "outline"}>
                        {user.loginMethod === "google" ? "جوجل" : "كلمة مرور"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.role === 'admin' ? 'مدير النظام' : 'كاشير'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(user.id)}>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>اسم الدخول</Label>
                <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} dir="ltr" className="text-right" required />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور {editingUser && "(اتركها فارغة إذا لم ترد التغيير)"}</Label>
                <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} dir="ltr" className="text-right" required={!editingUser} />
              </div>
              <div className="space-y-2">
                <Label>الصلاحية</Label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v as UserInputRole})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">مدير النظام</SelectItem>
                    <SelectItem value="cashier">كاشير</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>حفظ</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}

export default function Settings() {
  const { data: settings, isLoading: settingsLoading } = useGetInvoiceSettings();
  const updateSettings = useUpdateInvoiceSettings();
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    companyName: "",
    companyPhone: "",
    companyAddress: "",
    taxRate: "",
    invoicePrefix: "",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.companyName,
        companyPhone: settings.companyPhone || "",
        companyAddress: settings.companyAddress || "",
        taxRate: settings.taxRate?.toString() || "0",
        invoicePrefix: settings.invoicePrefix || "INV-",
      });
    }
  }, [settings]);

  const handleSaveSettings = () => {
    updateSettings.mutate({
      data: {
        companyName: formData.companyName,
        companyPhone: formData.companyPhone,
        companyAddress: formData.companyAddress,
        taxRate: parseFloat(formData.taxRate),
        invoicePrefix: formData.invoicePrefix,
      }
    }, {
      onSuccess: () => {
        toast({ title: "تم حفظ الإعدادات" });
        queryClient.invalidateQueries({ queryKey: getGetInvoiceSettingsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>إعدادات الفاتورة والشركة</CardTitle>
          <CardDescription>هذه المعلومات ستظهر في طباعة الفواتير</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="text-muted-foreground">جاري التحميل...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">اسم الشركة</Label>
                  <Input id="companyName" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">رقم الهاتف</Label>
                  <Input id="companyPhone" value={formData.companyPhone} onChange={e => setFormData({...formData, companyPhone: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">العنوان</Label>
                <Input id="companyAddress" value={formData.companyAddress} onChange={e => setFormData({...formData, companyAddress: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">نسبة الضريبة (%)</Label>
                  <Input id="taxRate" type="number" step="0.1" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">بادئة الفاتورة</Label>
                  <Input id="invoicePrefix" value={formData.invoicePrefix} onChange={e => setFormData({...formData, invoicePrefix: e.target.value})} dir="ltr" className="text-right" />
                </div>
              </div>
              <Button className="mt-4" onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {user?.role === 'admin' && <UsersManagement />}
    </div>
  );
}
