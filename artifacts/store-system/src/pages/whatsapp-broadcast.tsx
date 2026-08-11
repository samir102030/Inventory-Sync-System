import { jsonOrThrow } from "@/lib/http";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Search, CheckSquare, Square, Send, Users, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
};

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then(jsonOrThrow);

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-().+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = "20" + p.slice(1);
  if (!p.startsWith("20") && p.length === 10) p = "20" + p;
  return p;
}

type Step = "compose" | "send";

export default function WhatsAppBroadcast() {
  const [step, setStep] = useState<Step>("compose");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => fetchJSON(`${BASE}/customers`),
  });

  const withPhone = useMemo(
    () => customers.filter((c) => c.phone && c.phone.trim().length >= 7),
    [customers]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return withPhone;
    const q = search.toLowerCase();
    return withPhone.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
    );
  }, [withPhone, search]);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const selectedCustomers = withPhone.filter((c) => selected.has(c.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const handlePrepare = () => {
    if (!message.trim()) {
      toast({ title: "اكتب رسالة أولاً", variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "اختر عميلاً واحداً على الأقل", variant: "destructive" });
      return;
    }
    setSentIds(new Set());
    setStep("send");
  };

  const handleOpenOne = (customer: Customer) => {
    const phone = normalizePhone(customer.phone!);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`;
    window.open(url, "_blank");
    setSentIds((prev) => new Set([...prev, customer.id]));
  };

  const handleReset = () => {
    setStep("compose");
    setSentIds(new Set());
  };

  if (step === "send") {
    const done = sentIds.size;
    const total = selectedCustomers.length;
    const allDone = done === total;

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-green-500" />
              قائمة الإرسال
            </h1>
            <p className="text-muted-foreground text-sm">اضغط على زر واتساب لكل عميل لفتح محادثته</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-5 py-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">التقدم</span>
              <span className="text-sm text-muted-foreground">{done} / {total}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
          {allDone && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0">
              <CheckCircle2 className="h-3 w-3 ml-1" /> اكتمل
            </Badge>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">الرسالة: </span>
          {message.length > 80 ? message.slice(0, 80) + "..." : message}
        </div>

        <div className="space-y-2">
          {selectedCustomers.map((c) => {
            const sent = sentIds.has(c.id);
            return (
              <div
                key={c.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${sent ? "bg-green-50 border-green-200" : "bg-background"}`}
              >
                <div className="flex items-center gap-3">
                  {sent ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-mono" dir="ltr">{c.phone}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={sent ? "outline" : "default"}
                  className={sent
                    ? "border-green-300 text-green-600 hover:bg-green-50 gap-1"
                    : "bg-green-600 hover:bg-green-700 text-white gap-1"
                  }
                  onClick={() => handleOpenOne(c)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {sent ? "فتح مجدداً" : "فتح واتساب"}
                </Button>
              </div>
            );
          })}
        </div>

        {allDone && (
          <Button variant="outline" className="w-full gap-2" onClick={handleReset}>
            <RefreshCw className="h-4 w-4" />
            إرسال رسالة جديدة
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-green-500" />
            رسائل واتساب الجماعية
          </h1>
          <p className="text-muted-foreground mt-1">اختر العملاء واكتب رسالة</p>
        </div>
        <Badge variant="outline" className="text-base px-4 py-2">
          <Users className="h-4 w-4 ml-2" />
          {withPhone.length} عميل بهم أرقام
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">قائمة العملاء</CardTitle>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {allFilteredSelected ? (
                    <><CheckSquare className="h-4 w-4 ml-1" />إلغاء الكل</>
                  ) : (
                    <><Square className="h-4 w-4 ml-1" />تحديد الكل</>
                  )}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الرقم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>رقم الهاتف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                          لا يوجد عملاء بأرقام هاتف
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => (
                        <TableRow
                          key={c.id}
                          className={`cursor-pointer transition-colors ${selected.has(c.id) ? "bg-green-50 hover:bg-green-100" : "hover:bg-muted/50"}`}
                          onClick={() => toggleOne(c.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(c.id)}
                              onCheckedChange={() => toggleOne(c.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell dir="ltr" className="text-right font-mono text-sm text-muted-foreground">
                            {c.phone}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الرسالة</CardTitle>
              <CardDescription>ستُرسل لجميع العملاء المحددين ({selected.size})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="اكتب رسالتك هنا..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground text-left">{message.length} حرف</div>

              {selected.size > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">المحددون ({selected.size})</p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {selectedCustomers.map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs bg-white">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                size="lg"
                disabled={selected.size === 0 || !message.trim()}
                onClick={handlePrepare}
              >
                <Send className="h-4 w-4" />
                تجهيز الإرسال لـ {selected.size} {selected.size === 1 ? "عميل" : "عملاء"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
