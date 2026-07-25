import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Edit, X, Wallet, ArrowLeftRight, Download, Upload, Building, Pencil, Pin, PinOff } from "lucide-react";
import { exportToExcel, parseExcelFile } from "@/lib/excel";
import * as XLSX from "@e965/xlsx";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Account = {
  id: number; name: string; type: string; color: string;
  initialBalance: number; totalIn: number; totalOut: number; balance: number;
  notes?: string | null; pinned: boolean; createdAt: string;
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

type Bank = {
  id: number; name: string; accountNumber?: string; accountName?: string;
  branch?: string; balance: number; notes?: string; createdAt: string;
};
type BankForm = { name: string; accountNumber: string; accountName: string; branch: string; balance: string; notes: string; };
const emptyBank: BankForm = { name: "", accountNumber: "", accountName: "", branch: "", balance: "0", notes: "" };
const BANK_FIELD_LABELS: Record<string, string> = {
  name: "اسم البنك *", accountNumber: "رقم الحساب", accountName: "اسم الحساب", branch: "الفرع", balance: "الرصيد", notes: "ملاحظات",
};

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

  // Accounts import state
  const [accImportOpen, setAccImportOpen] = useState(false);
  const [accMappingOpen, setAccMappingOpen] = useState(false);
  const [accExcelHeaders, setAccExcelHeaders] = useState<string[]>([]);
  const [accExcelRows, setAccExcelRows] = useState<string[][]>([]);
  const [accMapping, setAccMapping] = useState<Record<string, string>>({});
  const accFileRef = useRef<HTMLInputElement>(null);

  // Banks state
  const [bankOpen, setBankOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankForm, setBankForm] = useState<BankForm>(emptyBank);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [bankMappingOpen, setBankMappingOpen] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const bankFileRef = useRef<HTMLInputElement>(null);

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

  // ── Toggle pin mutation ──
  const togglePin = useMutation({
    mutationFn: (account: Account) =>
      fetch(`${BASE}/accounts/${account.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !account.pinned }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  // ── Accounts bulk import mutation ──
  const importAccounts = useMutation({
    mutationFn: async (rows: object[]) => {
      const r = await fetch(`${BASE}/accounts/bulk-import`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accounts: rows }) });
      if (!r.ok) throw new Error("فشل الاستيراد");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setAccMappingOpen(false); setAccImportOpen(false);
      toast({ title: `تم الاستيراد: ${data.created} حساب${data.skipped ? ` (تخطي ${data.skipped})` : ""}` });
    },
    onError: () => toast({ title: "فشل الاستيراد", variant: "destructive" }),
  });

  // ── Banks queries & mutations ──
  const { data: banks = [], isLoading: banksLoading } = useQuery<Bank[]>({
    queryKey: ["banks"],
    queryFn: () => fetchJSON(`${BASE}/banks`),
  });

  const saveBank = useMutation({
    mutationFn: async (form: BankForm) => {
      const url = editingBank ? `${BASE}/banks/${editingBank.id}` : `${BASE}/banks`;
      const r = await fetch(url, { method: editingBank ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, balance: Number(form.balance) || 0 }) });
      if (!r.ok) throw new Error("فشل الحفظ");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["banks"] }); setBankOpen(false); toast({ title: editingBank ? "تم التعديل" : "تمت الإضافة" }); },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteBank = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/banks/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["banks"] }); toast({ title: "تم الحذف" }); },
  });

  const importBanks = useMutation({
    mutationFn: async (rows: object[]) => {
      const r = await fetch(`${BASE}/banks/bulk-import`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banks: rows }) });
      if (!r.ok) throw new Error("فشل الاستيراد");
      return r.json();
    },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["banks"] }); setBankMappingOpen(false); setBankImportOpen(false); toast({ title: `تم الاستيراد: ${data.created} بنك${data.skipped ? ` (تخطي ${data.skipped})` : ""}` }); },
    onError: () => toast({ title: "فشل الاستيراد", variant: "destructive" }),
  });

  function openAddBank() { setEditingBank(null); setBankForm(emptyBank); setBankOpen(true); }
  function openEditBank(b: Bank) { setEditingBank(b); setBankForm({ name: b.name, accountNumber: b.accountNumber || "", accountName: b.accountName || "", branch: b.branch || "", balance: String(b.balance), notes: b.notes || "" }); setBankOpen(true); }

  function downloadBankTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اسم البنك", "رقم الحساب", "اسم الحساب", "الفرع", "الرصيد", "ملاحظات"],
      ["بنك مصر", "1234567890", "شركة المثال", "فرع وسط البلد", "50000", ""],
      ["البنك الأهلي", "0987654321", "أحمد محمد", "فرع المعادي", "0", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "البنوك");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "نموذج_البنوك.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBankFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    try {
      const { headers, rows } = await parseExcelFile(file);
      setExcelHeaders(headers); setExcelRows(rows);
      const autoMap: Record<string, string> = {};
      Object.keys(BANK_FIELD_LABELS).forEach(f => {
        const match = headers.find(h => {
          if (f === "name") return /اسم البنك|اسم|name/i.test(h);
          if (f === "accountNumber") return /رقم الحساب|رقم|account.?number/i.test(h);
          if (f === "accountName") return /اسم الحساب|account.?name/i.test(h);
          if (f === "branch") return /فرع|branch/i.test(h);
          if (f === "balance") return /رصيد|balance/i.test(h);
          if (f === "notes") return /ملاحظات|notes/i.test(h);
          return false;
        });
        if (match) autoMap[f] = match;
      });
      setMapping(autoMap); setBankImportOpen(false); setBankMappingOpen(true);
    } catch { toast({ title: "تعذر قراءة الملف", variant: "destructive" }); }
  }

  function confirmBankImport() {
    if (!mapping.name) { toast({ title: "يجب تحديد عمود اسم البنك", variant: "destructive" }); return; }
    const rows = excelRows.map(row => ({
      name: row[excelHeaders.indexOf(mapping.name)] || "",
      accountNumber: mapping.accountNumber ? row[excelHeaders.indexOf(mapping.accountNumber)] : undefined,
      accountName: mapping.accountName ? row[excelHeaders.indexOf(mapping.accountName)] : undefined,
      branch: mapping.branch ? row[excelHeaders.indexOf(mapping.branch)] : undefined,
      balance: mapping.balance ? Number(row[excelHeaders.indexOf(mapping.balance)]) || 0 : 0,
      notes: mapping.notes ? row[excelHeaders.indexOf(mapping.notes)] : undefined,
    }));
    importBanks.mutate(rows);
  }

  // ── Accounts import helpers ──
  const ACC_FIELD_LABELS: Record<string, string> = {
    name: "اسم الحساب *", type: "النوع", initialBalance: "الرصيد الابتدائي", notes: "ملاحظات",
  };

  function downloadAccountTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اسم الحساب", "النوع", "الرصيد الابتدائي", "ملاحظات"],
      ["فودافون كاش", "wallet", "5000", ""],
      ["بنك القاهرة", "bank", "20000", "الحساب الرئيسي"],
      ["الخزينة الرئيسية", "cash", "10000", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الحسابات");
    // add notes sheet explaining types
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["قيم النوع المقبولة:"],
      ["cash", "كاش"],
      ["bank", "حساب بنكي"],
      ["wallet", "محفظة إلكترونية"],
      ["other", "أخرى"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, "قيم النوع");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "نموذج_الحسابات.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAccountFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    try {
      const { headers, rows } = await parseExcelFile(file);
      setAccExcelHeaders(headers); setAccExcelRows(rows);
      const auto: Record<string, string> = {};
      headers.forEach(h => {
        if (/اسم الحساب|اسم|name/i.test(h)) auto.name = h;
        else if (/نوع|type/i.test(h)) auto.type = h;
        else if (/رصيد|balance/i.test(h)) auto.initialBalance = h;
        else if (/ملاحظات|notes/i.test(h)) auto.notes = h;
      });
      setAccMapping(auto);
      setAccImportOpen(false); setAccMappingOpen(true);
    } catch { toast({ title: "تعذر قراءة الملف", variant: "destructive" }); }
  }

  function confirmAccountImport() {
    if (!accMapping.name) { toast({ title: "يجب تحديد عمود اسم الحساب", variant: "destructive" }); return; }
    const rows = accExcelRows.map(row => ({
      name: row[accExcelHeaders.indexOf(accMapping.name)] || "",
      type: accMapping.type ? row[accExcelHeaders.indexOf(accMapping.type)] : "cash",
      initialBalance: accMapping.initialBalance ? Number(row[accExcelHeaders.indexOf(accMapping.initialBalance)]) || 0 : 0,
      notes: accMapping.notes ? row[accExcelHeaders.indexOf(accMapping.notes)] : undefined,
    }));
    importAccounts.mutate(rows);
  }

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
  const totalBankBalance = banks.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">الخزينة والحسابات</h1>

      <Tabs defaultValue="accounts" dir="rtl">
        <TabsList>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> الخزائن والحسابات
          </TabsTrigger>
          <TabsTrigger value="banks" className="flex items-center gap-2">
            <Building className="h-4 w-4" /> البنوك
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════ TAB: الخزائن ═══════════════ */}
        <TabsContent value="accounts" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              إجمالي الأرصدة: <span className="font-bold text-green-600 text-base">{totalBalance.toFixed(2)} ج.م</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadAccountTemplate}>
                <Download className="h-4 w-4 ml-1" />تحميل نموذج
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAccImportOpen(true)}>
                <Upload className="h-4 w-4 ml-1" />استيراد Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => { const rows = accounts.map(a => [a.name, ACCOUNT_TYPES[a.type] ?? a.type, a.initialBalance, a.totalIn, a.totalOut, a.balance, a.notes ?? ""]); exportToExcel(["الاسم","النوع","الرصيد الأولي","إجمالي الوارد","إجمالي الصادر","الرصيد الحالي","ملاحظات"], rows, "accounts", "الحسابات"); }}>
                <Download className="h-4 w-4 ml-1" />تصدير Excel
              </Button>
              <Button variant="outline" size="sm" onClick={openTransferDialog} disabled={accounts.length < 2}>
                <ArrowLeftRight className="h-4 w-4 ml-1" />ترحيل بين الخزائن
              </Button>
              <Button size="sm" onClick={() => { resetAccountForm(); setIsAccountDialog(true); }}>
                <Plus className="h-4 w-4 ml-1" />إضافة حساب
              </Button>
            </div>
            <input ref={accFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleAccountFile} />
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
          [...accounts].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map(account => (
            <Card
              key={account.id}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedAccountId === account.id ? "ring-2 ring-primary shadow-md" : ""} ${account.pinned ? "border-amber-400 dark:border-amber-500" : ""}`}
              onClick={() => setSelectedAccountId(prev => prev === account.id ? null : account.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
                    <CardTitle className="text-base truncate">{account.name}</CardTitle>
                    {account.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="icon"
                      className={`h-7 w-7 ${account.pinned ? "text-amber-500" : "text-muted-foreground"}`}
                      title={account.pinned ? "إلغاء التثبيت" : "تثبيت الحساب"}
                      onClick={() => togglePin.mutate(account)}
                    >
                      {account.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    </Button>
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

      {/* ── Accounts Import Dialog ── */}
      <Dialog open={accImportOpen} onOpenChange={setAccImportOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>استيراد الحسابات من Excel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اختر ملف Excel يحتوي على بيانات الحسابات. يمكنك تحميل النموذج أولاً للتعرف على الأعمدة المطلوبة.</p>
            <Button variant="outline" className="w-full" onClick={downloadAccountTemplate}>
              <Download className="h-4 w-4 ml-2" />تحميل النموذج أولاً
            </Button>
            <Button className="w-full" onClick={() => accFileRef.current?.click()}>
              <Upload className="h-4 w-4 ml-2" />اختيار ملف Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Accounts Mapping Dialog ── */}
      <Dialog open={accMappingOpen} onOpenChange={setAccMappingOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>ربط الأعمدة ({accExcelRows.length} صف)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">حدد الأعمدة في الملف المقابلة لكل حقل.</p>
            {Object.keys(ACC_FIELD_LABELS).map(f => (
              <div key={f} className="flex items-center gap-3">
                <Label className="w-36 shrink-0 text-sm">{ACC_FIELD_LABELS[f]}</Label>
                <select
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-background"
                  value={accMapping[f] || ""}
                  onChange={e => setAccMapping(m => ({ ...m, [f]: e.target.value }))}
                >
                  <option value="">— تجاهل —</option>
                  {accExcelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            {accMapping.type && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                قيم النوع المقبولة: <span className="font-mono">cash · bank · wallet · other</span>
              </p>
            )}
            {accExcelRows.length > 0 && accMapping.name && (
              <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground mb-1">معاينة أول صف:</p>
                {Object.entries(accMapping).filter(([, v]) => v).map(([f, col]) => (
                  <p key={f}><span className="text-muted-foreground">{ACC_FIELD_LABELS[f]}: </span>{accExcelRows[0]?.[accExcelHeaders.indexOf(col)] ?? "—"}</p>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => { setAccMappingOpen(false); setAccImportOpen(true); }}>رجوع</Button>
            <Button onClick={confirmAccountImport} disabled={importAccounts.isPending}>
              {importAccounts.isPending ? "جاري الاستيراد..." : `استيراد ${accExcelRows.length} صف`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" />ترحيل بين الخزائن</DialogTitle>
            <DialogDescription>تحويل مبلغ من حساب إلى آخر مباشرة</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div className="space-y-2">
                <Label>من حساب *</Label>
                <Select value={transferForm.fromAccountId} onValueChange={v => setTransferForm({ ...transferForm, fromAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)} disabled={String(a.id) === transferForm.toAccountId}>{a.name} ({a.balance.toFixed(2)} ج.م)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="pb-2 text-muted-foreground"><ArrowLeftRight className="h-5 w-5" /></div>
              <div className="space-y-2">
                <Label>إلى حساب *</Label>
                <Select value={transferForm.toAccountId} onValueChange={v => setTransferForm({ ...transferForm, toAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)} disabled={String(a.id) === transferForm.fromAccountId}>{a.name} ({a.balance.toFixed(2)} ج.م)</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>المبلغ (ج.م) *</Label><Input type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} required autoFocus /></div>
              <div className="space-y-2"><Label>التاريخ *</Label><Input type="date" value={transferForm.date} onChange={e => setTransferForm({ ...transferForm, date: e.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label>ملاحظات</Label><Input value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="سبب التحويل (اختياري)" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTransferDialog(false)}>إلغاء</Button>
              <Button type="submit" disabled={transferFunds.isPending}>{transferFunds.isPending ? "جاري الترحيل..." : "ترحيل"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* ═══════════════ TAB: البنوك ═══════════════ */}
        <TabsContent value="banks" className="space-y-4 mt-4">
          {/* Summary + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 rounded-lg border bg-primary/5 px-4 py-3">
              <Building className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">إجمالي أرصدة البنوك</p>
                <p className="text-xl font-bold text-primary">{totalBankBalance.toLocaleString("ar-EG")} ج.م</p>
              </div>
              <div className="border-r mr-2 pr-4">
                <p className="text-xs text-muted-foreground">عدد البنوك</p>
                <p className="text-xl font-bold">{banks.length}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadBankTemplate}>
                <Download className="h-4 w-4 ml-1" />تحميل نموذج
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBankImportOpen(true)}>
                <Upload className="h-4 w-4 ml-1" />استيراد Excel
              </Button>
              <Button size="sm" onClick={openAddBank}>
                <Plus className="h-4 w-4 ml-1" />إضافة بنك
              </Button>
            </div>
          </div>

          {/* Banks table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم البنك</TableHead>
                  <TableHead className="text-right">رقم الحساب</TableHead>
                  <TableHead className="text-right">اسم الحساب</TableHead>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">الرصيد</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {banksLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : banks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Building className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>لا توجد بنوك. أضف بنكاً أو استورد من Excel.</p>
                    </TableCell>
                  </TableRow>
                ) : banks.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.accountNumber || "—"}</TableCell>
                    <TableCell>{b.accountName || "—"}</TableCell>
                    <TableCell>{b.branch || "—"}</TableCell>
                    <TableCell className={`font-semibold ${b.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {b.balance.toLocaleString("ar-EG")} ج.م
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{b.notes || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEditBank(b)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { if (confirm(`حذف ${b.name}؟`)) deleteBank.mutate(b.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Add/Edit bank dialog */}
          <Dialog open={bankOpen} onOpenChange={setBankOpen}>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader><DialogTitle>{editingBank ? "تعديل البنك" : "إضافة بنك جديد"}</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); if (!bankForm.name.trim()) return; saveBank.mutate(bankForm); }} className="space-y-3">
                {(["name","accountNumber","accountName","branch","balance","notes"] as const).map(key => (
                  <div key={key}>
                    <Label>{BANK_FIELD_LABELS[key]}</Label>
                    <Input
                      value={bankForm[key]}
                      onChange={e => setBankForm(f => ({ ...f, [key]: e.target.value }))}
                      type={key === "balance" ? "number" : "text"}
                      required={key === "name"}
                      placeholder={key === "name" ? "بنك مصر" : key === "accountNumber" ? "1234567890" : key === "balance" ? "0" : ""}
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => setBankOpen(false)}>إلغاء</Button>
                  <Button type="submit" disabled={saveBank.isPending}>{saveBank.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Import file picker */}
          <Dialog open={bankImportOpen} onOpenChange={setBankImportOpen}>
            <DialogContent className="max-w-sm" dir="rtl">
              <DialogHeader><DialogTitle>استيراد البنوك من Excel</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">اختر ملف Excel. يمكنك تحميل النموذج أولاً للتعرف على الأعمدة المطلوبة.</p>
                <Button variant="outline" className="w-full" onClick={downloadBankTemplate}>
                  <Download className="h-4 w-4 ml-2" />تحميل النموذج أولاً
                </Button>
                <Button className="w-full" onClick={() => bankFileRef.current?.click()}>
                  <Upload className="h-4 w-4 ml-2" />اختيار ملف Excel
                </Button>
                <input ref={bankFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBankFile} />
              </div>
            </DialogContent>
          </Dialog>

          {/* Column mapping dialog */}
          <Dialog open={bankMappingOpen} onOpenChange={setBankMappingOpen}>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader><DialogTitle>ربط الأعمدة ({excelRows.length} صف)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">حدد الأعمدة في الملف المقابلة لكل حقل.</p>
                {Object.keys(BANK_FIELD_LABELS).map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <Label className="w-32 shrink-0 text-sm">{BANK_FIELD_LABELS[f]}</Label>
                    <select
                      className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-background"
                      value={mapping[f] || ""}
                      onChange={e => setMapping(m => ({ ...m, [f]: e.target.value }))}
                    >
                      <option value="">— تجاهل —</option>
                      {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
                {excelRows.length > 0 && mapping.name && (
                  <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                    <p className="font-medium text-xs text-muted-foreground mb-1">معاينة أول صف:</p>
                    {Object.entries(mapping).filter(([,v]) => v).map(([f, col]) => (
                      <p key={f}><span className="text-muted-foreground">{BANK_FIELD_LABELS[f]}: </span>{excelRows[0]?.[excelHeaders.indexOf(col)] ?? "—"}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => { setBankMappingOpen(false); setBankImportOpen(true); }}>رجوع</Button>
                <Button onClick={confirmBankImport} disabled={importBanks.isPending}>
                  {importBanks.isPending ? "جاري الاستيراد..." : `استيراد ${excelRows.length} صف`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
