import { useQuery } from "@tanstack/react-query";
import { jsonOrThrow } from "@/lib/http";

/**
 * جلسة المستخدم كما يراها الخادم، بما فيها الشركة الفعّالة.
 *
 * لماذا ليست `useGetMe` المولّدة؟ لأن مخطط OpenAPI لا يعرف حقول الشركة بعد،
 * والعميل المولّد لا يُحرَّر يدويًا. هذا الخطّاف يقرأ نفس المسار بنوع محلي.
 */

export type CompanyRef = { id: number; name: string } | null;

export type Session = {
  id: number;
  username: string;
  name: string;
  role: string;
  companyId: number | null;
  /** شركة المستخدم نفسه — فارغة لمالك النظام. */
  company: CompanyRef;
  /** الشركة التي يعمل داخلها الآن — للمالك بعد التبديل. */
  activeCompany: CompanyRef;
};

export const SESSION_QUERY_KEY = ["session", "me"] as const;

export function useSession() {
  return useQuery<Session>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(jsonOrThrow),
    retry: false,
  });
}

/** الشركة التي تُعرض بياناتها الآن: شركة المستخدم، أو ما اختاره المالك. */
export function activeCompanyOf(session: Session | undefined): CompanyRef {
  if (!session) return null;
  return session.role === "owner" ? session.activeCompany : session.company;
}
