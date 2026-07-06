import { AuthenticateWithRedirectCallback } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function GoogleSignInCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40" dir="rtl">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground">جاري تسجيل الدخول بحساب جوجل...</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-in`}
        signInForceRedirectUrl={`${basePath}/`}
        signUpForceRedirectUrl={`${basePath}/`}
      />
    </div>
  );
}
