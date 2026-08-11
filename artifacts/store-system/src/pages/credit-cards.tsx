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
import {
  Plus, Edit, Trash2, ChevronDown, ChevronUp, Wallet,
  CheckCircle2, Clock, AlertCircle, CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, parseISO, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";

/* ── types ── */
type Account = { id: number; name: string };
type CCCard = { id: number; name: string; lastFour: string | null; creditLimit: number | null; billingDay: number | null; notes: string | null };
type CCTxn = {
  id: number; cardId: number; description: string; amount: number;
  transactionDate: string; dueDate: string; status: string;
  paidDate: string | null; accountId: number | null; notes: string | null;
};

const fetchCards = () => fetch("/api/credit-cards", { credentials: "include" }).then(jsonOrThrow);
const fetchTxns = (id: number) => fetch(`/api/credit-cards/${id}/transactions`, { credentials: "include" }).then(jsonOrThrow);
const fetchAccounts = () => fetch("/api/accounts", { credentials: "include" }).then(jsonOrThrow);

const emptyCard = () => ({ name: "", lastFour: "", creditLimit: "", billingDay: "", notes: "" });
const emptyTxn = (today: string) => ({ description: "", amount: "", transactionDate: today, dueDate: "", notes: "" });

function fmt(n: number) { return n.toLocaleString("ar-EG", { minimumFractionDigits: 2 }); }
function fmtDate(s: string) {
  try { return format(parseISO(s), "d MMMM yyyy", { locale: ar }); } catch { return s; }
}

function DueBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> مسدد</Badge>;
  const due = parseISO(dueDate);
  const days = differenceInDays(due, new Date());
  if (isPast(due) && !isToday(due)) return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> متأخر {Math.abs(days)} يوم</Badge>;
  if (days <= 5) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1"><Clock className="h-3 w-3" /> باقي {days} أيام</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> باقي {days} يوم</Badge>;
}

/* ── Card row ── */
function CardRow({ card, accounts, onEdit, onDelete }: {
  card: CCCard; accounts: Account[]; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payingTxn, setPayingTxn] = useState<CCTxn | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<CCTxn | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");
  const [txnForm, setTxnForm] = useState(emptyTxn(today));
  const [payForm, setPayForm] = useState({ paidDate: today, accountId: accounts[0] ? String(accounts[0].id) : "" });
  const [editTxnForm, setEditTxnForm] = useState({ description: "", amount: "", transactionDate: today, dueDate: "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: txns = [] } = useQuery<CCTxn[]>({
    queryKey: ["cc-txns", card.id],
    queryFn: () => fetchTxns(card.id),
    enabled: expanded,
  });

  const pending = txns.filter(t => t.status === "pending");
  const totalPending = pending.reduce((s, t) => s + t.amount, 0);
  const overdue = pending.filter(t => isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)));

  const accountName = (id: number | null) => accounts.find(a => a.id === id)?.name ?? "—";

  const addTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnForm.description || !txnForm.amount || !txnForm.dueDate) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" }); return;
    }
    const res = await fetch(`/api/credit-cards/${card.id}/transactions`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...txnForm, amount: parseFloat(txnForm.amount) }),
    });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: "تم تسجيل المسحوبة" });
    qc.invalidateQueries({ queryKey: ["cc-txns", card.id] });
    qc.invalidateQueries({ queryKey: ["credit-cards"] });
    setAddOpen(false);
    setTxnForm(emptyTxn(today));
  };

  const markPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingTxn) return;
    const res = await fetch(`/api/credit-cards/transactions/${payingTxn.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paidDate: payForm.paidDate, accountId: payForm.accountId ? Number(payForm.accountId) : null }),
    });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: "تم تسجيل السداد وخصم المبلغ من الحساب" });
    qc.invalidateQueries({ queryKey: ["cc-txns", card.id] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    setPayOpen(false);
  };

  const saveTxnEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    const res = await fetch(`/api/credit-cards/transactions/${editingTxn.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editTxnForm, amount: parseFloat(editTxnForm.amount) }),
    });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: "تم التعديل" });
    qc.invalidateQueries({ queryKey: ["cc-txns", card.id] });
    setEditOpen(false);
  };

  const deleteTxn = async (t: CCTxn) => {
    if (!confirm("حذف هذه المسحوبة؟")) return;
    await fetch(`/api/credit-cards/transactions/${t.id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "تم الحذف" });
    qc.invalidateQueries({ queryKey: ["cc-txns", card.id] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  const markUnpaid = async (t: CCTxn) => {
    await fetch(`/api/credit-cards/transactions/${t.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    toast({ title: "تم إعادة الحالة إلى غير مسدد" });
    qc.invalidateQueries({ queryKey: ["cc-txns", card.id] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  return (
    <Card className={overdue.length > 0 ? "border-red-300" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${overdue.length > 0 ? "bg-red-100" : "bg-primary/10"}`}>
              <CreditCard className={`h-5 w-5 ${overdue.length > 0 ? "text-red-600" : "text-primary"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{card.name}</CardTitle>
                {card.lastFour && <span className="text-sm text-muted-foreground font-mono">••••&nbsp;{card.lastFour}</span>}
                {overdue.length > 0 && <Badge variant="destructive" className="text-xs">{overdue.length} مسحوبات متأخرة</Badge>}
              </div>
              <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                {card.creditLimit && <span>الحد: {fmt(card.creditLimit)}</span>}
                {card.billingDay && <span>يوم الفاتورة: {card.billingDay}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المعلق</p>
            <p className={`font-bold text-sm ${totalPending > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(totalPending)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">مسحوبات معلقة</p>
            <p className="font-bold text-sm">{pending.length}</p>
          </div>
          <div className={`rounded-lg px-3 py-2 text-center ${overdue.length > 0 ? "bg-red-50 border border-red-200" : "bg-muted/50"}`}>
            <p className="text-xs text-muted-foreground">متأخرة السداد</p>
            <p className={`font-bold text-sm ${overdue.length > 0 ? "text-red-600" : ""}`}>{overdue.length}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setAddOpen(true); setTxnForm(emptyTxn(today)); }}>
            <Plus className="h-4 w-4" /> تسجيل مسحوبة
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setExpanded(!expanded)}>
            {expanded ? <><ChevronUp className="h-4 w-4" /> إخفاء</> : <><ChevronDown className="h-4 w-4" /> عرض المسحوبات</>}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">تاريخ السحب</TableHead>
                  <TableHead className="text-right">موعد السداد</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">سُدد من</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد مسحوبات مسجلة</TableCell></TableRow>
                ) : txns.map(t => (
                  <TableRow key={t.id} className={t.status === "pending" && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)) ? "bg-red-50/50" : ""}>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell className="font-bold text-red-600">{fmt(t.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(t.transactionDate)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(t.dueDate)}</TableCell>
                    <TableCell><DueBadge dueDate={t.dueDate} status={t.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.status === "paid" ? (accountName(t.accountId) + (t.paidDate ? ` · ${fmtDate(t.paidDate)}` : "")) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {t.status === "pending" && (
                          <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300 h-7 px-2 text-xs"
                            onClick={() => { setPayingTxn(t); setPayForm({ paidDate: today, accountId: accounts[0] ? String(accounts[0].id) : "" }); setPayOpen(true); }}>
                            <CheckCircle2 className="h-3 w-3" /> سداد
                          </Button>
                        )}
                        {t.status === "paid" && (
                          <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-2 text-xs" onClick={() => markUnpaid(t)}>
                            تراجع
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setEditingTxn(t);
                          setEditTxnForm({ description: t.description, amount: String(t.amount), transactionDate: t.transactionDate, dueDate: t.dueDate, notes: t.notes ?? "" });
                          setEditOpen(true);
                        }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTxn(t)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add transaction dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تسجيل مسحوبة — {card.name}</DialogTitle></DialogHeader>
          <form onSubmit={addTxn} className="space-y-4">
            <div className="space-y-1.5">
              <Label>الوصف / البيان *</Label>
              <Input placeholder="مثال: فاتورة موبايل، تسوق، سفر..." value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>تاريخ السحب *</Label>
                <Input type="date" value={txnForm.transactionDate} onChange={e => setTxnForm(f => ({ ...f, transactionDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>موعد السداد *</Label>
                <Input type="date" value={txnForm.dueDate} onChange={e => setTxnForm(f => ({ ...f, dueDate: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input placeholder="أي ملاحظات..." value={txnForm.notes} onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">تسجيل المسحوبة</Button>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />تسجيل سداد</DialogTitle></DialogHeader>
          {payingTxn && (
            <form onSubmit={markPaid} className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium">{payingTxn.description}</p>
                <p className="text-muted-foreground">المبلغ: <span className="font-bold text-red-600">{fmt(payingTxn.amount)}</span></p>
                <p className="text-muted-foreground">موعد السداد: {fmtDate(payingTxn.dueDate)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ السداد</Label>
                <Input type="date" value={payForm.paidDate} onChange={e => setPayForm(f => ({ ...f, paidDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>خصم من الحساب</Label>
                <Select value={payForm.accountId} onValueChange={v => setPayForm(f => ({ ...f, accountId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">سيُخصم المبلغ تلقائياً من الحساب المختار</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">تأكيد السداد</Button>
                <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit transaction dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تعديل المسحوبة</DialogTitle></DialogHeader>
          <form onSubmit={saveTxnEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>الوصف *</Label>
              <Input value={editTxnForm.description} onChange={e => setEditTxnForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input type="number" min="0" step="0.01" value={editTxnForm.amount} onChange={e => setEditTxnForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>تاريخ السحب</Label>
                <Input type="date" value={editTxnForm.transactionDate} onChange={e => setEditTxnForm(f => ({ ...f, transactionDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>موعد السداد</Label>
                <Input type="date" value={editTxnForm.dueDate} onChange={e => setEditTxnForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input value={editTxnForm.notes} onChange={e => setEditTxnForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">حفظ</Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ── Main page ── */
export default function CreditCards() {
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CCCard | null>(null);
  const [cardForm, setCardForm] = useState(emptyCard());
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cards = [], isLoading } = useQuery<CCCard[]>({ queryKey: ["credit-cards"], queryFn: fetchCards });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: fetchAccounts });

  const openAdd = () => { setEditingCard(null); setCardForm(emptyCard()); setAddCardOpen(true); };
  const openEdit = (c: CCCard) => {
    setEditingCard(c);
    setCardForm({ name: c.name, lastFour: c.lastFour ?? "", creditLimit: c.creditLimit ? String(c.creditLimit) : "", billingDay: c.billingDay ? String(c.billingDay) : "", notes: c.notes ?? "" });
    setAddCardOpen(true);
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: cardForm.name, lastFour: cardForm.lastFour || null, creditLimit: cardForm.creditLimit ? parseFloat(cardForm.creditLimit) : null, billingDay: cardForm.billingDay ? Number(cardForm.billingDay) : null, notes: cardForm.notes || null };
    const url = editingCard ? `/api/credit-cards/${editingCard.id}` : "/api/credit-cards";
    const res = await fetch(url, { method: editingCard ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast({ title: "حدث خطأ", variant: "destructive" }); return; }
    toast({ title: editingCard ? "تم تحديث الكارت" : "تم إضافة الكارت" });
    qc.invalidateQueries({ queryKey: ["credit-cards"] });
    setAddCardOpen(false);
  };

  const deleteCard = async (c: CCCard) => {
    if (!confirm(`حذف كارت "${c.name}" وكل مسحوباته؟`)) return;
    await fetch(`/api/credit-cards/${c.id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "تم الحذف" });
    qc.invalidateQueries({ queryKey: ["credit-cards"] });
  };

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مسحوبات الكريدت كارد</h1>
            <p className="text-sm text-muted-foreground">تسجيل المشتريات ومتابعة مواعيد السداد</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" /> إضافة كارت
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">جارٍ التحميل...</p>
      ) : cards.length === 0 ? (
        <Card><CardContent className="text-center py-16 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">لا توجد كروت مسجلة بعد</p>
          <p className="text-sm mt-1">اضغط "إضافة كارت" لتسجيل أول كارت</p>
        </CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map(c => (
            <CardRow key={c.id} card={c} accounts={accounts} onEdit={() => openEdit(c)} onDelete={() => deleteCard(c)} />
          ))}
        </div>
      )}

      {/* Add / Edit card dialog */}
      <Dialog open={addCardOpen} onOpenChange={setAddCardOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>{editingCard ? "تعديل الكارت" : "إضافة كريدت كارت"}</DialogTitle></DialogHeader>
          <form onSubmit={handleCardSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم الكارت / البنك *</Label>
              <Input placeholder="مثال: Visa CIB، MasterCard NBE" value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>آخر 4 أرقام</Label>
                <Input placeholder="مثال: 1234" maxLength={4} value={cardForm.lastFour} onChange={e => setCardForm(f => ({ ...f, lastFour: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div className="space-y-1.5">
                <Label>يوم الفاتورة الشهرية</Label>
                <Input type="number" min="1" max="31" placeholder="مثال: 15" value={cardForm.billingDay} onChange={e => setCardForm(f => ({ ...f, billingDay: e.target.value }))} />
                <p className="text-xs text-muted-foreground">اليوم اللي بتيجي فيه الفاتورة</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الحد الائتماني</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={cardForm.creditLimit} onChange={e => setCardForm(f => ({ ...f, creditLimit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input placeholder="أي ملاحظات..." value={cardForm.notes} onChange={e => setCardForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">{editingCard ? "حفظ التعديلات" : "إضافة الكارت"}</Button>
              <Button type="button" variant="outline" onClick={() => setAddCardOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
