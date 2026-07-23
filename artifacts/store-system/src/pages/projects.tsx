import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Eye, Edit, Trash2, Link2, Unlink,
  FolderOpen, TrendingUp, TrendingDown, DollarSign, Wrench,
  X
} from "lucide-react";

const BASE = "/api";
const fetchJSON = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", ...opts }).then((r) => r.json());

type Project = {
  id: number;
  name: string;
  description?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  status: "active" | "completed" | "cancelled";
  installationCost: number;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  expenseCount: number;
  createdAt: string;
};

type ProjectDetail = Project & {
  customerPhone?: string | null;
  invoices: any[];
  expenses: any[];
};

type Customer = { id: number; name: string; phone?: string | null };
type Invoice = { id: number; invoiceNumber: string; total: number; createdAt: string; customerName?: string | null; status: string };
type Expense = { id: number; description: string; amount: number; date: string; category: string };

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function currency(n: number) {
  return `${n.toFixed(2)} ج.م`;
}

// ── Project Form ──────────────────────────────────────────────────────────────
function ProjectForm({
  project,
  customers,
  onClose,
}: {
  project?: Project | null;
  customers: Customer[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    customerId: project?.customerId ? String(project.customerId) : "",
    status: project?.status ?? "active",
    installationCost: project?.installationCost != null ? String(project.installationCost) : "0",
    startDate: project?.startDate ?? "",
    endDate: project?.endDate ?? "",
    notes: project?.notes ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetchJSON(project ? `${BASE}/projects/${project.id}` : `${BASE}/projects`, {
        method: project ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: project ? "تم تعديل المشروع" : "تم إنشاء المشروع" });
      onClose();
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    mutation.mutate({
      name: form.name,
      description: form.description || null,
      customerId: form.customerId ? Number(form.customerId) : null,
      status: form.status,
      installationCost: Number(form.installationCost) || 0,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      notes: form.notes || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>اسم المشروع *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>العميل</Label>
          <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v === "__none__" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="اختر عميل..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— بدون عميل —</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>الحالة</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>تكلفة التركيب (ج.م)</Label>
          <Input type="number" min="0" step="0.01" value={form.installationCost} onChange={(e) => setForm({ ...form, installationCost: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>تاريخ البدء</Label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>تاريخ الانتهاء</Label>
          <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>وصف</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>ملاحظات</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "جاري الحفظ..." : project ? "حفظ التعديلات" : "إنشاء المشروع"}
        </Button>
      </div>
    </form>
  );
}

// ── Link Invoices Dialog ──────────────────────────────────────────────────────
function LinkInvoicesDialog({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices-all"],
    queryFn: () => fetchJSON(`${BASE}/invoices`),
  });

  const linkedIds = new Set(project.invoices.map((i: any) => i.id));

  const filtered = allInvoices.filter((inv) => {
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customerName ?? "").toLowerCase().includes(q)
    );
  });

  const linkMutation = useMutation({
    mutationFn: ({ invoiceId, link }: { invoiceId: number; link: boolean }) =>
      fetchJSON(`${BASE}/projects/${project.id}/invoices/${invoiceId}`, {
        method: link ? "POST" : "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="بحث بالرقم أو العميل..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-80 overflow-y-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => {
              const isLinked = linkedIds.has(inv.id);
              return (
                <TableRow key={inv.id} className={isLinked ? "bg-blue-50" : ""}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.customerName ?? "—"}</TableCell>
                  <TableCell>{currency(Number(inv.total))}</TableCell>
                  <TableCell>{new Date(inv.createdAt).toLocaleDateString("ar-EG")}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isLinked ? "destructive" : "outline"}
                      className="gap-1"
                      disabled={linkMutation.isPending}
                      onClick={() => linkMutation.mutate({ invoiceId: inv.id, link: !isLinked })}
                    >
                      {isLinked ? <><Unlink className="h-3 w-3" /> فك الربط</> : <><Link2 className="h-3 w-3" /> ربط</>}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
}

// ── Link Expenses Dialog ──────────────────────────────────────────────────────
function LinkExpensesDialog({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: allExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses-all"],
    queryFn: () => fetchJSON(`${BASE}/expenses`),
  });

  const linkedIds = new Set(project.expenses.map((e: any) => e.id));

  const filtered = allExpenses.filter((exp) =>
    exp.description.toLowerCase().includes(search.toLowerCase())
  );

  const linkMutation = useMutation({
    mutationFn: ({ expenseId, link }: { expenseId: number; link: boolean }) =>
      fetchJSON(`${BASE}/projects/${project.id}/expenses/${expenseId}`, {
        method: link ? "POST" : "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="بحث بالوصف..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-80 overflow-y-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوصف</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((exp) => {
              const isLinked = linkedIds.has(exp.id);
              return (
                <TableRow key={exp.id} className={isLinked ? "bg-orange-50" : ""}>
                  <TableCell>{exp.description}</TableCell>
                  <TableCell>{exp.category}</TableCell>
                  <TableCell>{currency(Number(exp.amount))}</TableCell>
                  <TableCell>{exp.date}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isLinked ? "destructive" : "outline"}
                      className="gap-1"
                      disabled={linkMutation.isPending}
                      onClick={() => linkMutation.mutate({ expenseId: exp.id, link: !isLinked })}
                    >
                      {isLinked ? <><Unlink className="h-3 w-3" /> فك الربط</> : <><Link2 className="h-3 w-3" /> ربط</>}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────────
function ProjectDetailPanel({
  project: summary,
  onEdit,
  onClose,
}: {
  project: Project;
  onEdit: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [linkModal, setLinkModal] = useState<"invoices" | "expenses" | null>(null);

  const { data: detail, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["project", summary.id],
    queryFn: () => fetchJSON(`${BASE}/projects/${summary.id}`),
  });

  const unlinkInvoice = useMutation({
    mutationFn: (invoiceId: number) =>
      fetchJSON(`${BASE}/projects/${summary.id}/invoices/${invoiceId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", summary.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const unlinkExpense = useMutation({
    mutationFn: (expenseId: number) =>
      fetchJSON(`${BASE}/projects/${summary.id}/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", summary.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  if (isLoading || !detail) return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{detail.name}</h2>
          {detail.customerName && <p className="text-sm text-gray-500">{detail.customerName} {detail.customerPhone ? `· ${detail.customerPhone}` : ""}</p>}
          {detail.description && <p className="text-sm text-gray-600 mt-1">{detail.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[detail.status]}`}>{STATUS_LABELS[detail.status]}</span>
          <Button size="sm" variant="outline" onClick={onEdit}><Edit className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-1">إجمالي الإيرادات</p>
          <p className="font-bold text-blue-800">{currency(detail.totalRevenue)}</p>
          <p className="text-xs text-gray-500">{detail.invoices.length} فاتورة</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-xs text-orange-600 mb-1">إجمالي المصاريف</p>
          <p className="font-bold text-orange-800">{currency(detail.totalExpenses)}</p>
          <p className="text-xs text-gray-500">{detail.expenses.length} مصروف</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs text-purple-600 mb-1">تكلفة التركيب</p>
          <p className="font-bold text-purple-800">{currency(detail.installationCost)}</p>
        </div>
        <div className={`rounded-lg p-3 ${detail.netProfit >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className={`text-xs mb-1 ${detail.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>صافي الربح</p>
          <p className={`font-bold ${detail.netProfit >= 0 ? "text-green-800" : "text-red-800"}`}>{currency(detail.netProfit)}</p>
        </div>
      </div>

      <Separator />

      {/* Tabs for invoices and expenses */}
      <Tabs defaultValue="invoices">
        <div className="flex items-center justify-between mb-2">
          <TabsList>
            <TabsTrigger value="invoices">الفواتير ({detail.invoices.length})</TabsTrigger>
            <TabsTrigger value="expenses">المصاريف ({detail.expenses.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setLinkModal("invoices")}>
              <Link2 className="h-3 w-3" /> ربط فاتورة
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-orange-700 border-orange-300" onClick={() => setLinkModal("expenses")}>
              <Link2 className="h-3 w-3" /> ربط مصروف
            </Button>
          </div>
        </div>

        <TabsContent value="invoices">
          {detail.invoices.length === 0 ? (
            <p className="text-center text-gray-400 py-6">لا توجد فواتير مربوطة بهذا المشروع</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.customerName ?? "—"}</TableCell>
                      <TableCell className="font-medium">{currency(Number(inv.total))}</TableCell>
                      <TableCell>{new Date(inv.createdAt).toLocaleDateString("ar-EG")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                          onClick={() => unlinkInvoice.mutate(inv.id)}>
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses">
          {detail.expenses.length === 0 ? (
            <p className="text-center text-gray-400 py-6">لا توجد مصاريف مربوطة بهذا المشروع</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.expenses.map((exp: any) => (
                    <TableRow key={exp.id}>
                      <TableCell>{exp.description}</TableCell>
                      <TableCell>{exp.category}</TableCell>
                      <TableCell className="font-medium">{currency(Number(exp.amount))}</TableCell>
                      <TableCell>{exp.date}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                          onClick={() => unlinkExpense.mutate(exp.id)}>
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Notes */}
      {detail.notes && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border">
          <span className="font-medium">ملاحظات: </span>{detail.notes}
        </div>
      )}

      {/* Link Modals */}
      <Dialog open={linkModal === "invoices"} onOpenChange={(o) => !o && setLinkModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>ربط فاتورة بالمشروع</DialogTitle></DialogHeader>
          <LinkInvoicesDialog project={detail} onClose={() => setLinkModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={linkModal === "expenses"} onOpenChange={(o) => !o && setLinkModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>ربط مصروف بالمشروع</DialogTitle></DialogHeader>
          <LinkExpensesDialog project={detail} onClose={() => setLinkModal(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Projects() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetchJSON(`${BASE}/projects`),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => fetchJSON(`${BASE}/customers`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchJSON(`${BASE}/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (selectedProject) setSelectedProject(null);
      toast({ title: "تم حذف المشروع" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.customerName ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Summary stats
  const totalRevenue = projects.reduce((s, p) => s + p.totalRevenue, 0);
  const totalExpenses = projects.reduce((s, p) => s + p.totalExpenses + p.installationCost, 0);
  const totalProfit = projects.reduce((s, p) => s + p.netProfit, 0);
  const activeCount = projects.filter((p) => p.status === "active").length;

  function openEdit(p: Project) {
    setEditProject(p);
    setModal("edit");
  }

  function confirmDelete(p: Project) {
    if (window.confirm(`هل تريد حذف المشروع "${p.name}"؟ سيتم فك ارتباط الفواتير والمصاريف.`)) {
      deleteMutation.mutate(p.id);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المشاريع</h1>
          <p className="text-sm text-gray-500 mt-0.5">تتبع الفواتير والمصاريف وتكاليف التركيب لكل مشروع</p>
        </div>
        <Button className="gap-2" onClick={() => setModal("create")}>
          <Plus className="h-4 w-4" /> مشروع جديد
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">مشاريع نشطة</p>
              <p className="text-2xl font-bold text-blue-700">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
              <p className="text-lg font-bold text-green-700">{currency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-red-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">إجمالي التكاليف</p>
              <p className="text-lg font-bold text-red-700">{currency(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-purple-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">صافي الأرباح</p>
              <p className={`text-lg font-bold ${totalProfit >= 0 ? "text-purple-700" : "text-red-700"}`}>{currency(totalProfit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="بحث بالاسم أو العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main layout: list + detail */}
      <div className={`grid gap-6 ${selectedProject ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المشروع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإيرادات</TableHead>
                  <TableHead>التكاليف</TableHead>
                  <TableHead>صافي الربح</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400">لا توجد مشاريع</TableCell></TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${selectedProject?.id === p.id ? "bg-blue-50 border-r-2 border-r-blue-500" : "hover:bg-gray-50"}`}
                      onClick={() => setSelectedProject(p)}
                    >
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.customerName && <div className="text-xs text-gray-500">{p.customerName}</div>}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-green-700 font-medium">{currency(p.totalRevenue)}</TableCell>
                      <TableCell className="text-red-700">{currency(p.totalExpenses + p.installationCost)}</TableCell>
                      <TableCell className={`font-bold ${p.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {currency(p.netProfit)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={(e) => { e.stopPropagation(); confirmDelete(p); }}>
                            <Trash2 className="h-3 w-3" />
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

        {/* Detail Panel */}
        {selectedProject && (
          <Card>
            <CardContent className="p-4">
              <ProjectDetailPanel
                project={selectedProject}
                onEdit={() => openEdit(selectedProject)}
                onClose={() => setSelectedProject(null)}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={modal !== null} onOpenChange={(o) => { if (!o) { setModal(null); setEditProject(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modal === "edit" ? "تعديل المشروع" : "مشروع جديد"}</DialogTitle>
          </DialogHeader>
          <ProjectForm
            project={modal === "edit" ? editProject : null}
            customers={customers}
            onClose={() => { setModal(null); setEditProject(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
