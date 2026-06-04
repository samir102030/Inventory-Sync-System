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
  LogOut
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

const items = [
  { title: "الرئيسية", url: "/dashboard", icon: Home },
  { title: "نقطة البيع", url: "/pos", icon: ShoppingCart },
  { title: "الفواتير", url: "/invoices", icon: FileText },
  { title: "المنتجات", url: "/products", icon: Package },
  { title: "الأقسام", url: "/categories", icon: Tags },
  { title: "العملاء", url: "/customers", icon: Users },
  { title: "المصروفات", url: "/expenses", icon: CreditCard },
  { title: "الرخص", url: "/licenses", icon: Key },
  { title: "التقارير", url: "/reports", icon: BarChart },
  { title: "الإعدادات", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/login";
      }
    });
  };

  return (
    <Sidebar variant="inset" side="right" dir="rtl">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            S
          </div>
          <span>نظام المتجر</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.name || "المستخدم"}</span>
            <span className="text-xs text-muted-foreground">{user?.role === "admin" ? "مدير النظام" : "كاشير"}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="تسجيل الخروج">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
