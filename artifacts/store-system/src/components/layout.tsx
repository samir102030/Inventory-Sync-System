import React from "react";
import { useLocation } from "wouter";
import { Building2, Eye } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, titleForPath } from "./sidebar";
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
  const [location] = useLocation();
  const { data: session } = useSession();
  const company = activeCompanyOf(session);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background" dir="rtl">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          {/* كان الشريط فارغًا إلا من زر القائمة على الموبايل — مساحة تقول
              للمستخدم أين هو، وفي أي شركة، بلا أن ينزل يبحث. */}
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:px-6">
            <SidebarTrigger className="lg:hidden" />
            <h1 className="truncate text-base font-semibold">{titleForPath(location)}</h1>
            {company && (
              <span className="ms-auto hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:flex">
                <Building2 className="h-3.5 w-3.5" />
                {company.name}
              </span>
            )}
          </header>
          <UnscopedNotice />
          {/* عرض أقصى: سطر يمتد عبر شاشة 27 بوصة لا يُقرأ. */}
          <div className="mx-auto w-full max-w-[1600px] flex-1 p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
