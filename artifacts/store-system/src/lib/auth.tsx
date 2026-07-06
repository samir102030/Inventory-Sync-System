import React, { createContext, useContext, useEffect, useRef } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: ReturnType<typeof useGetMe>["data"] | undefined;
  isLoading: boolean;
  isError: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  isLoading: true,
  isError: false,
});

function useGoogleSyncBridge(hasLocalSession: boolean, localSessionLoading: boolean) {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const syncedForRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded || localSessionLoading) return;
    if (!isSignedIn) {
      syncedForRef.current = null;
      return;
    }
    if (hasLocalSession) return;
    if (syncedForRef.current) return;
    syncedForRef.current = true;

    (async () => {
      try {
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
        const res = await fetch(`${basePath}/api/auth/google-sync`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.status === "approved") {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        } else if (res.ok && data.status === "pending") {
          toast({
            title: "الحساب بانتظار موافقة الأدمن",
            description: "سيتم تفعيل حسابك بعد مراجعة المدير لطلبك",
          });
          await signOut();
        } else {
          toast({
            title: "تعذر تسجيل الدخول بحساب جوجل",
            description: data.error || "حدث خطأ غير متوقع",
            variant: "destructive",
          });
          await signOut();
        }
      } catch {
        toast({
          title: "تعذر تسجيل الدخول بحساب جوجل",
          variant: "destructive",
        });
        await signOut();
      }
    })();
  }, [isLoaded, isSignedIn, hasLocalSession, localSessionLoading, queryClient, signOut, toast]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
    },
  });

  const [, setLocation] = useLocation();

  useGoogleSyncBridge(!!user, isLoading);

  useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/login");
    }
  }, [isLoading, isError, setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
