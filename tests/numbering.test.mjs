// Document numbers must survive a deletion and stay independent per company.
import { api, check, login, section } from "./lib.mjs";

export default async function run() {
  const a = api(await login("admin_a"));
  const b = api(await login("admin_b"));

  const product = (await a("GET", "/products")).data[0];
  const account = (await a("GET", "/accounts")).data[0];
  const line = { productId: product.id, quantity: 1, unitPrice: 100 };
  const draft = { items: [line], paymentMethod: "cash", accountId: account.id };

  section("١٣) الترقيم مع وجود فجوة — سبب عطل الإنتاج");

  // كان الرقم التالي = عدد الصفوف + 1. بعد حذف فاتورة من النص يعيد الرقم
  // نفسه فيصطدم بقيد التفرّد، ولا تُنشأ فاتورة بعدها أبدًا.
  const first = await a("POST", "/invoices", draft);
  const second = await a("POST", "/invoices", draft);
  check("إنشاء فاتورتين", first.status === 201 && second.status === 201);

  check("حذف فاتورة من النص", (await a("DELETE", `/invoices/${first.data.id}`)).status < 400);

  const afterGap = await a("POST", "/invoices", draft);
  check("الفاتورة التالية تنجح", afterGap.status === 201, `${afterGap.status} ${JSON.stringify(afterGap.data)}`);
  check(
    "ورقمها أكبر من الموجود",
    afterGap.data?.invoiceNumber > second.data?.invoiceNumber,
    `${afterGap.data?.invoiceNumber} بعد ${second.data?.invoiceNumber}`,
  );

  section("١٤) الترقيم مستقل بين الشركتين");

  const firstB = await b("POST", "/invoices", {
    items: [{ productId: (await b("GET", "/products")).data[0].id, quantity: 1, unitPrice: 50 }],
    paymentMethod: "cash",
    accountId: (await b("GET", "/accounts")).data[0].id,
  });
  check("بيتا تنشئ فاتورة رغم أرقام ألفا", firstB.status === 201, `${firstB.status}`);

  const numbersA = (await a("GET", "/invoices")).data.map((i) => i.invoiceNumber);
  const numbersB = (await b("GET", "/invoices")).data.map((i) => i.invoiceNumber);
  check(
    "الشركتان تستخدمان نفس الأرقام بلا تصادم",
    numbersA.some((n) => numbersB.includes(n)),
    `ألفا=${numbersA} بيتا=${numbersB}`,
  );

  section("١٥) لا تخزين لردود الـ API في المتصفح");

  // رد محفوظ من شركة سابقة يظهر على الشاشة بعد التبديل، حتى وقاعدة البيانات
  // لم ترسله. لا يجوز تخزين شيء من هذه الردود.
  const { res } = await a("GET", "/products");
  check(
    "ترويسة Cache-Control: no-store",
    (res.headers.get("cache-control") ?? "").includes("no-store"),
    res.headers.get("cache-control") ?? "غائبة",
  );
}
