import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type CustomerCredit = { customerId: number; customerName: string; totalCredit: number; totalPaid: number; balance: number };
type SupplierCredit = { supplierId: number; supplierName: string; totalCredit: number; totalPaid: number; balance: number };
type Account = { id: number; name: string };

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(r => r.json());

export default function CreditAccounts() {
  const [settleTarget, setSettleTarget] = useState<{ type: "customer" | "supplier"; id: number; name: string; balance: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: customerCredits = [], isLoading: loadingCustomers } = useQuery<CustomerCredit[]>({
    queryKey: ["credit-accounts-customers"],
    queryFn: () => fetchJSON(`${BASE}/credit-accounts/customers`),
  });
  const { data: supplierCredits = [], isLoading: loadingSuppliers } = useQuery<SupplierCredit[]>({
    queryKey: ["credit-accounts-suppliers"],
    queryFn: () => fetchJSON(`${BASE}/credit-accounts/suppliers`),
  });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => fetchJSON(`${BASE}/accounts`) });

  const totalCustomerBalance = customerCredits.reduce((s, c) => s + c.balance, 0);
  const totalSupplierBalance = supplierCredits.reduce((s, c) => s + c.balance, 0);

  const settleMutation = useMutation({
    mutationFn: (data: object) => {
      const url = settleTarget?.type === "customer" ? `${BASE}/receipt-vouchers` : `${BASE}/payment-vouchers`;
      return fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json());
    },
    onSuccess: () => {
      toast({ title: "تم تسجيل التسديد بنجاح" });
      qc.invalidateQueries({ queryKey: ["credit-accounts-customers"] });
      qc.invalidateQueries({ queryKey: ["credit-accounts-suppliers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      qc.invalidateQueries({ queryKey: ["payment-vouchers"] });
      closeDialog();
    },
    onError: () => toast({ title: "حدث خطأ أثناء التسديد", variant: "destructive" }),
  });

  const openSettle = (type: "customer" | "supplier", id: number, name: string, balance: number) => {
    setSettleTarget({ type, id, name, balance });
    setAmount(String(balance));
    setAccountId(accounts[0] ? String(accounts[0].id) : "");
    setDate(format(new Date(), "yyyy-MM-dd"));
  };

  const closeDialog = () => setSettleTarget(null);

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    if (!accountId) { toast({ title: "الرجاء اختيار الحساب / الخزينة", variant: "destructive" }); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast({ title: "الرجاء إدخال مبلغ صحيح", variant: "destructive" }); return; }
    if (settleTarget.type === "customer") {
      settleMutation.mutate({
        customerId: settleTarget.id,
        amount: amt,
        date,
        accountId: Number(accountId),
        reference: "تسديد حساب آجل",
      });
    } else {
      settleMutation.mutate({
        supplierId: settleTarget.id,
        paidTo: settleTarget.name,
        amount: amt,
        date,
        accountId: Number(accountId),
        reference: "تسديد حساب آجل",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">حسابات الآجل</h1>
        <p className="text-sm text-muted-foreground mt-1">متابعة المبيعات والمشتريات الآجلة وتسديدها</p>
      </div>

      <Tabs defaultValue="customers" dir="rtl">
        <TabsList>
          <TabsTrigger value="customers">مبيعات آجلة (عملاء)</TabsTrigger>
          <TabsTrigger value="suppliers">مشتريات آجلة (موردون)</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <p className="text-sm text-muted-foreground">إجمالي المستحق على العملاء: <span className="font-bold text-amber-600">{totalCustomerBalance.toFixed(2)} ج.م</span></p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العميل</TableHead>
                    <TableHead>إجمالي الآجل (ج.م)</TableHead>
                    <TableHead>المسدد (ج.م)</TableHead>
                    <TableHead>المتبقي (ج.م)</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCustomers ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : customerCredits.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">لا توجد حسابات آجلة للعملاء</TableCell></TableRow>
                  ) : customerCredits.map(c => (
                    <TableRow key={c.customerId}>
                      <TableCell className="font-medium">{c.customerName}</TableCell>
                      <TableCell>{c.totalCredit.toFixed(2)}</TableCell>
                      <TableCell className="text-green-600">{c.totalPaid.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-amber-600">{c.balance.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openSettle("customer", c.customerId, c.customerName, c.balance)}>
                          <Wallet className="h-4 w-4 ml-1" />
                          تسديد
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <p className="text-sm text-muted-foreground">إجمالي المستحق للموردين: <span className="font-bold text-amber-600">{totalSupplierBalance.toFixed(2)} ج.م</span></p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المورد</TableHead>
                    <TableHead>إجمالي الآجل (ج.م)</TableHead>
                    <TableHead>المسدد (ج.م)</TableHead>
                    <TableHead>المتبقي (ج.م)</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSuppliers ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : supplierCredits.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">لا توجد حسابات آجلة للموردين</TableCell></TableRow>
                  ) : supplierCredits.map(s => (
                    <TableRow key={s.supplierId}>
                      <TableCell className="font-medium">{s.supplierName}</TableCell>
                      <TableCell>{s.totalCredit.toFixed(2)}</TableCell>
                      <TableCell className="text-green-600">{s.totalPaid.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-amber-600">{s.balance.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openSettle("supplier", s.supplierId, s.supplierName, s.balance)}>
                          <Wallet className="h-4 w-4 ml-1" />
                          تسديد
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!settleTarget} onOpenChange={open => !open && closeDialog()}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تسديد حساب — {settleTarget?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSettle} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              المتبقي حالياً: <span className="font-bold text-amber-600">{settleTarget?.balance.toFixed(2)} ج.م</span>
            </p>
            <div className="space-y-2">
              <Label>المبلغ المسدد (ج.م) *</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>الحساب / الخزينة *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="اختر الحساب..." /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>إلغاء</Button>
              <Button type="submit" disabled={settleMutation.isPending}>تأكيد التسديد</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
