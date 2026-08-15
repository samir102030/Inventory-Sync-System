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
  UserCheck,
  ClipboardList,
  AlertTriangle,
  FolderOpen,
  Building2,
  Coins,
  Wallet,
  Building,
  Inbox,
  ClipboardCheck,
  Tag,
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
import { useRole } from "@/hooks/use-role";
import { canOpenPage } from "@/lib/permissions";
import { Button } from "./ui/button";
import { CompanySwitcher } from "./company-switcher";

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك النظام",
  admin: "مدير النظام",
  cashier: "كاشير",
  vendor: "مورّد",
  accountant: "محاسب",
  technician: "فني",
};

const salesItems = [
  { title: "الرئيسية", url: "/dashboard", icon: Home },
  { title: "نقطة البيع", url: "/pos", icon: ShoppingCart },
  { title: "الفواتير", url: "/invoices", icon: FileText },
  // مخفية عن الكاشير: هو من يُراجَع، لا من يراجِع.
  { title: "فواتير بانتظار الاعتماد", url: "/invoice-approvals", icon: ClipboardCheck },
  { title: "عروض الأسعار", url: "/quotations", icon: ClipboardList },
  { title: "المشاريع", url: "/projects", icon: FolderOpen },
];

const purchaseItems = [
  { title: "الموردون", url: "/suppliers", icon: Truck },
  { title: "أرصدة الموردين", url: "/supplier-balances", icon: HandCoins },
  { title: "المشتريات", url: "/purchases", icon: ShoppingBag },
];

const financeItems = [
  { title: "الخزينة والحسابات", url: "/accounts", icon: Landmark },
  { title: "حسابات الآجل", url: "/credit-accounts", icon: HandCoins },
  { title: "سندات القبض", url: "/receipt-vouchers", icon: ArrowDownCircle },
  { title: "سندات الصرف", url: "/payment-vouchers", icon: ArrowUpCircle },
  { title: "المصروفات", url: "/expenses", icon: CreditCard },
  { title: "إيجار الممتلكات", url: "/rental-properties", icon: Building2 },
  { title: "الجمعيات", url: "/jam3iyyat", icon: Coins },
  { title: "الموظفون والرواتب", url: "/employees", icon: UserCheck },
  { title: "مسحوبات الكريدت كارد", url: "/credit-cards", icon: Wallet },
];

const inventoryItems = [
  { title: "المنتجات", url: "/products", icon: Package },
  { title: "الأقسام", url: "/categories", icon: Tags },
  { title: "البراندات", url: "/brands", icon: Tag },
  { title: "المستودعات", url: "/warehouses", icon: Warehouse },
  { title: "تتبع المنتج", url: "/product-tracking", icon: ScanBarcode },
  { title: "نواقص البضاعة", url: "/stock-shortage", icon: AlertTriangle },
  { title: "المنتجات الضريبية", url: "/taxable-products", icon: Receipt },
  { title: "سجل الضريبة", url: "/tax-ledger", icon: Receipt },
  { title: "الفواتير الضريبية", url: "/tax-invoices", icon: FileText },
];

const crmItems = [
  { title: "العملاء", url: "/customers", icon: Users },
  { title: "أرصدة الحسابات", url: "/balances", icon: HandCoins },
  { title: "رسائل واتساب", url: "/whatsapp", icon: MessageCircle },
];

/**
 * إدارة النظام: ما يخص النظام نفسه لا عمل الشركة اليومي.
 *
 * الشركات لمالك النظام وحده. الطلبات يراها الأدمن أيضًا لأن موظفيه يسجّلون
 * بأنفسهم وموافقتهم عليه هو — والشريط الجانبي يخفي عن كلٍّ ما لا يفتحه.
 */
const systemItems = [
  { title: "طلبات التسجيل", url: "/requests", icon: Inbox },
  { title: "الشركات", url: "/companies", icon: Building2 },
];

const otherItems = [
  { title: "الرخص", url: "/licenses", icon: Key },
  { title: "التقارير", url: "/reports", icon: BarChart },
  { title: "الإعدادات", url: "/settings", icon: Settings },
];

/**
 * عنوان الصفحة الحالية، مشتقٌّ من نفس قوائم التنقل.
 *
 * جدولٌ منفصل للعناوين كان سينحرف عن القائمة أول مرة يتغير اسم صفحة.
 */
const ALL_NAV_ITEMS = [
  ...salesItems,
  ...purchaseItems,
  ...financeItems,
  ...inventoryItems,
  ...crmItems,
  ...systemItems,
  ...otherItems,
];

export function titleForPath(path: string): string {
  // الأطول أولًا: ‏/invoice-approvals يجب ألا يلتقطه ‏/invoices.
  const match = [...ALL_NAV_ITEMS]
    .sort((a, b) => b.url.length - a.url.length)
    .find((item) => path === item.url || path.startsWith(item.url + "/"));

  return match?.title ?? "نظام ERP";
}

function NavGroup({ label, items, location }: { label: string; items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[]; location: string }) {
  if (items.length === 0) return null;
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
  const { isAdmin } = useRole();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { window.location.href = "/login"; }
    });
  };

  // نخفي ما لا يستطيع المستخدم فتحه أصلاً، بدل أن يضغط ويجد رفضاً.
  const allowed = (items: typeof salesItems) =>
    items.filter(i => canOpenPage(user?.role, i.url));

  const visibleFinanceItems = allowed(
    isAdmin
      ? financeItems
      : financeItems.filter(i => i.url !== "/receipt-vouchers" && i.url !== "/payment-vouchers"),
  );

  return (
    <Sidebar variant="inset" side="right" dir="rtl">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">ERP</div>
          <span>نظام ERP</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="المبيعات" items={allowed(salesItems)} location={location} />
        <NavGroup label="المشتريات" items={allowed(purchaseItems)} location={location} />
        <NavGroup label="العملاء" items={allowed(crmItems)} location={location} />
        <NavGroup label="المالية" items={visibleFinanceItems} location={location} />
        <NavGroup label="المخزون" items={allowed(inventoryItems)} location={location} />
        <NavGroup label="أخرى" items={allowed(otherItems)} location={location} />
        <NavGroup label="إدارة النظام" items={allowed(systemItems)} location={location} />
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        {/* الشركة الفعّالة أسفل القائمة تمامًا، بجوار اسم المستخدم وزر الخروج. */}
        <CompanySwitcher />
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
