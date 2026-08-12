import React from "react";
import { Eye } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { activeCompanyOf, useSession } from "@/hooks/use-session";

/**
 * تنبيه المالك أنه يرى كل الشركات ولا يقف داخل واحدة.
 *
 * في هذا الوضع ترفض كل إضافة وكل تعديل: الصف سيولد بلا شركة فلا يراه أحد
 * بعدها. الرفض صحيح، لكنه كان يُكتشف فعلًا بفعل — يحاول إضافة قسم فيُرفض،
 * ثم منتج فيُرفض. سطرٌ واحد فوق الشاشة يقول الحال قبل المحاولة الأولى.
 */
function UnscopedNotice() {
  const { data: session } = useSession();

  if (!session || session.role !== "owner" || activeCompanyOf(session)) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950/30 lg:px-6">
      <Eye className="h-4 w-4 shrink-0 text-amber-600" />
      <span>
        إنت شايف <strong>كل الشركات</strong> — للاطلاع فقط. عشان تضيف أو تعدّل،
        اختر شركة من الزر أسفل القائمة الجانبية.
      </span>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background" dir="rtl">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
            <SidebarTrigger className="ms-auto lg:hidden" />
          </header>
          <UnscopedNotice />
          <div className="flex-1 p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
