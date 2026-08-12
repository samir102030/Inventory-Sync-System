import React, { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsonOrThrow } from "@/lib/http";

/**
 * التسجيل الذاتي.
 *
 * مساران في شاشة واحدة، لأن الفرق بينهما سؤال واحد: هل لك شركة قائمة؟
 *   موظف  ⇒ كود انضمام شركته، فيصل طلبه لأدمنها.
 *   عميل  ⇒ اسم شركته، فيصل طلبه لمالك النظام وتُنشأ الشركة عند الموافقة.
 *
 * لا كلمة مرور هنا: تُختار عند التفعيل بعد الموافقة، فلا يوجد حساب بكلمة
 * مرور صالحة قبل أن يوافق عليه إنسان.
 */

const post = (path: string, body: unknown) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  }).then(jsonOrThrow);

function Shell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <Card className="z-10 w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

export default function Signup() {
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [mode, setMode] = useState<"employee" | "client">("employee");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/api/auth/signup", {
        name,
        email,
        phone,
        ...(mode === "employee" ? { joinCode } : { companyName }),
      });
      setDone(true);
    } catch (error: any) {
      toast({ title: "تعذر إرسال الطلب", description: error.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Shell title="تم إرسال طلبك" description="خطوة واحدة باقية">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="text-sm leading-7">
            طلبك في انتظار الموافقة. لما يتم قبوله هيوصلك <strong>كود تفعيل</strong> على
            بريدك، تدخّله وتختار كلمة السر بتاعتك.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/activate">عندي كود تفعيل بالفعل</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">رجوع لتسجيل الدخول</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="تسجيل حساب جديد" description="اختر ما ينطبق عليك">
      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employee">موظف في شركة</TabsTrigger>
          <TabsTrigger value="client">شركة جديدة</TabsTrigger>
        </TabsList>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-left" />
          </div>

          <TabsContent value="employee" className="mt-0 space-y-2">
            <Label>كود الشركة</Label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="مثال: K7QM2XPD"
              required={mode === "employee"}
              dir="ltr"
              className="text-left tracking-widest"
            />
            <p className="text-xs text-muted-foreground">اطلبه من مدير النظام في شركتك.</p>
          </TabsContent>

          <TabsContent value="client" className="mt-0 space-y-2">
            <Label>اسم شركتك</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required={mode === "client"}
            />
            <p className="text-xs text-muted-foreground">
              هتتعمل لك شركة جديدة على النظام بعد الموافقة، وتبقى إنت مديرها.
            </p>
          </TabsContent>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "جاري الإرسال..." : "إرسال الطلب"}
          </Button>
        </form>
      </Tabs>

      <Button asChild variant="ghost" className="mt-2 w-full">
        <Link href="/login">عندي حساب بالفعل</Link>
      </Button>
    </Shell>
  );
}

export function Activate() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await post("/api/auth/activate", { email, code, password });
      setDone(true);
    } catch (error: any) {
      toast({ title: "تعذر التفعيل", description: error.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Shell title="تم تفعيل حسابك" description="تقدر تدخل دلوقتي">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="text-sm">سجّل الدخول ببريدك وكلمة المرور اللي اخترتها.</p>
          <Button asChild className="w-full">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="تفعيل الحساب" description="أدخل الكود اللي وصلك على بريدك">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
            className="text-left"
          />
        </div>
        <div className="space-y-2">
          <Label>كود التفعيل</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            dir="ltr"
            className="text-left text-lg tracking-[0.4em]"
            placeholder="XXXXXX"
          />
        </div>
        <div className="space-y-2">
          <Label>كلمة المرور الجديدة</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            dir="ltr"
            className="text-left"
          />
          <p className="text-xs text-muted-foreground">٨ أحرف على الأقل.</p>
        </div>
        <div className="space-y-2">
          <Label>تأكيد كلمة المرور</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            dir="ltr"
            className="text-left"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "جاري التفعيل..." : "تفعيل الحساب"}
        </Button>
      </form>

      <Button asChild variant="ghost" className="mt-2 w-full">
        <Link href="/login">رجوع</Link>
      </Button>
    </Shell>
  );
}
