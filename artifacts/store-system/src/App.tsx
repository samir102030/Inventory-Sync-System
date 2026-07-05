import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";

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

const queryClient = new QueryClient();

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
      <Route path="/"><Redirect to="/dashboard" /></Route>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/pos"><ProtectedRoute component={POS} /></Route>
      <Route path="/invoices"><ProtectedRoute component={Invoices} /></Route>
      <Route path="/products"><ProtectedRoute component={Products} /></Route>
      <Route path="/categories"><ProtectedRoute component={Categories} /></Route>
      <Route path="/customers"><ProtectedRoute component={Customers} /></Route>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
