import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { jsonOrThrow } from "@/lib/http";
import { activeCompanyOf, useSession } from "@/hooks/use-session";

/**
 * تبديل الشركة الفعّالة — أسفل الشريط الجانبي تمامًا، بجوار اسم المستخدم.
 *
 * مالك النظام وحده يبدّل. أدمن الشركة يرى اسم شركته فقط، فيعرف أي بيانات
 * أمامه دون أن يستطيع الخروج منها.
 *
 * الاختيار يُحفظ في الجلسة على الخادم لا في المتصفح: لو كان العميل هو من
 * يحدد شركته لكفى تعديل طلب واحد لرؤية شركة أخرى.
 */

type Company = { id: number; name: string; isActive: boolean };

export function CompanySwitcher() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isOwner = session?.role === "owner";
  const active = activeCompanyOf(session);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies", "switcher"],
    queryFn: () => fetch("/api/companies", { credentials: "include" }).then(jsonOrThrow),
    enabled: isOwner,
  });

  const switchTo = useMutation({
    mutationFn: (companyId: number | null) =>
      fetch(
        companyId === null
          ? "/api/companies/switch/clear"
          : `/api/companies/${companyId}/switch`,
        { method: "POST", credentials: "include" },
      ).then(jsonOrThrow),
    onSuccess: () => {
      // كل البيانات المعروضة تخص الشركة السابقة — لا شيء منها صالح بعد الآن.
      queryClient.clear();
      window.location.reload();
    },
    onError: (error: Error) =>
      toast({ title: "تعذر تبديل الشركة", description: error.message, variant: "destructive" }),
  });

  if (!session) return null;

  // أدمن الشركة: عرض فقط، بلا قائمة.
  if (!isOwner) {
    if (!active) return null;
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{active.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-accent">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-right font-medium">
          {active ? active.name : "كل الشركات"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel>الشركة الفعّالة</DropdownMenuLabel>

        <DropdownMenuItem
          onSelect={() => switchTo.mutate(null)}
          className="flex items-center justify-between"
        >
          <span>كل الشركات</span>
          {!active && <Check className="h-4 w-4" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onSelect={() => switchTo.mutate(company.id)}
            className="flex items-center justify-between"
          >
            <span className={company.isActive ? "" : "text-muted-foreground line-through"}>
              {company.name}
            </span>
            {active?.id === company.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/companies" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span>إدارة الشركات</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
