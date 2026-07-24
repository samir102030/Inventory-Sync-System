import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import GoogleSignInCallback from "@/pages/google-callback";

import Login from "@/pages/login";
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

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen w-full items-center justify-center">جاري التحميل...</div>;
  if (!user) return <Redirect to="/login" />;
  return <Layout><Component /></Layout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/sign-in/*?" component={GoogleSignInCallback} />
      <Route path="/"><Redirect to="/dashboard" /></Route>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-in`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Router />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
