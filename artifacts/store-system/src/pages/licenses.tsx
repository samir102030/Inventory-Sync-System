import { useState } from "react";
import { useGetLicenses, useCreateLicense, useUpdateLicense, useDeleteLicense, getGetLicensesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Download } from "lucide-react";
import { exportToExcel } from "@/lib/excel";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { License, LicenseInputStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Licenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [formData, setFormData] = useState({ name: "", licenseKey: "", vendor: "", expiryDate: format(new Date(), 'yyyy-MM-dd'), status: "active" as LicenseInputStatus, cost: "" });

  const { data: licenses, isLoading } = useGetLicenses();
  const createLicense = useCreateLicense();
  const updateLicense = useUpdateLicense();
  const deleteLicense = useDeleteLicense();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getStatusBadge = (license: any) => {
    const daysLeft = differenceInDays(new Date(license.expiryDate), new Date());
    
    if (license.status === 'expired' || daysLeft < 0) {
      return <Badge variant="destructive">منتهية</Badge>;
    }
    if (daysLeft <= 30) {
      return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">تشارف على الانتهاء ({daysLeft} يوم)</Badge>;
    }
    return <Badge className="bg-green-500 hover:bg-green-600">سارية</Badge>;
  };

  const handleOpenDialog = (license?: License) => {
    if (license) {
      setEditingLicense(license);
      setFormData({
        name: license.name,
        licenseKey: license.licenseKey,
        vendor: license.vendor || "",
        expiryDate: license.expiryDate,
        status: license.status as LicenseInputStatus,
        cost: license.cost?.toString() || "",
      });
    } else {
      setEditingLicense(null);
      setFormData({ name: "", licenseKey: "", vendor: "", expiryDate: format(new Date(), 'yyyy-MM-dd'), status: "active", cost: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      licenseKey: formData.licenseKey,
      vendor: formData.vendor || undefined,
      expiryDate: formData.expiryDate,
      status: formData.status,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
    };

    if (editingLicense) {
      updateLicense.mutate({ id: editingLicense.id, data }, {
        onSuccess: () => {
          toast({ title: "تم تحديث الرخصة" });
          queryClient.invalidateQueries({ queryKey: getGetLicensesQueryKey() });
          setIsDialogOpen(false);
        }
      });
    } else {
      createLicense.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "تم إضافة الرخصة" });
          queryClient.invalidateQueries({ queryKey: getGetLicensesQueryKey() });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذه الرخصة؟")) {
      deleteLicense.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم حذف الرخصة" });
          queryClient.invalidateQueries({ queryKey: getGetLicensesQueryKey() });
        }
      });
    }
  };

  const handleExport = () => {
    const rows = (licenses ?? []).map(l => [l.name, l.licenseKey, l.vendor ?? "", l.expiryDate, l.status, l.cost ?? ""]);
    exportToExcel(["الاسم","المفتاح","المورد","تاريخ الانتهاء","الحالة","التكلفة"], rows, "licenses", "رخص البرمجيات");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">رخص البرمجيات</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
          <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4 ml-2" />إضافة رخصة</Button>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البرنامج / النظام</TableHead>
                <TableHead>مفتاح الرخصة</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : licenses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">لا توجد رخص</TableCell>
                </TableRow>
              ) : (
                licenses?.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell className="font-medium">{license.name}</TableCell>
                    <TableCell className="font-mono text-sm">{license.licenseKey}</TableCell>
                    <TableCell>{license.vendor || '-'}</TableCell>
                    <TableCell>{format(new Date(license.expiryDate), 'yyyy/MM/dd')}</TableCell>
                    <TableCell>{getStatusBadge(license)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(license)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(license.id)}>
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
            <DialogTitle>{editingLicense ? "تعديل رخصة" : "إضافة رخصة جديدة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>البرنامج / النظام</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>مفتاح الرخصة</Label>
              <Input value={formData.licenseKey} onChange={e => setFormData({...formData, licenseKey: e.target.value})} dir="ltr" className="text-right font-mono" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المورد</Label>
                <Input value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as LicenseInputStatus})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">سارية</SelectItem>
                    <SelectItem value="expired">منتهية</SelectItem>
                    <SelectItem value="cancelled">ملغاة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التكلفة (اختياري)</Label>
                <Input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createLicense.isPending || updateLicense.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
