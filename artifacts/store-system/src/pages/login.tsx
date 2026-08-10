import React, { useState, useEffect } from "react";
import { useLogin, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { data: user } = useGetMe();

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user]);

  if (user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: () => {
          setLocation("/dashboard");
        },
        onError: (error: any) => {
          const status = error?.status ?? error?.response?.status;
          const serverMessage = error?.data?.error;
          toast({
            title: status === 401 ? "بيانات الدخول غير صحيحة" : "تعذر تسجيل الدخول",
            description: status === 401
              ? "تأكد من اسم المستخدم وكلمة المرور."
              : serverMessage || (status === 503
                ? "قاعدة البيانات أو الخادم غير متاح مؤقتاً. حاول مرة أخرى بعد لحظات."
                : "تعذر الاتصال بالخادم مؤقتاً. حاول مرة أخرى بعد لحظات."),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <Card className="z-10 w-full max-w-sm shadow-xl">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">نظام إدارة المتجر</CardTitle>
          <CardDescription>تسجيل الدخول للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-left"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-6"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

        </CardContent>
      </Card>
    </div>
  );
}
