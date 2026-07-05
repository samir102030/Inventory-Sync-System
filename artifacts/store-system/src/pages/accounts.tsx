import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Edit, X, Wallet, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Account = {
  id: number; name: string; type: string; color: string;
  initialBalance: number; totalIn: number; totalOut: number; balance: number; notes?: string | null; createdAt: string;
};
type Txn = {
  id: number; accountId: number; direction: string; amount: number;
  description: string; category?: string | null; date: string; reference?: string | null; createdAt: string;
};

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

const ACCOUNT_TYPES: Record<string, string> = { cash: "كاش", bank: "حساب بنكي", wallet: "محفظة إلكترونية", other: "أخرى" };
const ACCOUNT_TYPE_OPTIONS = [
  { value: "cash", label: "كاش" },
  { value: "bank", label: "حساب بنكي" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "other", label: "أخرى" },
];

const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6b7280"];

const TXN_CATEGORIES = [
  "مبيعات", "مشتريات", "مصروفات", "رواتب", "إيجار", "تحويل بين حسابات", "إيداع", "سحب", "أخرى"
];

export default function Accounts() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isAccountDialog, setIsAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isTxnDialog, setIsTxnDialog] = useState(false);
  const [txnDirection, setTxnDirection] = useState<"in" | "out">("in");
  const [isTransferDialog, setIsTransferDialog] = useState(false);

  const [accountForm, setAccountForm] = useState({ name: "", type: "cash", color: "#3b82f6", initialBalance: "", notes: "" });
  const [txnForm, setTxnForm] = useState({ amount: "", description: "", category: "", date: format(new Date(), "yyyy-MM-dd"), reference: "" });
  const [transferForm, setTransferForm] = useState({ fromAccountId: "", toAccountId: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => fetchJSON(`${BASE}/accounts`) });
  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null;

  const { data: transactions = [] } = useQuery<Txn[]>({
    queryKey: ["account-txns", selectedAccountId],
    queryFn: () => fetchJSON(`${BASE}/accounts/${selectedAccountId}/transactions`),
    enabled: !!selectedAccountId,
  });

  const createAccount = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/accounts`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم إضافة الحساب" }); qc.invalidateQueries({ queryKey: ["accounts"] }); setIsAccountDialog(false); resetAccountForm(); },
  });

  const updateAccount = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => fetch(`${BASE}/accounts/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تحديث الحساب" }); qc.invalidateQueries({ queryKey: ["accounts"] }); setIsAccountDialog(false); resetAccountForm(); },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/accounts/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف الحساب" }); qc.invalidateQueries({ queryKey: ["accounts"] }); if (selectedAccountId) setSelectedAccountId(null); },
  });

  const createTxn = useMutation({
    mutationFn: (data: object) => fetch(`${BASE}/accounts/transactions`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: txnDirection === "in" ? "تم تسجيل الوارد" : "تم تسجيل الصادر" });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-txns", selectedAccountId] });
      setIsTxnDialog(false);
      setTxnForm({ amount: "", description: "", category: "", date: format(new Date(), "yyyy-MM-dd"), reference: "" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteTxn = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/accounts/transactions/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["account-txns", selectedAccountId] }); },
  });

  const transferFunds = useMutation({
    mutationFn: async (data: { fromAccountId: number; toAccountId: number; amount: number; date: string; notes?: string }) => {
      const res = await fetch(`${BASE}/accounts/transfer`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      return json;
    },
    onSuccess: () => {
      toast({ title: "تم الترحيل بين الحسابات بنجاح" });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-txns"] });
      setIsTransferDialog(false);
      setTransferForm({ fromAccountId: "", toAccountId: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });
    },
    onError: (err: Error) => toast({ title: err.message || "حدث خطأ", variant: "destructive" }),
  });

  const resetAccountForm = () => { setAccountForm({ name: "", type: "cash", color: "#3b82f6", initialBalance: "", notes: "" }); setEditingAccount(null); };

  const openEditAccount = (a: Account) => {
    setEditingAccount(a);
    setAccountForm({ name: a.name, type: a.type, color: a.color, initialBalance: String(a.initialBalance), notes: a.notes ?? "" });
    setIsAccountDialog(true);
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: accountForm.name, type: accountForm.type, color: accountForm.color, initialBalance: parseFloat(accountForm.initialBalance || "0"), notes: accountForm.notes || undefined };
    if (editingAccount) updateAccount.mutate({ id: editingAccount.id, data });
    else createAccount.mutate(data);
  };

  const openTxnDialog = (dir: "in" | "out") => { setTxnDirection(dir); setIsTxnDialog(true); };

  const handleTxnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTxn.mutate({ accountId: selectedAccountId, direction: txnDirection, amount: parseFloat(txnForm.amount), description: txnForm.description, category: txnForm.category || undefined, date: txnForm.date, reference: txnForm.reference || undefined });
  };

  const openTransferDialog = () => {
    setTransferForm({
      fromAccountId: selectedAccountId ? String(selectedAccountId) : (accounts[0] ? String(accounts[0].id) : ""),
      toAccountId: "",
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
    setIsTransferDialog(true);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromAccountId || !transferForm.toAccountId) {
      toast({ title: "الرجاء اختيار الحساب المحوَّل منه والمحوَّل إليه", variant: "destructive" });
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toast({ title: "لا يمكن التحويل لنفس الحساب", variant: "destructive" });
      return;
    }
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) {
      toast({ title: "الرجاء إدخال مبلغ صحيح", variant: "destructive" });
      return;
    }
    transferFunds.mutate({
      fromAccountId: Number(transferForm.fromAccountId),
      toAccountId: Number(transferForm.toAccountId),
      amount: amt,
      date: transferForm.date,
      notes: transferForm.notes || undefined,
    });
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الخزينة والحسابات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إجمالي الأرصدة: <span className="font-bold text-green-600 text-base">{totalBalance.toFixed(2)} ج.م</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openTransferDialog} disabled={accounts.length < 2}>
            <ArrowLeftRight className="h-4 w-4 ml-2" />
            ترحيل بين الخزائن
          </Button>
          <Button onClick={() => { resetAccountForm(); setIsAccountDialog(true); }}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة حساب
          </Button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <p className="col-span-4 text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : accounts.length === 0 ? (
          <div className="col-span-4 flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Wallet className="h-12 w-12 opacity-30" />
            <p>لا توجد حسابات بعد. أضف حسابك الأول!</p>
          </div>
        ) : (
          accounts.map(account => (
            <Card
              key={account.id}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedAccountId === account.id ? "ring-2 ring-primary shadow-md" : ""}`}
              onClick={() => setSelectedAccountId(prev => prev === account.id ? null : account.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
                    <CardTitle className="text-base truncate">{account.name}</CardTitle>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAccount(account)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("حذف الحساب؟")) deleteAccount.mutate(account.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Badge variant="secondary" className="w-fit text-xs">{ACCOUNT_TYPES[account.type] || account.type}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold" style={{ color: account.balance >= 0 ? account.color : "#ef4444" }}>
                  {account.balance.toFixed(2)} ج.م
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ArrowDownCircle className="h-3 w-3 text-green-500" />
                    <span>وارد: {account.totalIn.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpCircle className="h-3 w-3 text-destructive" />
                    <span>صادر: {account.totalOut.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Transactions Panel */}
      {selectedAccount && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedAccount.color }} />
                <CardTitle>معاملات — {selectedAccount.name}</CardTitle>
                <span className="text-sm text-muted-foreground">الرصيد: <span className="font-bold" style={{ color: selectedAccount.color }}>{selectedAccount.balance.toFixed(2)} ج.م</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => openTxnDialog("in")}>
                  <ArrowDownCircle className="h-4 w-4 ml-1" />
                  وارد
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-red-50" onClick={() => openTxnDialog("out")}>
                  <ArrowUpCircle className="h-4 w-4 ml-1" />
                  صادر
                </Button>
                <Button size="sm" variant="outline" onClick={openTransferDialog} disabled={accounts.length < 2}>
                  <ArrowLeftRight className="h-4 w-4 ml-1" />
                  ترحيل
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAccountId(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>وارد</TableHead>
                  <TableHead>صادر</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-20 text-muted-foreground">لا توجد معاملات بعد</TableCell></TableRow>
                ) : (
                  transactions.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-sm">{format(new Date(txn.date), "yyyy/MM/dd")}</TableCell>
                      <TableCell className="font-medium">{txn.description}</TableCell>
                      <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{txn.category || "-"}</span></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{txn.reference || "-"}</TableCell>
                      <TableCell className="font-bold text-green-600">{txn.direction === "in" ? `${txn.amount.toFixed(2)} ج.م` : ""}</TableCell>
                      <TableCell className="font-bold text-destructive">{txn.direction === "out" ? `${txn.amount.toFixed(2)} ج.م` : ""}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("حذف المعاملة؟")) deleteTxn.mutate(txn.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Account Dialog */}
      <Dialog open={isAccountDialog} onOpenChange={open => { if (!open) { setIsAccountDialog(false); resetAccountForm(); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "تعديل الحساب" : "إضافة حساب جديد"}</DialogTitle>
            <DialogDescription>مثال: كاش، انستا باي، فودافون كاش، حساب الشركة</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الحساب *</Label>
              <Input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="مثال: فودافون كاش" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={accountForm.type} onValueChange={v => setAccountForm({ ...accountForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الرصيد الابتدائي (ج.م)</Label>
                <Input type="number" step="0.01" value={accountForm.initialBalance} onChange={e => setAccountForm({ ...accountForm, initialBalance: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>اللون</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setAccountForm({ ...accountForm, color: c })}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${accountForm.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={accountForm.color} onChange={e => setAccountForm({ ...accountForm, color: e.target.value })} className="h-8 w-8 rounded cursor-pointer border" title="لون مخصص" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input value={accountForm.notes} onChange={e => setAccountForm({ ...accountForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setIsAccountDialog(false); resetAccountForm(); }}>إلغاء</Button>
              <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={isTxnDialog} onOpenChange={open => { if (!open) setIsTxnDialog(false); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className={txnDirection === "in" ? "text-green-600" : "text-destructive"}>
              {txnDirection === "in" ? "⬇ تسجيل وارد" : "⬆ تسجيل صادر"} — {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>{txnDirection === "in" ? "مبلغ دخل للحساب" : "مبلغ خرج من الحساب"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTxnSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ج.م) *</Label>
                <Input type="number" min="0.01" step="0.01" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input type="date" value={txnForm.date} onChange={e => setTxnForm({ ...txnForm, date: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>البيان *</Label>
              <Input value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} placeholder="مثال: استلام دفعة من عميل" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التصنيف</Label>
                <Select value={txnForm.category} onValueChange={v => setTxnForm({ ...txnForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>{TXN_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رقم مرجعي</Label>
                <Input value={txnForm.reference} onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })} placeholder="رقم عملية / شيك..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTxnDialog(false)}>إلغاء</Button>
              <Button type="submit" disabled={createTxn.isPending}
                className={txnDirection === "in" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}>
                {createTxn.isPending ? "جاري الحفظ..." : txnDirection === "in" ? "تسجيل الوارد" : "تسجيل الصادر"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Between Accounts Dialog */}
      <Dialog open={isTransferDialog} onOpenChange={open => { if (!open) setIsTransferDialog(false); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              ترحيل بين الخزائن
            </DialogTitle>
            <DialogDescription>تحويل مبلغ من حساب إلى آخر مباشرة</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div className="space-y-2">
                <Label>من حساب *</Label>
                <Select value={transferForm.fromAccountId} onValueChange={v => setTransferForm({ ...transferForm, fromAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)} disabled={String(a.id) === transferForm.toAccountId}>
                        {a.name} ({a.balance.toFixed(2)} ج.م)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pb-2 text-muted-foreground">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <Label>إلى حساب *</Label>
                <Select value={transferForm.toAccountId} onValueChange={v => setTransferForm({ ...transferForm, toAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)} disabled={String(a.id) === transferForm.fromAccountId}>
                        {a.name} ({a.balance.toFixed(2)} ج.م)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ج.م) *</Label>
                <Input type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input type="date" value={transferForm.date} onChange={e => setTransferForm({ ...transferForm, date: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="سبب التحويل (اختياري)" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTransferDialog(false)}>إلغاء</Button>
              <Button type="submit" disabled={transferFunds.isPending}>
                {transferFunds.isPending ? "جاري الترحيل..." : "ترحيل"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
