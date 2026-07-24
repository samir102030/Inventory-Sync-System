import { useState, useRef, useEffect } from "react";
import { useGetProducts, useGetCustomers, useCreateInvoice, useCreateCustomer, useGetCategories, useGetInvoiceSettings, getGetProductsQueryKey, getGetSummaryQueryKey, getGetCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Trash2, ShoppingCart, User, CreditCard, MessageCircle, CheckCircle, Wallet, Receipt, Printer, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceItemInput, InvoiceInputPaymentMethod, Product } from "@workspace/api-client-react/src/generated/api.schemas";
import { openWhatsApp, buildInvoiceMessage } from "@/lib/whatsapp";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const PAYMENT_LABELS: Record<string, string> = { cash: "نقداً", card: "بطاقة", transfer: "تحويل", credit: "آجل" };

function printPOSReceipt(invoice: CreatedInvoice, settings: any) {
  const companyName = escapeHtml(settings?.companyName || "شركتي");
  const companyPhone = escapeHtml(settings?.companyPhone || "");
  const companyAddress = escapeHtml(settings?.companyAddress || "");
  const footerNote = escapeHtml(settings?.footerNote || "");
  const primaryColor = settings?.primaryColor || "#1e40af";
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-EG");
  const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  const itemLines = (invoice.items || []).map(item => `
    <div class="item-name">${escapeHtml(item.productName)}</div>
    <div class="item-row">
      <span>${item.quantity} × ${Number(item.unitPrice).toFixed(2)} ج.م</span>
      <span>${(item.quantity * item.unitPrice).toFixed(2)} ج.م</span>
    </div>`).join('<div class="sep-thin"></div>');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>فاتورة #${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { margin: 4mm 3mm; }
  body { font-family: Arial, 'Segoe UI', sans-serif; font-size:15px; line-height:1.6; color:#000; background:#fff; direction:rtl; width:100%; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .company-name { font-size:20px; font-weight:bold; color:${primaryColor}; text-align:center; margin-bottom:2px; }
  .sep { border-top:2px dashed #000; margin:8px 0; }
  .sep-thin { border-top:1px dotted #aaa; margin:4px 0; }
  .meta-row { display:flex; justify-content:space-between; font-size:13px; padding:2px 0; }
  .item-name { font-weight:bold; margin-top:6px; font-size:14px; }
  .item-row { display:flex; justify-content:space-between; font-size:13px; color:#333; margin-bottom:2px; }
  .total-row { display:flex; justify-content:space-between; padding:3px 0; font-size:14px; }
  .total-final { display:flex; justify-content:space-between; font-size:20px; font-weight:bold; padding:7px 0; border-top:3px solid ${primaryColor}; margin-top:6px; color:${primaryColor}; }
  .footer { text-align:center; font-size:12px; margin-top:10px; color:#555; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
  <div class="company-name">${companyName}</div>
  ${companyPhone ? `<div class="center" style="font-size:13px;">${companyPhone}</div>` : ""}
  ${companyAddress ? `<div class="center" style="font-size:12px;color:#555;">${companyAddress}</div>` : ""}
  <div class="sep"></div>

  <div class="meta-row"><span>فاتورة #</span><span class="bold">${escapeHtml(invoice.invoiceNumber)}</span></div>
  <div class="meta-row"><span>التاريخ</span><span>${dateStr} ${timeStr}</span></div>
  <div class="meta-row"><span>العميل</span><span>${escapeHtml(invoice.customerName || "نقدي")}</span></div>
  <div class="meta-row"><span>الدفع</span><span>${PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod}</span></div>
  <div class="sep"></div>

  ${itemLines}

  <div class="sep"></div>
  <div class="total-row"><span>المجموع الفرعي</span><span>${Number(invoice.subtotal || 0).toFixed(2)} ج.م</span></div>
  ${Number(invoice.discount) > 0 ? `<div class="total-row" style="color:#dc2626;"><span>الخصم</span><span>-${Number(invoice.discount).toFixed(2)} ج.م</span></div>` : ""}
  ${Number(invoice.tax) > 0 ? `<div class="total-row"><span>الضريبة</span><span>+${Number(invoice.tax).toFixed(2)} ج.م</span></div>` : ""}
  <div class="total-final"><span>الإجمالي</span><span>${Number(invoice.total).toFixed(2)} ج.م</span></div>

  <div class="sep"></div>
  <div class="footer">${footerNote || `شكراً لتعاملكم مع ${companyName}`}</div>
  <div style="margin-top:20px;"></div>
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=360,height=650");
  if (win) { win.document.write(html); win.document.close(); }
}

type CartItem = Product & { cartQuantity: number; discount: number; unitPrice: number };
type CreatedInvoice = { invoiceNumber: string; total: number; subtotal: number; discount: number; tax: number; paymentMethod: string; customerName?: string | null; customerWhatsapp?: string | null; createdAt: string; items?: Array<{ productName: string; quantity: number; unitPrice: number }> };
type Account = { id: number; name: string; type: string };

const fetchAccounts = () => fetch("/api/accounts", { credentials: "include" }).then(r => r.json());

export default function POS() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<InvoiceInputPaymentMethod>("cash");
  const [accountId, setAccountId] = useState<number | "">("");
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [successInvoice, setSuccessInvoice] = useState<CreatedInvoice | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const { data: invoiceSettings } = useGetInvoiceSettings();
  const createCustomer = useCreateCustomer();
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  const { data: products } = useGetProducts({ search }, { query: { enabled: search.length > 2 } });
  const { data: allProducts } = useGetProducts({}, { query: { enabled: true } });
  const { data: categories } = useGetCategories();
  const { data: customers } = useGetCustomers({});
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const createInvoice = useCreateInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (accountId === "" && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with typing in inputs
      }
      
      if (e.key === "Enter" && barcodeBuffer.current.length > 3) {
        // Process barcode
        const barcode = barcodeBuffer.current;
        barcodeBuffer.current = "";
        
        const matchedProduct = allProducts?.find(p => p.barcode === barcode);
        if (matchedProduct) {
          addToCart(matchedProduct);
          toast({ title: "تم إضافة المنتج", description: matchedProduct.name });
        } else {
          toast({ title: "منتج غير موجود", description: `الباركود: ${barcode}`, variant: "destructive" });
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 100); // Reset if too slow (not a scanner)
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allProducts, cart]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1, discount: 0, unitPrice: product.price }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setCart(prev => prev.map(item => item.id === productId ? { ...item, cartQuantity: quantity } : item));
  };

  const updateDiscount = (productId: number, discount: number) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, discount } : item));
  };

  const updateUnitPrice = (productId: number, unitPrice: number) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, unitPrice } : item));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.cartQuantity) - item.discount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - globalDiscount;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const items: InvoiceItemInput[] = cart.map(item => ({
      productId: item.id,
      quantity: item.cartQuantity,
      unitPrice: item.unitPrice,
      discount: item.discount
    }));

    if (paymentMethod !== "credit" && accountId === "") {
      toast({ title: "الرجاء اختيار الحساب / الخزينة التي سيتم استلام المبلغ فيها", variant: "destructive" });
      return;
    }
    if (paymentMethod === "credit" && customerId === "") {
      toast({ title: "الرجاء اختيار عميل مسجل للبيع الآجل", variant: "destructive" });
      return;
    }

    const cartSnapshot = [...cart];
    createInvoice.mutate({
      data: {
        items,
        customerId: customerId === "" ? undefined : customerId,
        accountId: paymentMethod === "credit" ? undefined : (accountId === "" ? undefined : accountId),
        paymentMethod,
        discount: globalDiscount,
        tax: taxAmount,
        status: "paid"
      }
    }, {
      onSuccess: (inv: any) => {
        const customer = customers?.find(c => c.id === customerId);
        setSuccessInvoice({
          ...inv,
          customerWhatsapp: inv.customerWhatsapp ?? (customer as any)?.whatsapp ?? null,
          createdAt: inv.createdAt ?? new Date().toISOString(),
          items: cartSnapshot.map(i => ({ productName: i.name, quantity: i.cartQuantity, unitPrice: i.unitPrice })),
        });
        setCart([]);
        setCustomerId("");
        setGlobalDiscount(0);
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      },
      onError: () => {
        toast({ title: "حدث خطأ أثناء إصدار الفاتورة", variant: "destructive" });
      }
    });
  };

  return (
    <>
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)]">
      {/* Products Area */}
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <Card className="flex-none">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="ابحث عن منتج (الاسم أو الباركود)..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); if (e.target.value) setSelectedCategory(null); }}
                className="pr-9"
              />
            </div>
            {categories && categories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setSelectedCategory(null); setSearch(""); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${selectedCategory === null && !search ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                >
                  الكل
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setSearch(""); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${selectedCategory === cat.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(() => {
              let list = search.length > 2 ? (products ?? []) : (allProducts ?? []);
              if (selectedCategory !== null && search.length <= 2) {
                list = list.filter(p => p.categoryId === selectedCategory);
              }
              return list.slice(0, 40).map(product => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary hover-elevate transition-colors"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-sm line-clamp-2" title={product.name}>{product.name}</h3>
                      <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-primary">{product.price} ج.م</span>
                      <span className="text-xs bg-muted px-2 py-1 rounded">المخزون: {product.stock}</span>
                    </div>
                  </CardContent>
                </Card>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Cart Area */}
      <Card className="w-full md:w-[400px] flex flex-col h-full overflow-hidden flex-none">
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            سلة المشتريات
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
              <p>السلة فارغة</p>
              <p className="text-sm">قم بالبحث عن منتجات أو استخدم قارئ الباركود</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>سعر البيع</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="truncate w-[120px]" title={item.name}>{item.name}</div>
                      {item.unitPrice !== item.price && (
                        <div className="text-xs text-muted-foreground line-through">{item.price} ج.م</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.cartQuantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center p-1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateUnitPrice(item.id, parseFloat(e.target.value) || 0)}
                        className={`w-24 h-8 text-center p-1 ${item.unitPrice !== item.price ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                        title="سعر البيع — يمكنك تعديله"
                      />
                    </TableCell>
                    <TableCell className="text-left text-sm font-bold">
                      {((item.unitPrice * item.cartQuantity) - item.discount).toFixed(2)}
                    </TableCell>
                    <TableCell className="p-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <div className="p-4 bg-muted/30 border-t space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={customerId.toString()} onValueChange={(v) => setCustomerId(v === "none" ? "" : parseInt(v))}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="اختر العميل (اختياري)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">عميل نقدي (بدون تسجيل)</SelectItem>
                {customers?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              title="إضافة عميل جديد"
              onClick={() => setShowAddCustomer(true)}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="طريقة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="card">بطاقة بنكية / كي نت</SelectItem>
                <SelectItem value="transfer">تحويل بنكي</SelectItem>
                <SelectItem value="credit">آجل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <Select value={accountId.toString()} onValueChange={(v) => setAccountId(v === "" ? "" : parseInt(v))}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="الحساب / الخزينة المستلمة" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <Select value={taxRate.toString()} onValueChange={(v) => setTaxRate(Number(v))}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="الضريبة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">بدون ضريبة</SelectItem>
                <SelectItem value="5">ضريبة 5%</SelectItem>
                <SelectItem value="10">ضريبة 10%</SelectItem>
                <SelectItem value="14">ضريبة القيمة المضافة 14%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي:</span>
              <span>{subtotal.toFixed(2)} ج.م</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm text-amber-600 font-medium">
                <span>الضريبة ({taxRate}%):</span>
                <span>{taxAmount.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span>الخصم الإضافي:</span>
              <Input 
                type="number" 
                min="0" 
                step="0.1" 
                value={globalDiscount} 
                onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 h-8 text-left bg-background"
                dir="ltr"
              />
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>الإجمالي:</span>
              <span className="text-primary">{Math.max(0, total).toFixed(2)} ج.م</span>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-lg font-bold" 
            onClick={handleCheckout}
            disabled={cart.length === 0 || createInvoice.isPending}
          >
            {createInvoice.isPending ? "جاري الإصدار..." : "دفع وإصدار الفاتورة"}
          </Button>
        </div>
      </Card>
    </div>

    {/* Add Customer Dialog */}
    <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            إضافة عميل جديد
          </DialogTitle>
          <DialogDescription>سيتم اختيار العميل تلقائياً بعد الإضافة</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الاسم <span className="text-red-500">*</span></Label>
            <Input
              placeholder="اسم العميل"
              value={newCustomerName}
              onChange={e => setNewCustomerName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهاتف</Label>
            <Input
              placeholder="مثال: 05xxxxxxxx"
              value={newCustomerPhone}
              onChange={e => setNewCustomerPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني</Label>
            <Input
              placeholder="example@email.com"
              value={newCustomerEmail}
              onChange={e => setNewCustomerEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input
              placeholder="عنوان العميل (اختياري)"
              value={newCustomerAddress}
              onChange={e => setNewCustomerAddress(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              disabled={!newCustomerName.trim() || createCustomer.isPending}
              onClick={() => {
                createCustomer.mutate({
                  data: {
                    name: newCustomerName.trim(),
                    ...(newCustomerPhone && { phone: newCustomerPhone.trim() }),
                    ...(newCustomerEmail && { email: newCustomerEmail.trim() }),
                    ...(newCustomerAddress && { address: newCustomerAddress.trim() }),
                  }
                }, {
                  onSuccess: (newCust: any) => {
                    queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
                    setCustomerId(newCust.id);
                    setShowAddCustomer(false);
                    setNewCustomerName("");
                    setNewCustomerPhone("");
                    setNewCustomerEmail("");
                    setNewCustomerAddress("");
                    toast({ title: `تم إضافة العميل "${newCust.name}" واختياره` });
                  },
                  onError: () => {
                    toast({ title: "حدث خطأ أثناء إضافة العميل", variant: "destructive" });
                  }
                });
              }}
            >
              {createCustomer.isPending ? "جارٍ الإضافة..." : "إضافة واختيار"}
            </Button>
            <Button variant="outline" onClick={() => setShowAddCustomer(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Receipt Dialog — same style as InvoiceDetail */}
    <Dialog open={!!successInvoice} onOpenChange={open => !open && setSuccessInvoice(null)}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            تم إصدار الفاتورة بنجاح
          </DialogTitle>
          <DialogDescription>يمكنك طباعة الفاتورة أو إرسالها على واتساب</DialogDescription>
        </DialogHeader>

        {successInvoice && (() => {
          const settings = invoiceSettings as any;
          const companyName  = settings?.companyName  || "شركتي";
          const companyPhone = settings?.companyPhone || "";
          const companyAddress = settings?.companyAddress || "";
          const companyLogo  = settings?.companyLogo  || "";
          const primaryColor = settings?.primaryColor || "#1e40af";

          return (
            <div className="space-y-5">
              {/* Company Header */}
              <div className="flex justify-between items-start pb-4 border-b-2" style={{ borderColor: primaryColor }}>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: primaryColor }}>{companyName}</h2>
                  {companyPhone   && <p className="text-sm text-muted-foreground">📞 {companyPhone}</p>}
                  {companyAddress && <p className="text-sm text-muted-foreground">📍 {companyAddress}</p>}
                </div>
                {companyLogo
                  ? <img src={companyLogo} className="h-14 max-w-[140px] object-contain" alt="logo" />
                  : <div className="text-2xl font-black opacity-20">{companyName.slice(0, 2)}</div>
                }
              </div>

              {/* Invoice Meta */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">فاتورة #{successInvoice.invoiceNumber}</h2>
                  <p className="text-muted-foreground text-sm">{format(new Date(successInvoice.createdAt), 'yyyy/MM/dd HH:mm')}</p>
                  <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100">مدفوعة</Badge>
                </div>
                <div className="text-left space-y-1">
                  <p className="font-bold">{successInvoice.customerName || 'عميل نقدي'}</p>
                  <p className="text-sm text-muted-foreground">طريقة الدفع: {PAYMENT_LABELS[successInvoice.paymentMethod] || successInvoice.paymentMethod}</p>
                </div>
              </div>

              {/* Items Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر الوحدة</TableHead>
                    <TableHead className="text-left">المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {successInvoice.items?.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{Number(item.unitPrice).toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-left font-bold">{(item.quantity * item.unitPrice).toFixed(2)} ج.م</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex justify-end pt-2 border-t">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع الفرعي:</span><span>{Number(successInvoice.subtotal).toFixed(2)} ج.م</span></div>
                  {Number(successInvoice.discount) > 0 && <div className="flex justify-between text-sm text-destructive"><span>الخصم:</span><span>-{Number(successInvoice.discount).toFixed(2)} ج.م</span></div>}
                  {Number(successInvoice.tax) > 0 && <div className="flex justify-between text-sm"><span>الضريبة:</span><span>+{Number(successInvoice.tax).toFixed(2)} ج.م</span></div>}
                  <div className="flex justify-between text-lg font-bold border-t pt-1"><span>الإجمالي:</span><span>{Number(successInvoice.total).toFixed(2)} ج.م</span></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-3 border-t">
                <div>
                  {successInvoice.customerWhatsapp && (
                    <Button variant="outline" size="sm" className="text-green-600 border-green-500 hover:bg-green-50 gap-1"
                      onClick={() => openWhatsApp(successInvoice.customerWhatsapp!, buildInvoiceMessage(successInvoice))}>
                      <MessageCircle className="h-4 w-4" />إرسال واتساب
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => printPOSReceipt(successInvoice, invoiceSettings)}>
                    <Printer className="h-4 w-4" />ريسيت
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => printInvoiceWindow(successInvoice, invoiceSettings, [])}>
                    <Printer className="h-4 w-4" />A4 / PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSuccessInvoice(null)}>إغلاق</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
    </>
  );
}
