import { useGetMe } from "@workspace/api-client-react";

export function useRole() {
  const { data: user } = useGetMe();
  const isAdmin = user?.role === "admin";
  return { isAdmin, role: user?.role };
}
