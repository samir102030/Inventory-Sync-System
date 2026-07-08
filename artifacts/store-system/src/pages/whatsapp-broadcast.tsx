import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Search, CheckSquare, Square, Send, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  totalPurchases?: number;
};

const BASE = "/api";
const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-().+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = "20" + p.slice(1);
  if (!p.startsWith("20") && p.length === 10) p = "20" + p;
  return p;
}

export default function WhatsAppBroadcast() {
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

  const handleSend = () => {
    if (!message.trim()) {
      toast({ title: "اكتب رسالة أولاً", variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "اختر عميلاً واحداً على الأقل", variant: "destructive" });
      return;
    }

    const encodedMsg = encodeURIComponent(message.trim());
    let opened = 0;

    selectedCustomers.forEach((customer, idx) => {
      const phone = normalizePhone(customer.phone!);
      const url = `https://wa.me/${phone}?text=${encodedMsg}`;
      setTimeout(() => {
        window.open(url, "_blank");
        setSentIds((prev) => new Set([...prev, customer.id]));
      }, idx * 600);
      opened++;
    });

    toast({
      title: `جاري فتح ${opened} محادثة على واتساب`,
      description: "تأكد من السماح للمتصفح بفتح نوافذ جديدة",
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-green-500" />
            رسائل واتساب الجماعية
          </h1>
          <p className="text-muted-foreground mt-1">
            اختر العملاء واكتب رسالة — سيفتح واتساب لكل شخص تلقائياً
          </p>
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
                    <><CheckSquare className="h-4 w-4 ml-1" /> إلغاء الكل</>
                  ) : (
                    <><Square className="h-4 w-4 ml-1" /> تحديد الكل</>
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
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
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
                          <TableCell dir="ltr" className="text-right font-mono text-sm">
                            {c.phone}
                          </TableCell>
                          <TableCell>
                            {sentIds.has(c.id) ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                ✓ تم الفتح
                              </Badge>
                            ) : selected.has(c.id) ? (
                              <Badge variant="outline" className="border-green-400 text-green-600">
                                محدد
                              </Badge>
                            ) : null}
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
              <CardDescription>ستُرسل هذه الرسالة لجميع المحددين</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="اكتب رسالتك هنا..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground text-left">{message.length} حرف</div>

              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <Label className="text-xs text-muted-foreground">المحددون ({selected.size})</Label>
                {selected.size === 0 ? (
                  <p className="text-sm text-muted-foreground">لم تختر أحداً بعد</p>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {selectedCustomers.map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                size="lg"
                disabled={selected.size === 0 || !message.trim()}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
                إرسال لـ {selected.size} {selected.size === 1 ? "عميل" : "عملاء"} عبر واتساب
              </Button>

              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                سيفتح المتصفح محادثة واتساب لكل عميل تلقائياً.
                <br />
                تأكد من السماح بالنوافذ المنبثقة لهذا الموقع.
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>ملاحظة:</strong> يعمل هذا الزر عبر واتساب ويب/تطبيق واتساب مباشرة.
                لكل عميل ستُفتح نافذة منفصلة تُحمّل رسالتك جاهزة للإرسال.
                أنت من يضغط "إرسال" في كل محادثة.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
