import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Inbox, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsonOrThrow } from "@/lib/http";

/**
 * طلبات التسجيل — صفحة مستقلة.
 *
 * كانت في أعلى شاشة الإعدادات، فلا يراها أحد إلا بالصدفة. طلبٌ لا يُرى هو
 * عميل ينتظر بلا رد.
 *
 * ما يظهر هنا تحدده سياسات RLS وحدها: أدمن الشركة يرى طلبات شركته، ومالك
 * النظام يرى معها طلبات العملاء الجدد — فهي بلا شركة ولا تظهر تحت نطاق أحد.
 */

type Request = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  companyName: string | null;
  requestedCompanyName: string | null;
  createdAt: string;
};

type Approved = {
  id: number;
  name: string;
  email: string | null;
  activationCode: string;
  emailSent: boolean;
  emailError: string | null;
};

export default function Requests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleById, setRoleById] = useState<Record<number, string>>({});
  const [approved, setApproved] = useState<Approved[]>([]);

  // مسار خاص لا `/users`: المالك يرى كل الطلبات هنا مهما كانت الشركة التي
  // بدّل إليها، لأن الموافقة دور مالكٍ لا دور شخص داخل شركة.
  const { data: users = [], isLoading } = useQuery<Request[]>({
    queryKey: ["users", "requests"],
    queryFn: () => fetch("/api/users/requests", { credentials: "include" }).then(jsonOrThrow),
  });

  const pending = users.filter((u) => u.status === "pending");
  const awaiting = users.filter((u) => u.status === "invited");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const approve = useMutation({
    mutationFn: (user: Request) =>
      fetch(`/api/users/${user.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: roleById[user.id] ?? "cashier" }),
      })
        .then(jsonOrThrow)
        .then((result) => ({ user, result })),
    onSuccess: ({ user, result }) => {
      setApproved((prev) => [
        { id: user.id, name: user.name, email: user.email, ...result },
        ...prev,
      ]);
      refresh();
      toast({
        title: result.emailSent ? "تم القبول وأُرسل الكود بالبريد" : "تم القبول",
        description: result.emailSent ? undefined : "تعذّر إرسال البريد — سلّم الكود بنفسك.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "تعذّر قبول الطلب", description: error.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: (user: Request) =>
      fetch(`/api/users/${user.id}/reject`, { method: "POST", credentials: "include" }).then(jsonOrThrow),
    onSuccess: () => {
      refresh();
      toast({ title: "تم رفض الطلب" });
    },
    onError: (error: Error) =>
      toast({ title: "تعذّر رفض الطلب", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">طلبات التسجيل</h1>
        <p className="text-sm text-muted-foreground">
          حسابات جديدة تنتظر موافقتك. عند القبول يُرسَل كود تفعيل على بريد صاحب الطلب.
        </p>
      </div>

      {/* الكود يُخزَّن مبصومًا فقط، فلا سبيل لعرضه بعد مغادرة الصفحة. */}
      {approved.length > 0 && (
        <Card className="border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">أكواد التفعيل</CardTitle>
            <CardDescription>لن تظهر مرة أخرى بعد مغادرة الصفحة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {approved.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{item.name}</span>
                <code className="rounded bg-background px-2 py-1 text-base font-bold tracking-[0.3em]">
                  {item.activationCode}
                </code>
                <span className="text-muted-foreground">
                  {item.emailSent ? `أُرسل على ${item.email}` : `لم يُرسل: ${item.emailError}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            بانتظار الموافقة
            {pending.length > 0 && <Badge>{pending.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الشركة</TableHead>
                <TableHead>الصلاحية</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">جاري التحميل...</TableCell></TableRow>
              ) : pending.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">مفيش طلبات جديدة.</TableCell></TableRow>
              ) : (
                pending.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{user.email ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-right">{user.phone ?? "—"}</TableCell>
                    <TableCell>
                      {user.companyName ?? (
                        <span className="text-amber-600">شركة جديدة: {user.requestedCompanyName ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={roleById[user.id] ?? "cashier"}
                        onValueChange={(v) => setRoleById({ ...roleById, [user.id]: v })}
                      >
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">مدير النظام</SelectItem>
                          <SelectItem value="cashier">كاشير</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate(user)}
                          title="قبول"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          disabled={reject.isPending}
                          onClick={() => {
                            if (confirm(`رفض طلب ${user.name}؟ الطلب هيتشال نهائيًا.`)) reject.mutate(user);
                          }}
                          title="رفض"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* حساب وُوفق عليه ولم يُفعَّل بعد يبدو موجودًا وهو لا يعمل — فيُعرض
          صراحةً بدل أن يختفي بين المستخدمين. */}
      {awaiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">وُوفق عليهم ولم يفعّلوا بعد</CardTitle>
            <CardDescription>وصلهم الكود ولم يختاروا كلمة المرور. تقدر ترسل لهم كودًا جديدًا بالقبول مرة أخرى.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {awaiting.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{user.email ?? "—"}</TableCell>
                    <TableCell>{user.companyName ?? "—"}</TableCell>
                    <TableCell className="w-[140px]">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(user)}
                      >
                        كود جديد
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
