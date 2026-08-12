import { jsonOrThrow } from "@/lib/http";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Power, Search } from "lucide-react";

const BASE = "/api";

type Company = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  subscriptionEndsAt: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  /** يكتبه موظف جديد عند التسجيل ليصل طلبه لأدمن هذه الشركة. */
  joinCode: string | null;
};

type Form = {
  name: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  subscriptionEndsAt: string;
  notes: string;
};

const EMPTY: Form = {
  name: "", phone: "", email: "", address: "",
  taxNumber: "", subscriptionEndsAt: "", notes: "",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

function SubscriptionCell({ value }: { value: string | null }) {
  const days = daysUntil(value);
  if (days === null) return <span className="text-muted-foreground">—</span>;
  if (days < 0) return <Badge variant="destructive">منتهي منذ {Math.abs(days)} يوم</Badge>;
  if (days <= 14) return <Badge className="bg-amber-500 hover:bg-amber-500">باقٍ {days} يوم</Badge>;
  return <span>{value}</span>;
}

export default function Companies() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: companies = [], isLoading, isError, error } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: () => fetch(`${BASE}/companies`, { credentials: "include" }).then(jsonOrThrow),
  });

  const save = useMutation({
    mutationFn: (payload: Form) => {
      const url = editing ? `${BASE}/companies/${editing.id}` : `${BASE}/companies`;
      return fetch(url, {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(jsonOrThrow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      toast({ title: editing ? "تم تعديل الشركة" : "تمت إضافة الشركة" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر الحفظ", description: err?.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (company: Company) =>
      fetch(`${BASE}/companies/${company.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !company.isActive }),
      }).then(jsonOrThrow),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "تم تغيير حالة الشركة" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر التغيير", description: err?.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    setForm({
      name: company.name,
      phone: company.phone ?? "",
      email: company.email ?? "",
      address: company.address ?? "",
      taxNumber: company.taxNumber ?? "",
      subscriptionEndsAt: company.subscriptionEndsAt ?? "",
      notes: company.notes ?? "",
    });
    setOpen(true);
  };

  const filtered = companies.filter((c) =>
    [c.name, c.phone, c.email].some((v) => (v ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  const activeCount = companies.filter((c) => c.isActive).length;

  return (
    <div dir="rtl" className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Building2 className="h-6 w-6" />
            الشركات
          </h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} شركة — {activeCount} نشطة
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة شركة
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو التليفون أو الإيميل"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="py-8 text-center text-muted-foreground">جاري التحميل...</p>}

          {isError && (
            <p className="py-8 text-center text-destructive">
              {(error as any)?.message || "تعذر تحميل الشركات."}
            </p>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p>لا توجد شركات بعد.</p>
              <p className="text-sm">اضغط "إضافة شركة" للبدء.</p>
            </div>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>كود الانضمام</TableHead>
                  <TableHead>التليفون</TableHead>
                  <TableHead>المستخدمون</TableHead>
                  <TableHead>الاشتراك</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((company) => (
                  <TableRow key={company.id} className={company.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    {/* يُملى على الموظف الجديد ليصل طلب تسجيله لأدمن هذه الشركة. */}
                    <TableCell>
                      {company.joinCode ? (
                        <button
                          type="button"
                          title="نسخ الكود"
                          onClick={() => {
                            navigator.clipboard?.writeText(company.joinCode!);
                            toast({ title: "تم نسخ كود الانضمام" });
                          }}
                          className="rounded bg-muted px-2 py-1 font-mono text-xs tracking-widest hover:bg-accent"
                        >
                          {company.joinCode}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right">{company.phone || "—"}</TableCell>
                    <TableCell>{company.userCount}</TableCell>
                    <TableCell><SubscriptionCell value={company.subscriptionEndsAt} /></TableCell>
                    <TableCell>
                      {company.isActive
                        ? <Badge variant="secondary">نشطة</Badge>
                        : <Badge variant="destructive">متوقفة</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="تعديل" onClick={() => openEdit(company)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={company.isActive ? "إيقاف" : "تشغيل"}
                          onClick={() => toggleActive.mutate(company)}
                        >
                          <Power className={`h-4 w-4 ${company.isActive ? "text-destructive" : "text-green-600"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل شركة" : "إضافة شركة"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>اسم الشركة *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>التليفون</Label>
                <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>الإيميل</Label>
                <Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الرقم الضريبي</Label>
                <Input dir="ltr" value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>نهاية الاشتراك</Label>
                <Input
                  type="date"
                  value={form.subscriptionEndsAt}
                  onChange={(e) => setForm({ ...form, subscriptionEndsAt: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => save.mutate(form)}
              disabled={!form.name.trim() || save.isPending}
            >
              {save.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
