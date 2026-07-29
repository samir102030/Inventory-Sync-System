import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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

/** Banner ظاهر لما الاتصال ينقطع مؤقتاً */
function ReconnectingBanner() {
  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        background: "#f59e0b", color: "#1a1a1a",
        padding: "10px 16px", textAlign: "center",
        fontSize: "14px", fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      }}
    >
      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #1a1a1a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      جاري استعادة الاتصال... شغلك محفوظ، لا تغلق الصفحة
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // نحاول 3 مرات قبل ما نحكم بالفشل، مع تأخير متزايد
  const { data: user, isLoading, isError, failureCount } = useGetMe({
    query: {
      retry: (count, error: any) => {
        // لو 401 (مش مسجل دخول فعلاً) متعاودش — حوّل للـ login
        if (error?.response?.status === 401) return false;
        return count < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // 1s, 2s, 4s
    },
  });

  const [, setLocation] = useLocation();
  // نحسب لو بنعيد المحاولة (فشل لكن لسه ما استنفذناش الـ retries)
  const isRetrying = isError === false && !isLoading && failureCount > 0;
  // بنعرض البنر لما يكون في فشل لكن لسه بيعيد المحاولة أو لما failureCount > 0 والـ user موجود
  const [showBanner, setShowBanner] = useState(false);

  useGoogleSyncBridge(!!user, isLoading);

  useEffect(() => {
    if (!isLoading && isError) {
      // استنفذنا كل المحاولات → روح للـ login
      setShowBanner(false);
      setLocation("/login");
    } else if (failureCount > 0 && !isError) {
      // في محاولة إعادة اتصال جارية
      setShowBanner(true);
    } else if (user) {
      setShowBanner(false);
    }
  }, [isLoading, isError, failureCount, user, setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isError }}>
      {showBanner && <ReconnectingBanner />}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
