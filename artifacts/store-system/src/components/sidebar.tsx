import {
  Home,
  ShoppingCart,
  FileText,
  Package,
  Tags,
  Users,
  CreditCard,
  Key,
  BarChart,
  Settings,
  LogOut,
  Truck,
  ShoppingBag,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  HandCoins,
  MessageCircle,
  Warehouse,
  ScanBarcode,
  Receipt,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { Button } from "./ui/button";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  cashier: "كاشير",
  accountant: "محاسب",
  technician: "فني",
};

const salesItems = [
  { title: "الرئيسية", url: "/dashboard", icon: Home },
  { title: "نقطة البيع", url: "/pos", icon: ShoppingCart },
  { title: "الفواتير", url: "/invoices", icon: FileText },
];

const purchaseItems = [
  { title: "الموردون", url: "/suppliers", icon: Truck },
  { title: "المشتريات", url: "/purchases", icon: ShoppingBag },
];

const financeItems = [
  { title: "الخزينة والحسابات", url: "/accounts", icon: Landmark },
  { title: "حسابات الآجل", url: "/credit-accounts", icon: HandCoins },
  { title: "سندات القبض", url: "/receipt-vouchers", icon: ArrowDownCircle },
  { title: "سندات الصرف", url: "/payment-vouchers", icon: ArrowUpCircle },
  { title: "المصروفات", url: "/expenses", icon: CreditCard },
  { title: "سجل الضريبة", url: "/tax-ledger", icon: Receipt },
  { title: "المنتجات الضريبية", url: "/taxable-products", icon: Receipt },
];

const inventoryItems = [
  { title: "المنتجات", url: "/products", icon: Package },
  { title: "الأقسام", url: "/categories", icon: Tags },
  { title: "المستودعات", url: "/warehouses", icon: Warehouse },
  { title: "تتبع المنتج", url: "/product-tracking", icon: ScanBarcode },
];

const crmItems = [
  { title: "العملاء", url: "/customers", icon: Users },
  { title: "رسائل واتساب", url: "/whatsapp", icon: MessageCircle },
];

const otherItems = [
  { title: "الرخص", url: "/licenses", icon: Key },
  { title: "التقارير", url: "/reports", icon: BarChart },
  { title: "الإعدادات", url: "/settings", icon: Settings },
];

function NavGroup({ label, items, location }: { label: string; items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[]; location: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={location.startsWith(item.url)}>
                <Link href={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { window.location.href = "/login"; }
    });
  };

  return (
    <Sidebar variant="inset" side="right" dir="rtl">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">ERP</div>
          <span>نظام ERP</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="المبيعات" items={salesItems} location={location} />
        <NavGroup label="المشتريات" items={purchaseItems} location={location} />
        <NavGroup label="المالية" items={financeItems} location={location} />
        <NavGroup label="المخزون" items={inventoryItems} location={location} />
        <NavGroup label="العملاء" items={crmItems} location={location} />
        <NavGroup label="أخرى" items={otherItems} location={location} />
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.name || "المستخدم"}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role || ""] || user?.role}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="تسجيل الخروج">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
