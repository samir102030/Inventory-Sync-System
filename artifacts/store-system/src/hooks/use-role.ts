import { useGetMe } from "@workspace/api-client-react";

export function useRole() {
  const { data: user } = useGetMe();
  const isOwner = user?.role === "owner";
  // مالك النظام فوق الأدمن: كل ما يراه الأدمن يراه المالك.
  const isAdmin = user?.role === "admin" || isOwner;
  return { isAdmin, isOwner, role: user?.role };
}
