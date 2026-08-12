import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { canOpenPage, homePathFor } from "@/lib/permissions";
import { useLocation } from "wouter";

import Login from "@/pages/login";
import Signup, { Activate } from "@/pages/signup";
import Requests from "@/pages/requests";
import InvoiceApprovals from "@/pages/invoice-approvals";
import Dashboard from "@/pages/dashboard";
import POS from "@/pages/pos";
import Invoices from "@/pages/invoices";
import Products from "@/pages/products";
import Categories from "@/pages/categories";
import Customers from "@/pages/customers";
import Expenses from "@/pages/expenses";
import Licenses from "@/pages/licenses";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Suppliers from "@/pages/suppliers";
import Purchases from "@/pages/purchases";
import ReceiptVouchers from "@/pages/receipt-vouchers";
import PaymentVouchers from "@/pages/payment-vouchers";
import Accounts from "@/pages/accounts";
import CreditAccounts from "@/pages/credit-accounts";
import WhatsAppBroadcast from "@/pages/whatsapp-broadcast";
import Warehouses from "@/pages/warehouses";
import ProductTracking from "@/pages/product-tracking";
import TaxLedger from "@/pages/tax-ledger";
import TaxableProducts from "@/pages/taxable-products";
import Employees from "@/pages/employees";
import Quotations from "@/pages/quotations";
import StockShortage from "@/pages/stock-shortage";
import Projects from "@/pages/projects";
import RentalProperties from "@/pages/rental-properties";
import Jam3iyyat from "@/pages/jam3iyyat";
import TaxInvoices from "@/pages/tax-invoices";
import CreditCards from "@/pages/credit-cards";
import Balances from "@/pages/balances";
import SupplierBalances from "@/pages/supplier-balances";
import Banks from "@/pages/banks";
import Companies from "@/pages/companies";

function getErrorStatus(error: unknown): number | undefined {
  const value = error as { status?: unknown; response?: { status?: unknown } } | null;
  const status = value?.status ?? value?.response?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * أي عملية حفظ تفشل تقول سببها.
 *
 * سبع صفحات كانت تكتب `mutate(..., { onSuccess })` بلا `onError`، فالرفض
 * يمر بلا أثر: يضغط المستخدم "حفظ" فلا يحدث شيء ولا تظهر رسالة — يبدو
 * كزرار معطّل. والخادم في هذه الحالات يقول ما ينقص بالضبط ("اختر شركة
 * أولًا") فلا يصل منه شيء.
 *
 * هنا لا في كل صفحة: صفحةٌ تُضاف غدًا تحصل على هذا دون أن يتذكره أحد.
 * وصفحة تعالج خطأها بنفسها تظل كما هي — `onError` الخاص يسبق هذا.
 */
const mutationCache = new MutationCache({
  onError: (error: any) => {
    toast({
      title: "تعذّر الحفظ",
      description: error?.message ?? "حاول مرة أخرى.",
      variant: "destructive",
    });
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      // لا تعيد الجلب تلقائياً لما تتحول للتاب — بيمنع مفاجآت وسط الشغل
      refetchOnWindowFocus: false,
      // retry مرة واحدة للـ queries العادية (مش useGetMe — دي ليها إعدادها الخاص)
      retry: (count, error: any) => {
        const status = getErrorStatus(error);
        if (status === 401 || status === 403) return false;
        return count < 1;
      },
      retryDelay: 1500,
      staleTime: 30_000, // 30 ثانية — البيانات مش stale فوراً
    },
    mutations: {
      // retry مرة واحدة للـ mutations لو مش 4xx
      retry: (count, error: any) => {
        const status = getErrorStatus(error);
        if (status && status >= 400 && status < 500) return false;
        return count < 1;
      },
      retryDelay: 1500,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen w-full items-center justify-center">جاري التحميل...</div>;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={homePathFor(user.role)} />;
}

function NoAccess() {
  return (
    <div dir="rtl" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold">هذه الصفحة غير متاحة لحسابك</h2>
      <p className="text-sm text-muted-foreground">راجع مدير النظام إذا كنت تحتاج صلاحية الوصول.</p>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <div className="flex h-screen w-full items-center justify-center">جاري التحميل...</div>;
  if (!user) return <Redirect to="/login" />;

  // الحماية الحقيقية في الخادم؛ هذا يمنع فتح صفحة لا فائدة منها للمستخدم.
  if (!canOpenPage(user.role, location)) {
    return <Layout><NoAccess /></Layout>;
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      {/* التسجيل والتفعيل يعملان بلا حساب، فهما خارج ProtectedRoute. */}
      <Route path="/signup" component={Signup} />
      <Route path="/activate" component={Activate} />
      <Route path="/"><HomeRedirect /></Route>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/pos"><ProtectedRoute component={POS} /></Route>
      <Route path="/invoices"><ProtectedRoute component={Invoices} /></Route>
      <Route path="/products"><ProtectedRoute component={Products} /></Route>
      <Route path="/categories"><ProtectedRoute component={Categories} /></Route>
      <Route path="/customers"><ProtectedRoute component={Customers} /></Route>
      <Route path="/whatsapp"><ProtectedRoute component={WhatsAppBroadcast} /></Route>
      <Route path="/suppliers"><ProtectedRoute component={Suppliers} /></Route>
      <Route path="/purchases"><ProtectedRoute component={Purchases} /></Route>
      <Route path="/expenses"><ProtectedRoute component={Expenses} /></Route>
      <Route path="/receipt-vouchers"><ProtectedRoute component={ReceiptVouchers} /></Route>
      <Route path="/payment-vouchers"><ProtectedRoute component={PaymentVouchers} /></Route>
      <Route path="/licenses"><ProtectedRoute component={Licenses} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route path="/requests"><ProtectedRoute component={Requests} /></Route>
      <Route path="/invoice-approvals"><ProtectedRoute component={InvoiceApprovals} /></Route>
      <Route path="/accounts"><ProtectedRoute component={Accounts} /></Route>
      <Route path="/credit-accounts"><ProtectedRoute component={CreditAccounts} /></Route>
      <Route path="/warehouses"><ProtectedRoute component={Warehouses} /></Route>
      <Route path="/product-tracking"><ProtectedRoute component={ProductTracking} /></Route>
      <Route path="/tax-ledger"><ProtectedRoute component={TaxLedger} /></Route>
      <Route path="/taxable-products"><ProtectedRoute component={TaxableProducts} /></Route>
      <Route path="/employees"><ProtectedRoute component={Employees} /></Route>
      <Route path="/quotations"><ProtectedRoute component={Quotations} /></Route>
      <Route path="/stock-shortage"><ProtectedRoute component={StockShortage} /></Route>
      <Route path="/projects"><ProtectedRoute component={Projects} /></Route>
      <Route path="/rental-properties"><ProtectedRoute component={RentalProperties} /></Route>
      <Route path="/jam3iyyat"><ProtectedRoute component={Jam3iyyat} /></Route>
      <Route path="/tax-invoices"><ProtectedRoute component={TaxInvoices} /></Route>
      <Route path="/credit-cards"><ProtectedRoute component={CreditCards} /></Route>
      <Route path="/balances"><ProtectedRoute component={Balances} /></Route>
      <Route path="/supplier-balances"><ProtectedRoute component={SupplierBalances} /></Route>
      <Route path="/banks"><ProtectedRoute component={Banks} /></Route>
      <Route path="/companies"><ProtectedRoute component={Companies} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppProviders />
    </WouterRouter>
  );
}

export default App;
