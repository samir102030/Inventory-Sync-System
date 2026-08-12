// No company may read or touch another company's rows.
import { api, check, login, names, section } from "./lib.mjs";

export default async function run() {
  const owner = api(await login("owner"));
  const a = api(await login("admin_a"));
  const b = api(await login("admin_b"));
  const cashier = api(await login("cash_a"));

  section("١) كل أدمن يرى بيانات شركته فقط");

  const resources = [
    ["/products", ["منتج ألفا ١", "منتج ألفا ٢"], ["منتج بيتا ١", "منتج بيتا ٢"]],
    ["/customers", ["عميل ألفا"], ["عميل بيتا"]],
    ["/categories", ["فئة ألفا"], ["فئة بيتا"]],
    ["/warehouses", ["مخزن ألفا"], ["مخزن بيتا"]],
    ["/accounts", ["خزينة ألفا"], ["خزينة بيتا"]],
  ];

  for (const [path, expectA, expectB] of resources) {
    const ra = await a("GET", path);
    const rb = await b("GET", path);
    check(`${path} — ألفا`, JSON.stringify(names(ra.data)) === JSON.stringify(expectA), JSON.stringify(names(ra.data)));
    check(`${path} — بيتا`, JSON.stringify(names(rb.data)) === JSON.stringify(expectB), JSON.stringify(names(rb.data)));
  }

  const invA = await a("GET", "/invoices");
  const invB = await b("GET", "/invoices");
  check("‏/invoices — ألفا فاتورة واحدة", invA.data?.length === 1, `${invA.data?.length}`);
  check("‏/invoices — بيتا فاتورة واحدة", invB.data?.length === 1, `${invB.data?.length}`);
  check(
    "كل شركة لها INV-00001 الخاص بها",
    invA.data?.[0]?.id !== invB.data?.[0]?.id &&
      invA.data?.[0]?.invoiceNumber === invB.data?.[0]?.invoiceNumber,
    `${invA.data?.[0]?.id} vs ${invB.data?.[0]?.id}`,
  );

  section("٢) لا وصول لصف الشركة الأخرى برقمه المباشر");

  const productB = (await b("GET", "/products")).data[0];

  check(`GET منتج بيتا من ألفا يُرفض`, (await a("GET", `/products/${productB.id}`)).status === 404);

  const patched = await a("PATCH", `/products/${productB.id}`, { name: "اختراق" });
  check("PATCH منتج بيتا من ألفا يُرفض", patched.status >= 400, `status ${patched.status}`);
  check("اسم منتج بيتا لم يتغيّر", (await b("GET", `/products/${productB.id}`)).data?.name !== "اختراق");

  await a("DELETE", `/products/${productB.id}`);
  const stillThere = await b("GET", `/products/${productB.id}`);
  check("DELETE من ألفا لم يحذف منتج بيتا", stillThere.status === 200 && stillThere.data?.id === productB.id);

  section("٣) الإنشاء يأخذ شركة صاحبه تلقائيًا");

  const categoryA = (await a("GET", "/categories")).data[0];
  const created = await a("POST", "/products", {
    name: "منتج جديد من ألفا",
    price: 50,
    categoryId: categoryA.id,
    stock: 1,
  });
  check("ألفا أنشأ منتجًا", created.status < 300, `${created.status} ${JSON.stringify(created.data)}`);
  check("لا يظهر لبيتا", !(await b("GET", "/products")).data?.some((p) => p.name === "منتج جديد من ألفا"));
  check("ويظهر لألفا", (await a("GET", "/products")).data?.some((p) => p.name === "منتج جديد من ألفا"));

  section("٤) المالك يرى الكل قبل التبديل");
  check("المالك يرى منتجات الشركتين", (await owner("GET", "/products")).data?.length >= 4);

  section("٥) حساب المالك مخفي عن الأدمن");
  const usersA = (await a("GET", "/users")).data;
  check("قائمة ألفا بلا المالك", !usersA?.some((u) => u.role === "owner"), JSON.stringify(usersA?.map((u) => u.username)));
  check("وبلا أدمن بيتا", !usersA?.some((u) => u.username === "admin_b"));

  section("٦) الكاشير محصور في شركته أيضًا");
  const cashierProducts = (await cashier("GET", "/products")).data;
  check(
    "كاشير ألفا لا يرى منتجات بيتا",
    !cashierProducts?.some?.((p) => p.name?.includes("بيتا")),
    JSON.stringify(names(cashierProducts)),
  );

  section("٧) التزامن — هذا وحده يمسك خطأ SET مقابل SET LOCAL");

  // العطل الذي يحاول هذا الاختبار كشفه لا يظهر في طلب واحد إطلاقًا: PgBouncer
  // يعيد استخدام نفس الاتصال، فتتسرب هوية شركة إلى الطلب التالي تحت الضغط.
  const interleaved = await Promise.all(
    Array.from({ length: 60 }, (_, i) => {
      const who = i % 2 === 0 ? a : b;
      const other = i % 2 === 0 ? "بيتا" : "ألفا";
      return who("GET", "/products").then((r) => ({
        leaked: r.data?.some?.((p) => p.name?.includes(other)) ?? true,
      }));
    }),
  );
  const leaks = interleaved.filter((r) => r.leaked);
  check("لا تسريب في 60 طلبًا متوازيًا على /products", leaks.length === 0, `${leaks.length} سرّبوا`);

  const mixed = await Promise.all(
    Array.from({ length: 40 }, (_, i) => {
      const who = i % 2 === 0 ? a : b;
      const other = i % 2 === 0 ? "بيتا" : "ألفا";
      const path = ["/customers", "/invoices", "/accounts", "/warehouses"][i % 4];
      return who("GET", path).then((r) => ({
        path,
        leaked: Array.isArray(r.data) && r.data.some((row) => JSON.stringify(row).includes(other)),
      }));
    }),
  );
  check(
    "لا تسريب في 40 طلبًا متوازيًا على مسارات مختلفة",
    mixed.every((m) => !m.leaked),
    JSON.stringify(mixed.filter((m) => m.leaked).slice(0, 3)),
  );
}
