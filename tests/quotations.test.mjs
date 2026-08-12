// Line discounts, automatic tax, who recorded the document, and cost privacy.
import { api, check, login, section } from "./lib.mjs";

export default async function run() {
  const a = api(await login("admin_a"));
  const cashier = api(await login("cash_a"));

  const products = (await a("GET", "/products")).data;
  const [p1, p2] = products;

  await a("PATCH", "/settings/invoice", { showTax: true, taxRate: 14 });

  section("٢٠) الخصم على مستوى البند");

  const quote = await a("POST", "/quotations", {
    customerName: "عميل تجريبي",
    items: [
      { productId: p1.id, productName: p1.name, quantity: 2, unitPrice: 100, discount: 30 },
      { productId: p2.id, productName: p2.name, quantity: 1, unitPrice: 200, discount: 0 },
    ],
    discount: 20,
  });
  check("إنشاء عرض ببنود مخصومة", quote.status === 200, `${quote.status} ${JSON.stringify(quote.data)}`);
  // ‏2×100−30 = 170 و 1×200 = 200 ⇒ 370
  check("المجموع يطرح خصم كل بند", Number(quote.data?.subtotal) === 370, `${quote.data?.subtotal}`);

  section("٢١) الضريبة تُحسب من الإعدادات");

  // ‏(370 − 20) × 14% = 49
  check("‏14% على الصافي بعد الخصم", Number(quote.data?.tax) === 49, `${quote.data?.tax}`);
  check("الإجمالي = صافي + ضريبة", Number(quote.data?.total) === 399, `${quote.data?.total}`);
  check(
    "خصم البند محفوظ ويرجع في التفاصيل",
    Number((await a("GET", `/quotations/${quote.data.id}`)).data?.items?.[0]?.discount) === 30,
  );

  const manual = await a("POST", "/quotations", {
    customerName: "تجاوز يدوي",
    items: [{ productId: p1.id, productName: p1.name, quantity: 1, unitPrice: 100 }],
    discount: 0,
    tax: 5,
  });
  check("التجاوز اليدوي يُحترم", Number(manual.data?.tax) === 5, `${manual.data?.tax}`);

  await a("PATCH", "/settings/invoice", { showTax: false });
  const noTax = await a("POST", "/quotations", {
    customerName: "بلا ضريبة",
    items: [{ productId: p1.id, productName: p1.name, quantity: 1, unitPrice: 100 }],
  });
  check("صفر لما تكون الضريبة مغلقة", Number(noTax.data?.tax) === 0, `${noTax.data?.tax}`);
  await a("PATCH", "/settings/invoice", { showTax: true, taxRate: 14 });

  section("٢٢) من أنشأ المستند");

  // كان يُقرأ من حقل جلسة لا يُضبط إطلاقًا، فيبقى فارغًا في كل مستند.
  check("عرض السعر يسجّله", quote.data?.createdBy === "أدمن ألفا", JSON.stringify(quote.data?.createdBy));

  const invoice = await a("POST", "/invoices", {
    items: [{ productId: p1.id, quantity: 1, unitPrice: 100 }],
    paymentMethod: "cash",
    accountId: (await a("GET", "/accounts")).data[0].id,
  });
  check("والفاتورة كذلك", invoice.data?.createdBy === "أدمن ألفا", JSON.stringify(invoice.data?.createdBy));

  section("٢٣) سعر التكلفة لا يصل للكاشير");

  // الإخفاء في الواجهة ترتيبٌ للشاشة؛ الحقل كان يصل في الرد ويُقرأ من أدوات
  // المطوّر. الحماية هي ألا يُرسَل أصلًا.
  check("الأدمن يرى التكلفة", (await a("GET", "/products")).data[0].costPrice !== null);
  check("الكاشير لا يراها في القائمة", (await cashier("GET", "/products")).data[0].costPrice === null);
  check("ولا في منتج بعينه", (await cashier("GET", `/products/${p1.id}`)).data?.costPrice === null);
  check("وتتبع المنتج ممنوع عليه", (await cashier("GET", "/products/tracking?q=منتج")).status === 403);
  check("والأدمن يفتحه عادي", (await a("GET", "/products/tracking?q=منتج")).status === 200);

  section("٢٤) التحويل لفاتورة ينقل خصم البند");

  const converted = await a("POST", `/quotations/${quote.data.id}/convert`);
  check("التحويل نجح", converted.status === 200, `${converted.status} ${JSON.stringify(converted.data)}`);

  // بدون نقل الخصم تخرج الفاتورة أعلى من العرض الذي وافق عليه العميل.
  const lines = (await a("GET", `/invoices/${converted.data.invoiceId}`)).data?.items;
  check("خصم البند وصل للفاتورة", lines?.some((i) => Number(i.discount) === 30), JSON.stringify(lines?.map((i) => i.discount)));
}
