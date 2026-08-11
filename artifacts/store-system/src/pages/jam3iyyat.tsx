import { jsonOrThrow } from "@/lib/http";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, Coins, Star, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

type Account = { id: number; name: string };
type Jam3iyya = {
  id: number;
  name: string;
  totalMembers: number;
  amountPerMember: number;
  myTurn: number;
  startDate: string;
  notes: string | null;
};
type Payment = {
  id: number;
  jam3iyyaId: number;
  month: string;
  amount: number;
  accountId: number | null;
  notes: string | null;
};

const fetchJam3iyyat = () => fetch("/api/jam3iyyat", { credentials: "include" }).then(jsonOrThrow);
const fetchPayments = (id: number) => fetch(`/api/jam3iyyat/${id}/payments`, { credentials: "include" }).then(jsonOrThrow);
const fetchAccounts = () => fetch("/api/accounts", { credentials: "include" }).then(jsonOrThrow);

const emptyJamForm = () => ({
  name: "", totalMembers: "", amountPerMember: "", myTurn: "",
  startDate: format(new Date(), "yyyy-MM-dd"), notes: "",
});

/** Which turn number corresponds to a given month index (1-based from startDate) */
function getTurnLabel(jam: Jam3iyya, monthIdx: number) {
  return ((monthIdx - 1) % jam.totalMembers) + 1;
}

/** Current month index from startDate (1 = first month) */
function currentMonthIndex(startDate: string) {
  const start = parseISO(startDate);
  const now = new Date();
  const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(1, diff + 1);
}

function monthLabel(monthStr: string) {
  try { return format(parseISO(`${monthStr}-01`), "MMMM yyyy", { locale: ar }); }
  catch { return monthStr; }
}

/* ─── Jam3iyya card ─── */
function Jam3iyyaCard({ jam, accounts, onEdit, onDelete }: { jam: Jam3iyya; accounts: Account[]; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [addPayOpen, setAddPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ month: format(new Date(), "yyyy-MM"), amount: String(jam.amountPerMember), accountId: accounts[0] ? String(accounts[0].id) : "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["jam3iyya-payments", jam.id],
    queryFn: () => fetchPayments(jam.id),
    enabled: expanded,
  });

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const potAmount = jam.amountPerMember * jam.totalMembers;
  const curIdx = currentMonthIndex(jam.startDate);
  const curTurn = getTurnLabel(jam, curIdx);
  const isMyMonthNow = curTurn === jam.myTurn;

  // Which month do I receive?
  const myReceiveMonth = addMonths(parseISO(jam.startDate), jam.myTurn - 1);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.month || !payForm.amount) { toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" }); return; }
    const res = await fetch(`/api/jam3iyyat/${jam.id}/payments`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: payForm.month, amount: parseFloat(payForm.amount), accountId: payForm.accountId ? Number(payForm.accountId) : null, notes: payForm.notes || null }),
    });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: "تم تسجيل الدفعة" });
    qc.invalidateQueries({ queryKey: ["jam3iyya-payments", jam.id] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    setAddPayOpen(false);
  };

  const handleDeletePayment = async (p: Payment) => {
    if (!confirm("حذف هذه الدفعة؟")) return;
    await fetch(`/api/jam3iyyat/payments/${p.id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "تم حذف الدفعة" });
    qc.invalidateQueries({ queryKey: ["jam3iyya-payments", jam.id] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  const accountName = (id: number | null) => accounts.find(a => a.id === id)?.name ?? "—";

  return (
    <Card className={isMyMonthNow ? "border-amber-400 shadow-md" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isMyMonthNow ? "bg-amber-100" : "bg-primary/10"}`}>
              <Coins className={`h-5 w-5 ${isMyMonthNow ? "text-amber-600" : "text-primary"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{jam.name}</CardTitle>
                {isMyMonthNow && (
                  <Badge className="bg-amber-500 text-white gap-1">
                    <Star className="h-3 w-3" /> شهرك هذا الشهر!
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {jam.totalMembers} أعضاء · {jam.amountPerMember.toLocaleString("ar-EG")} شهرياً · دورك رقم {jam.myTurn}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">قيمة الجمعية</p>
            <p className="font-bold text-sm">{potAmount.toLocaleString("ar-EG")}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">إجمالي دفعاتك</p>
            <p className="font-bold text-sm">{totalPaid.toLocaleString("ar-EG")}</p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> موعد دورك</p>
            <p className="font-bold text-sm text-green-700">{format(myReceiveMonth, "MMMM yyyy", { locale: ar })}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setAddPayOpen(true); setPayForm({ month: format(new Date(), "yyyy-MM"), amount: String(jam.amountPerMember), accountId: accounts[0] ? String(accounts[0].id) : "", notes: "" }); }}>
            <Plus className="h-4 w-4" /> تسجيل دفعة
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setExpanded(!expanded)}>
            {expanded ? <><ChevronUp className="h-4 w-4" /> إخفاء الدفعات</> : <><ChevronDown className="h-4 w-4" /> عرض الدفعات ({payments.length})</>}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الشهر</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الحساب</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">لا توجد دفعات مسجلة بعد</TableCell></TableRow>
                ) : payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{monthLabel(p.month)}</TableCell>
                    <TableCell className="text-red-600 font-medium">{p.amount.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{accountName(p.accountId)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeletePayment(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add payment dialog */}
      <Dialog open={addPayOpen} onOpenChange={setAddPayOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة — {jam.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4">
            <div className="space-y-1.5">
              <Label>الشهر *</Label>
              <Input type="month" value={payForm.month} onChange={e => setPayForm(f => ({ ...f, month: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input type="number" min="0" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required />
              <p className="text-xs text-muted-foreground">المبلغ الافتراضي = {jam.amountPerMember.toLocaleString("ar-EG")} — غيّره لو دفعت من أكثر من حساب</p>
            </div>
            <div className="space-y-1.5">
              <Label>الحساب / الخزينة</Label>
              <Select value={payForm.accountId} onValueChange={v => setPayForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input placeholder="مثال: دفعت نصف من الكاش ونصف من البنك" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">تسجيل الدفعة</Button>
              <Button type="button" variant="outline" onClick={() => setAddPayOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ─── Main page ─── */
export default function Jam3iyyat() {
  const [addOpen, setAddOpen] = useState(false);
  const [editingJam, setEditingJam] = useState<Jam3iyya | null>(null);
  const [jamForm, setJamForm] = useState(emptyJamForm());
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: jam3iyyat = [], isLoading } = useQuery<Jam3iyya[]>({ queryKey: ["jam3iyyat"], queryFn: fetchJam3iyyat });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: fetchAccounts });

  const openAdd = () => { setEditingJam(null); setJamForm(emptyJamForm()); setAddOpen(true); };
  const openEdit = (j: Jam3iyya) => {
    setEditingJam(j);
    setJamForm({ name: j.name, totalMembers: String(j.totalMembers), amountPerMember: String(j.amountPerMember), myTurn: String(j.myTurn), startDate: j.startDate, notes: j.notes ?? "" });
    setAddOpen(true);
  };

  const handleSubmitJam = async (e: React.FormEvent) => {
    e.preventDefault();
    const turn = Number(jamForm.myTurn);
    const total = Number(jamForm.totalMembers);
    if (turn < 1 || turn > total) { toast({ title: `رقم دورك يجب أن يكون بين 1 و ${total}`, variant: "destructive" }); return; }
    const body = { name: jamForm.name, totalMembers: total, amountPerMember: parseFloat(jamForm.amountPerMember), myTurn: turn, startDate: jamForm.startDate, notes: jamForm.notes || null };
    const url = editingJam ? `/api/jam3iyyat/${editingJam.id}` : "/api/jam3iyyat";
    const method = editingJam ? "PATCH" : "POST";
    const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: editingJam ? "تم تحديث الجمعية" : "تم إضافة الجمعية" });
    qc.invalidateQueries({ queryKey: ["jam3iyyat"] });
    setAddOpen(false);
  };

  const handleDeleteJam = async (j: Jam3iyya) => {
    if (!confirm(`حذف جمعية "${j.name}" وكل دفعاتها؟`)) return;
    await fetch(`/api/jam3iyyat/${j.id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "تم الحذف" });
    qc.invalidateQueries({ queryKey: ["jam3iyyat"] });
  };

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الجمعيات</h1>
            <p className="text-sm text-muted-foreground">تتبع دفعاتك ودورك في كل جمعية</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" /> إضافة جمعية
        </Button>
      </div>

      {/* Cards */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">جارٍ التحميل...</p>
      ) : jam3iyyat.length === 0 ? (
        <Card><CardContent className="text-center py-16 text-muted-foreground">
          <Coins className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">لا توجد جمعيات مسجلة بعد</p>
          <p className="text-sm mt-1">اضغط "إضافة جمعية" لتسجيل أول جمعية</p>
        </CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {jam3iyyat.map(j => (
            <Jam3iyyaCard key={j.id} jam={j} accounts={accounts} onEdit={() => openEdit(j)} onDelete={() => handleDeleteJam(j)} />
          ))}
        </div>
      )}

      {/* Add/Edit jam3iyya dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingJam ? "تعديل الجمعية" : "إضافة جمعية جديدة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitJam} className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم الجمعية *</Label>
              <Input placeholder="مثال: جمعية الشغل" value={jamForm.name} onChange={e => setJamForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>عدد الأعضاء *</Label>
                <Input type="number" min="2" placeholder="مثال: 12" value={jamForm.totalMembers} onChange={e => setJamForm(f => ({ ...f, totalMembers: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>المبلغ الشهري للعضو *</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={jamForm.amountPerMember} onChange={e => setJamForm(f => ({ ...f, amountPerMember: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>دورك (رقم شهرك) *</Label>
                <Input type="number" min="1" max={jamForm.totalMembers || 999} placeholder={`من 1 إلى ${jamForm.totalMembers || "؟"}`} value={jamForm.myTurn} onChange={e => setJamForm(f => ({ ...f, myTurn: e.target.value }))} required />
                <p className="text-xs text-muted-foreground">رقم الشهر اللي بتاخد فيه الجمعية</p>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ بداية الجمعية *</Label>
                <Input type="date" value={jamForm.startDate} onChange={e => setJamForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
            </div>
            {jamForm.totalMembers && jamForm.amountPerMember && jamForm.myTurn && jamForm.startDate && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                <p className="font-medium">ملخص الجمعية:</p>
                <p>• قيمة الجمعية الكاملة: <strong>{(Number(jamForm.totalMembers) * Number(jamForm.amountPerMember)).toLocaleString("ar-EG")}</strong></p>
                <p>• موعد دورك: <strong>{(() => { try { return format(addMonths(parseISO(jamForm.startDate), Number(jamForm.myTurn) - 1), "MMMM yyyy", { locale: ar }); } catch { return "—"; } })()}</strong></p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input placeholder="أي ملاحظات..." value={jamForm.notes} onChange={e => setJamForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">{editingJam ? "حفظ التعديلات" : "إضافة الجمعية"}</Button>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
