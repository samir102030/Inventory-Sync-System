import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Edit, Trash2, Link2, Unlink, X,
  FolderOpen, TrendingUp, TrendingDown, Wrench, FileText, FileCheck,
  ChevronLeft, AlertCircle,
} from "lucide-react";

const BASE = "/api";
const fetchJSON = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", ...opts }).then((r) => r.json());

// ── types ─────────────────────────────────────────────────────────────────────
type Project = {
  id: number; name: string; description?: string | null;
  customerId?: number | null; customerName?: string | null;
  status: "active" | "completed" | "cancelled";
  installationCost: number; maintenanceCost: number;
  startDate?: string | null; endDate?: string | null; notes?: string | null;
  totalRevenue: number; totalExpenses: number; netProfit: number;
  invoiceCount: number; expenseCount: number;
  totalQuotations: number; quotationCount: number;
  createdAt: string;
};
type ProjectDetail = Project & {
  customerPhone?: string | null;
  invoices: Invoice[]; expenses: Expense[]; quotations: Quotation[];
};
type Customer = { id: number; name: string; phone?: string | null };
type Invoice = { id: number; invoiceNumber: string; total: number; createdAt: string; status: string; projectId?: number | null };
type Expense = { id: number; description: string; amount: number; date: string; category: string; projectId?: number | null };
type Quotation = { id: number; quotationNumber: string; total: number; status: string; createdAt: string; customerName?: string | null; projectId?: number | null };

const STATUS_LABELS: Record<string, string> = { active: "نشط", completed: "مكتمل", cancelled: "ملغي" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 border border-blue-200",
  completed: "bg-green-100 text-green-700 border border-green-200",
  cancelled: "bg-red-100 text-red-700 border border-red-200",
};
const QUOT_STATUS: Record<string, string> = { draft: "مسودة", sent: "مُرسل", accepted: "مقبول", rejected: "مرفوض", expired: "منتهي", converted: "محوّل" };

function cur(n: number) { return `${Number(n).toFixed(2)} ج.م`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("ar-EG"); }

// ── Project Form ──────────────────────────────────────────────────────────────
function ProjectForm({ project, customers, onClose }: { project?: Project | null; customers: Customer[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    customerId: project?.customerId ? String(project.customerId) : "",
    status: project?.status ?? "active",
    installationCost: project?.installationCost != null ? String(project.installationCost) : "0",
    maintenanceCost:  project?.maintenanceCost  != null ? String(project.maintenanceCost)  : "0",
    startDate: project?.startDate ?? "",
    endDate:   project?.endDate   ?? "",
    notes: project?.notes ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => fetchJSON(
      project ? `${BASE}/projects/${project.id}` : `${BASE}/projects`,
      { method: project ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: project ? "تم تعديل المشروع" : "تم إنشاء المشروع" });
      onClose();
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    mutation.mutate({
      name: f.name, description: f.description || null,
      customerId: f.customerId ? Number(f.customerId) : null,
      status: f.status,
      installationCost: Number(f.installationCost) || 0,
      maintenanceCost:  Number(f.maintenanceCost)  || 0,
      startDate: f.startDate || null, endDate: f.endDate || null,
      notes: f.notes || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>اسم المشروع *</Label>
          <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required placeholder="مثال: تركيب كاميرات مبنى A" />
        </div>
        <div className="space-y-1">
          <Label>العميل</Label>
          <Select value={f.customerId} onValueChange={v => setF({ ...f, customerId: v === "__none__" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="اختر عميل..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— بدون عميل —</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>الحالة</Label>
          <Select value={f.status} onValueChange={v => setF({ ...f, status: v as any })}>
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
          <Input type="number" min="0" step="0.01" value={f.installationCost} onChange={e => setF({ ...f, installationCost: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>تكلفة الصيانة (ج.م)</Label>
          <Input type="number" min="0" step="0.01" value={f.maintenanceCost} onChange={e => setF({ ...f, maintenanceCost: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>تاريخ البدء</Label>
          <Input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>تاريخ الانتهاء</Label>
          <Input type="date" value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>وصف المشروع</Label>
          <Textarea rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="تفاصيل اختيارية..." />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>ملاحظات</Label>
          <Textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "جاري الحفظ..." : project ? "حفظ التعديلات" : "إنشاء المشروع"}
        </Button>
      </div>
    </form>
  );
}

// ── Link picker (generic) ─────────────────────────────────────────────────────
function LinkPicker({
  title, items, linkedIds, onLink, onUnlink, renderRow, headers, emptyMsg,
}: {
  title: string; items: any[]; linkedIds: Set<number>;
  onLink: (id: number) => void; onUnlink: (id: number) => void;
  renderRow: (item: any, linked: boolean) => React.ReactNode;
  headers: string[]; emptyMsg: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = items.filter(i =>
    Object.values(i).some(v => String(v ?? "").toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="space-y-3">
      <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">{items.length === 0 ? emptyMsg : "لا نتائج للبحث"}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>{headers.map(h => <TableHead key={h}>{h}</TableHead>)}<TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => {
                const linked = linkedIds.has(item.id);
                return (
                  <TableRow key={item.id} className={linked ? "bg-blue-50" : ""}>
                    {renderRow(item, linked)}
                    <TableCell className="w-24">
                      <Button size="sm" variant={linked ? "destructive" : "outline"} className="h-7 gap-1 text-xs"
                        onClick={() => linked ? onUnlink(item.id) : onLink(item.id)}>
                        {linked ? <><Unlink className="h-3 w-3" />فك</> : <><Link2 className="h-3 w-3" />ربط</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────────
function ProjectDetailPanel({ project: summary, onEdit, onClose }: {
  project: Project; onEdit: () => void; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [linkTab, setLinkTab] = useState<"invoices" | "quotations" | "expenses" | null>(null);
  const [invFilter, setInvFilter] = useState<"customer" | "all">("customer");
  const [quotFilter, setQuotFilter] = useState<"customer" | "all">("customer");

  const { data: detail, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["project", summary.id],
    queryFn: () => fetchJSON(`${BASE}/projects/${summary.id}`),
  });

  // customer-filtered lists
  const { data: custInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["project-cust-invoices", summary.id],
    queryFn: () => fetchJSON(`${BASE}/projects/${summary.id}/customer-invoices`),
    enabled: linkTab === "invoices",
  });
  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices-all"],
    queryFn: () => fetchJSON(`${BASE}/invoices`),
    enabled: linkTab === "invoices" && invFilter === "all",
  });
  const { data: custQuotations = [] } = useQuery<Quotation[]>({
    queryKey: ["project-cust-quotations", summary.id],
    queryFn: () => fetchJSON(`${BASE}/projects/${summary.id}/customer-quotations`),
    enabled: linkTab === "quotations",
  });
  const { data: allQuotations = [] } = useQuery<Quotation[]>({
    queryKey: ["quotations-all"],
    queryFn: () => fetchJSON(`${BASE}/quotations`),
    enabled: linkTab === "quotations" && quotFilter === "all",
  });
  const { data: allExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses-all"],
    queryFn: () => fetchJSON(`${BASE}/expenses`),
    enabled: linkTab === "expenses",
  });

  const invLink = useMutation({
    mutationFn: ({ id, link }: { id: number; link: boolean }) =>
      fetchJSON(`${BASE}/projects/${summary.id}/invoices/${id}`, { method: link ? "POST" : "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", summary.id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });
  const quotLink = useMutation({
    mutationFn: ({ id, link }: { id: number; link: boolean }) =>
      fetchJSON(`${BASE}/projects/${summary.id}/quotations/${id}`, { method: link ? "POST" : "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", summary.id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });
  const expLink = useMutation({
    mutationFn: ({ id, link }: { id: number; link: boolean }) =>
      fetchJSON(`${BASE}/projects/${summary.id}/expenses/${id}`, { method: link ? "POST" : "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", summary.id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  if (isLoading || !detail) return <div className="p-10 text-center text-gray-400 text-sm">جاري التحميل...</div>;

  const linkedInvIds   = new Set(detail.invoices.map(i => i.id));
  const linkedQuotIds  = new Set(detail.quotations.map(q => q.id));
  const linkedExpIds   = new Set(detail.expenses.map(e => e.id));
  const totalCosts = detail.installationCost + detail.maintenanceCost + detail.totalExpenses;

  return (
    <div className="space-y-4 h-full">
      {/* ── header ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight truncate">{detail.name}</h2>
          {detail.customerName && (
            <p className="text-sm text-gray-500">{detail.customerName}{detail.customerPhone ? ` · ${detail.customerPhone}` : ""}</p>
          )}
          {detail.description && <p className="text-xs text-gray-500 mt-0.5">{detail.description}</p>}
          {(detail.startDate || detail.endDate) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {detail.startDate ?? "—"} → {detail.endDate ?? "—"}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0 items-start">
          <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[detail.status]}`}>{STATUS_LABELS[detail.status]}</span>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onEdit}><Edit className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* ── financial summary ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-0.5">إجمالي الفواتير</p>
          <p className="font-bold text-blue-800 text-base">{cur(detail.totalRevenue)}</p>
          <p className="text-xs text-gray-400">{detail.invoices.length} فاتورة</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
          <p className="text-xs text-violet-600 mb-0.5">إجمالي العروض</p>
          <p className="font-bold text-violet-800 text-base">{cur(detail.totalQuotations)}</p>
          <p className="text-xs text-gray-400">{detail.quotations.length} عرض</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 col-span-2">
          <p className="text-xs text-orange-600 mb-1">تفصيلة التكاليف</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">مصاريف</p>
              <p className="font-medium text-orange-800">{cur(detail.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">تركيبات</p>
              <p className="font-medium text-orange-800">{cur(detail.installationCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">صيانة</p>
              <p className="font-medium text-orange-800">{cur(detail.maintenanceCost)}</p>
            </div>
          </div>
        </div>
        <div className={`col-span-2 rounded-lg p-3 border ${detail.netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center justify-between">
            <p className={`text-sm font-medium ${detail.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>صافي الربح</p>
            <p className={`text-xl font-bold ${detail.netProfit >= 0 ? "text-green-800" : "text-red-800"}`}>{cur(detail.netProfit)}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{cur(detail.totalRevenue)} إيرادات − {cur(totalCosts)} تكاليف</p>
        </div>
      </div>

      <Separator />

      {/* ── tabs ── */}
      <Tabs defaultValue="invoices" className="space-y-2">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="invoices">الفواتير ({detail.invoices.length})</TabsTrigger>
          <TabsTrigger value="quotations">عروض الأسعار ({detail.quotations.length})</TabsTrigger>
          <TabsTrigger value="expenses">المصاريف ({detail.expenses.length})</TabsTrigger>
        </TabsList>

        {/* ── Invoices tab ── */}
        <TabsContent value="invoices" className="space-y-2">
          <div className="flex justify-between items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
              onClick={() => setLinkTab(linkTab === "invoices" ? null : "invoices")}>
              <Link2 className="h-3 w-3" />{linkTab === "invoices" ? "إخفاء القائمة" : "إضافة فاتورة"}
            </Button>
          </div>

          {linkTab === "invoices" && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              {/* filter toggle */}
              <div className="flex gap-1 bg-white border rounded-md p-0.5 w-fit">
                <button
                  className={`text-xs px-3 py-1 rounded transition-colors ${invFilter === "customer" ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                  onClick={() => setInvFilter("customer")}
                  disabled={!detail.customerId}
                  title={!detail.customerId ? "لا يوجد عميل محدد" : ""}
                >
                  فواتير العميل
                </button>
                <button
                  className={`text-xs px-3 py-1 rounded transition-colors ${invFilter === "all" ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                  onClick={() => setInvFilter("all")}
                >
                  كل الفواتير
                </button>
              </div>

              <LinkPicker
                title="الفواتير"
                items={invFilter === "all" ? allInvoices : custInvoices}
                linkedIds={linkedInvIds}
                onLink={id => invLink.mutate({ id, link: true })}
                onUnlink={id => invLink.mutate({ id, link: false })}
                headers={["رقم الفاتورة", "العميل", "الإجمالي", "التاريخ"]}
                emptyMsg={invFilter === "customer" && !detail.customerId ? "حدد عميلاً للمشروع أولاً" : "لا توجد فواتير"}
                renderRow={(inv: any) => <>
                  <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-gray-600 text-xs">{inv.customerName ?? "—"}</TableCell>
                  <TableCell className="text-green-700 font-medium">{cur(Number(inv.total))}</TableCell>
                  <TableCell className="text-gray-500 text-xs">{fmtDate(inv.createdAt)}</TableCell>
                </>}
              />
            </div>
          )}

          {detail.invoices.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">لا توجد فواتير مربوطة</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>رقم الفاتورة</TableHead><TableHead>الإجمالي</TableHead><TableHead>التاريخ</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {detail.invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono font-medium text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-green-700 font-medium">{cur(Number(inv.total))}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{fmtDate(inv.createdAt)}</TableCell>
                      <TableCell className="w-8">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          onClick={() => invLink.mutate({ id: inv.id, link: false })}>
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

        {/* ── Quotations tab ── */}
        <TabsContent value="quotations" className="space-y-2">
          <div className="flex justify-between items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
              onClick={() => setLinkTab(linkTab === "quotations" ? null : "quotations")}>
              <Link2 className="h-3 w-3" />{linkTab === "quotations" ? "إخفاء القائمة" : "إضافة عرض"}
            </Button>
          </div>

          {linkTab === "quotations" && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              {/* filter toggle */}
              <div className="flex gap-1 bg-white border rounded-md p-0.5 w-fit">
                <button
                  className={`text-xs px-3 py-1 rounded transition-colors ${quotFilter === "customer" ? "bg-violet-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                  onClick={() => setQuotFilter("customer")}
                  disabled={!detail.customerId}
                  title={!detail.customerId ? "لا يوجد عميل محدد" : ""}
                >
                  عروض العميل
                </button>
                <button
                  className={`text-xs px-3 py-1 rounded transition-colors ${quotFilter === "all" ? "bg-violet-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                  onClick={() => setQuotFilter("all")}
                >
                  كل العروض
                </button>
              </div>

              <LinkPicker
                title="عروض الأسعار"
                items={quotFilter === "all" ? allQuotations : custQuotations}
                linkedIds={linkedQuotIds}
                onLink={id => quotLink.mutate({ id, link: true })}
                onUnlink={id => quotLink.mutate({ id, link: false })}
                headers={["رقم العرض", "العميل", "الإجمالي", "الحالة", "التاريخ"]}
                emptyMsg={quotFilter === "customer" && !detail.customerId ? "حدد عميلاً للمشروع أولاً" : "لا توجد عروض أسعار"}
                renderRow={(q: any) => <>
                  <TableCell className="font-mono font-medium text-sm">{q.quotationNumber}</TableCell>
                  <TableCell className="text-gray-600 text-xs">{q.customerName ?? "—"}</TableCell>
                  <TableCell className="text-violet-700 font-medium">{cur(Number(q.total))}</TableCell>
                  <TableCell className="text-xs">{QUOT_STATUS[q.status] ?? q.status}</TableCell>
                  <TableCell className="text-gray-500 text-xs">{fmtDate(q.createdAt)}</TableCell>
                </>}
              />
            </div>
          )}

          {detail.quotations.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">لا توجد عروض أسعار مربوطة</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>رقم العرض</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {detail.quotations.map(q => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono font-medium text-sm">{q.quotationNumber}</TableCell>
                      <TableCell className="text-violet-700 font-medium">{cur(Number(q.total))}</TableCell>
                      <TableCell className="text-xs">{QUOT_STATUS[q.status] ?? q.status}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{fmtDate(q.createdAt)}</TableCell>
                      <TableCell className="w-8">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          onClick={() => quotLink.mutate({ id: q.id, link: false })}>
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

        {/* ── Expenses tab ── */}
        <TabsContent value="expenses" className="space-y-2">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
              onClick={() => setLinkTab(linkTab === "expenses" ? null : "expenses")}>
              <Link2 className="h-3 w-3" />{linkTab === "expenses" ? "إخفاء" : "إضافة مصروف"}
            </Button>
          </div>

          {linkTab === "expenses" && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <LinkPicker
                title="المصاريف"
                items={allExpenses}
                linkedIds={linkedExpIds}
                onLink={id => expLink.mutate({ id, link: true })}
                onUnlink={id => expLink.mutate({ id, link: false })}
                headers={["الوصف", "المبلغ", "التاريخ"]}
                emptyMsg="لا توجد مصاريف مسجلة"
                renderRow={(exp, linked) => <>
                  <TableCell className="text-sm">{exp.description}</TableCell>
                  <TableCell className="text-orange-700 font-medium">{cur(exp.amount)}</TableCell>
                  <TableCell className="text-gray-500 text-xs">{exp.date}</TableCell>
                </>}
              />
            </div>
          )}

          {detail.expenses.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">لا توجد مصاريف مربوطة</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>الوصف</TableHead><TableHead>المبلغ</TableHead><TableHead>التاريخ</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {detail.expenses.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{exp.description}</TableCell>
                      <TableCell className="text-orange-700 font-medium">{cur(Number(exp.amount))}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{exp.date}</TableCell>
                      <TableCell className="w-8">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          onClick={() => expLink.mutate({ id: exp.id, link: false })}>
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

      {detail.notes && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border">
          <span className="font-medium text-gray-700">ملاحظات: </span>{detail.notes}
        </div>
      )}
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
      setSelectedProject(null);
      toast({ title: "تم حذف المشروع" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.customerName ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = projects.reduce((s, p) => s + p.totalRevenue, 0);
  const totalCosts   = projects.reduce((s, p) => s + p.totalExpenses + p.installationCost + p.maintenanceCost, 0);
  const totalProfit  = projects.reduce((s, p) => s + p.netProfit, 0);
  const activeCount  = projects.filter(p => p.status === "active").length;

  function openEdit(p: Project) { setEditProject(p); setModal("edit"); }
  function closeModal() { setModal(null); setEditProject(null); }
  function confirmDelete(p: Project) {
    if (window.confirm(`حذف المشروع "${p.name}"؟\nسيتم فك ارتباط الفواتير والمصاريف وعروض الأسعار.`)) {
      deleteMutation.mutate(p.id);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* ── page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المشاريع</h1>
          <p className="text-sm text-gray-500 mt-0.5">تتبع الفواتير وعروض الأسعار والمصاريف وتكاليف التركيب والصيانة لكل مشروع</p>
        </div>
        <Button className="gap-2" onClick={() => setModal("create")}>
          <Plus className="h-4 w-4" /> مشروع جديد
        </Button>
      </div>

      {/* ── summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-blue-500 shrink-0" />
            <div><p className="text-xs text-gray-500">مشاريع نشطة</p><p className="text-2xl font-bold text-blue-700">{activeCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500 shrink-0" />
            <div><p className="text-xs text-gray-500">إجمالي الإيرادات</p><p className="text-base font-bold text-green-700">{cur(totalRevenue)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-red-500 shrink-0" />
            <div><p className="text-xs text-gray-500">إجمالي التكاليف</p><p className="text-base font-bold text-red-700">{cur(totalCosts)}</p></div>
          </CardContent>
        </Card>
        <Card className={`${totalProfit >= 0 ? "border-purple-200 bg-purple-50/50" : "border-red-200 bg-red-50/50"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <Wrench className={`h-8 w-8 shrink-0 ${totalProfit >= 0 ? "text-purple-500" : "text-red-500"}`} />
            <div><p className="text-xs text-gray-500">صافي الأرباح</p><p className={`text-base font-bold ${totalProfit >= 0 ? "text-purple-700" : "text-red-700"}`}>{cur(totalProfit)}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* ── filters ── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="بحث بالاسم أو العميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── main layout ── */}
      <div className={`grid gap-4 ${selectedProject ? "grid-cols-1 xl:grid-cols-5" : "grid-cols-1"}`}>

        {/* Projects list */}
        <Card className={selectedProject ? "xl:col-span-2" : "col-span-1"}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المشروع</TableHead>
                  <TableHead>الحالة</TableHead>
                  {!selectedProject && <><TableHead>الإيرادات</TableHead><TableHead>التكاليف</TableHead></>}
                  <TableHead>صافي الربح</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-400">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-400">لا توجد مشاريع</TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer transition-colors ${selectedProject?.id === p.id ? "bg-blue-50 border-r-[3px] border-r-blue-500" : "hover:bg-gray-50"}`}
                    onClick={() => setSelectedProject(p.id === selectedProject?.id ? null : p)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm leading-tight">{p.name}</div>
                      {p.customerName && <div className="text-xs text-gray-400 mt-0.5">{p.customerName}</div>}
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.invoiceCount} فاتورة · {p.quotationCount} عرض · {p.expenseCount} مصروف
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                    </TableCell>
                    {!selectedProject && (
                      <>
                        <TableCell className="text-green-700 font-medium text-sm">{cur(p.totalRevenue)}</TableCell>
                        <TableCell className="text-red-700 text-sm">{cur(p.totalExpenses + p.installationCost + p.maintenanceCost)}</TableCell>
                      </>
                    )}
                    <TableCell className={`font-bold text-sm ${p.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {cur(p.netProfit)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={e => { e.stopPropagation(); openEdit(p); }}><Edit className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          onClick={e => { e.stopPropagation(); confirmDelete(p); }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selectedProject && (
          <Card className="xl:col-span-3 overflow-y-auto max-h-[75vh]">
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

      {/* Create / Edit dialog */}
      <Dialog open={modal !== null} onOpenChange={o => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === "edit" ? "تعديل المشروع" : "مشروع جديد"}</DialogTitle></DialogHeader>
          <ProjectForm project={modal === "edit" ? editProject : null} customers={customers} onClose={closeModal} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
