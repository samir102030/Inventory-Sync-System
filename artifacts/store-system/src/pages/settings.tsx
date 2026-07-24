import { useState, useEffect, useRef } from "react";
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
import { Plus, Edit, Trash2, Check, X, Upload, Trash, Download, AlertTriangle, RotateCcw } from "lucide-react";
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
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    companyPhone: "",
    companyAddress: "",
    companyEmail: "",
    footerNote: "",
    taxRate: "",
    invoicePrefix: "",
    companyLogo: "",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.companyName,
        companyPhone: settings.companyPhone || "",
        companyAddress: settings.companyAddress || "",
        companyEmail: (settings as any).companyEmail || "",
        footerNote: (settings as any).footerNote || "",
        taxRate: settings.taxRate?.toString() || "0",
        invoicePrefix: settings.invoicePrefix || "INV-",
        companyLogo: (settings as any).companyLogo || "",
      });
    }
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "حجم الصورة كبير جداً", description: "يجب أن يكون أقل من 500 كيلوبايت", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(f => ({ ...f, companyLogo: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = () => {
    updateSettings.mutate({
      data: {
        companyName: formData.companyName,
        companyPhone: formData.companyPhone,
        companyAddress: formData.companyAddress,
        companyEmail: formData.companyEmail,
        footerNote: formData.footerNote,
        taxRate: parseFloat(formData.taxRate),
        invoicePrefix: formData.invoicePrefix,
        companyLogo: formData.companyLogo,
      } as any
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
          <CardDescription>هذه المعلومات ستظهر في طباعة الفواتير والـ PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="text-muted-foreground">جاري التحميل...</div>
          ) : (
            <>
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>شعار الشركة (Logo)</Label>
                <div className="flex items-center gap-4">
                  {formData.companyLogo ? (
                    <div className="relative group">
                      <img src={formData.companyLogo} alt="logo" className="h-20 max-w-[200px] object-contain border rounded-lg p-2 bg-gray-50" />
                      <button
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, companyLogo: "" }))}
                        className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-40 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center text-muted-foreground text-xs text-center">
                      لا يوجد شعار
                    </div>
                  )}
                  <div className="space-y-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                      <Upload className="h-4 w-4 ml-1" />
                      {formData.companyLogo ? "تغيير الشعار" : "رفع شعار"}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG أو JPG — أقل من 500 KB</p>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">اسم الشركة</Label>
                  <Input id="companyName" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">رقم الهاتف</Label>
                  <Input id="companyPhone" value={formData.companyPhone} onChange={e => setFormData({...formData, companyPhone: e.target.value})} dir="ltr" className="text-right" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">العنوان</Label>
                  <Input id="companyAddress" value={formData.companyAddress} onChange={e => setFormData({...formData, companyAddress: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">البريد الإلكتروني</Label>
                  <Input id="companyEmail" type="email" value={formData.companyEmail} onChange={e => setFormData({...formData, companyEmail: e.target.value})} dir="ltr" className="text-right" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerNote">نص ذيل الفاتورة</Label>
                <Input id="footerNote" value={formData.footerNote} onChange={e => setFormData({...formData, footerNote: e.target.value})} placeholder="شكراً لتعاملكم معنا" />
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
      {user?.role === 'admin' && <BackupResetSection />}
    </div>
  );
}

function BackupResetSection() {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (file: File) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.exportedAt) throw new Error("ملف غير صالح");
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم استعادة النسخة الاحتياطية بنجاح — سيتم تحديث الصفحة" });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      toast({ title: e?.message === "ملف غير صالح" ? "الملف المختار ليس نسخة احتياطية صالحة" : "فشلت الاستعادة، تحقق من الملف وحاول مجدداً", variant: "destructive" });
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const handleBackup = async () => {
    try {
      const res = await fetch("/api/backup/export", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "تم تنزيل النسخة الاحتياطية بنجاح" });
    } catch {
      toast({ title: "فشل تنزيل النسخة الاحتياطية", variant: "destructive" });
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/backup/reset", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "تم إعادة ضبط النظام — سيتم تحديث الصفحة" });
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast({ title: "فشلت إعادة الضبط", variant: "destructive" });
    } finally {
      setResetting(false);
      setShowResetDialog(false);
      setConfirmText("");
    }
  };

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            النسخ الاحتياطي وإعادة الضبط
          </CardTitle>
          <CardDescription>نسّخ بياناتك أو امسح كل شيء وابدأ من جديد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Backup */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium">تنزيل نسخة احتياطية كاملة</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                ملف JSON يحتوي على جميع البيانات — منتجات، فواتير، عملاء، مصروفات، مشاريع، وأكثر
              </p>
            </div>
            <Button variant="outline" className="shrink-0 gap-2" onClick={handleBackup}>
              <Download className="h-4 w-4" />
              تنزيل Backup
            </Button>
          </div>

          {/* Restore */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium">استعادة من نسخة احتياطية</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                ارفع ملف JSON سبق تنزيله — سيتم مسح البيانات الحالية واستبدالها بالنسخة المحفوظة
              </p>
            </div>
            <div className="shrink-0">
              <Button
                variant="outline"
                className="gap-2"
                disabled={restoring}
                onClick={() => restoreInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {restoring ? "جارٍ الاستعادة..." : "رفع Backup"}
              </Button>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleRestore(f); }}
              />
            </div>
          </div>

          {/* Reset */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
            <div>
              <p className="font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                إعادة ضبط النظام بالكامل
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                يمسح كل البيانات نهائياً — منتجات، فواتير، عملاء، مخزون، مشاريع، إلخ.
                لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0 gap-2"
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw className="h-4 w-4" />
              إعادة الضبط
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={open => { setShowResetDialog(open); setConfirmText(""); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد إعادة الضبط الكامل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm space-y-1.5">
              <p className="font-semibold text-destructive">سيتم حذف الآتي نهائياً:</p>
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>جميع المنتجات والفئات</li>
                <li>جميع الفواتير وعروض الأسعار</li>
                <li>جميع العملاء والموردين</li>
                <li>جميع المصروفات والمشتريات</li>
                <li>جميع الحسابات والسندات</li>
                <li>جميع المشاريع والمستودعات</li>
                <li>جميع الموظفين والرواتب</li>
              </ul>
              <p className="font-medium mt-2">تبقى: حسابات المستخدمين وإعدادات الفاتورة</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                اكتب <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">إعادة ضبط</span> للتأكيد:
              </p>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                placeholder="اكتب: إعادة ضبط"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={confirmText !== "إعادة ضبط" || resetting}
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                {resetting ? "جارٍ المسح..." : "تأكيد إعادة الضبط"}
              </Button>
              <Button variant="outline" onClick={() => { setShowResetDialog(false); setConfirmText(""); }}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
