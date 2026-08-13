import { useGetMe } from "@workspace/api-client-react";

export function useRole() {
  const { data: user } = useGetMe();

  /**
   * الأدوار في مخطط OpenAPI ما زالت `admin | cashier` وحدهما، بينما النظام
   * فيه `owner` و `vendor` أيضًا؛ والعميل المولّد لا يُحرَّر يدويًا. النص
   * هنا هو الحقيقة، والمقارنة به تعمل مع أي دور يُضاف لاحقًا.
   */
  const role = user?.role as string | undefined;

  const isOwner = role === "owner";
  // مالك النظام فوق الأدمن: كل ما يراه الأدمن يراه المالك.
  const isAdmin = role === "admin" || isOwner;

  return { isAdmin, isOwner, role };
}
