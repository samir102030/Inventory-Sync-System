// Company switching, per-company backups and settings, moving users.
import { api, check, login, section } from "./lib.mjs";

export default async function run() {
  const owner = api(await login("owner"));
  const a = api(await login("admin_a"));
  const b = api(await login("admin_b"));

  const companies = (await owner("GET", "/companies")).data;
  const alpha = companies.find((c) => c.name === "شركة ألفا");
  const beta = companies.find((c) => c.name === "شركة بيتا");

  section("٨) تبديل الشركة");

  check("قبل التبديل بلا شركة فعّالة", (await owner("GET", "/auth/me")).data?.activeCompany === null);
  check("التبديل نجح", (await owner("POST", `/companies/${beta.id}/switch`)).status === 200);
  check(
    "‏/auth/me يعكس الشركة الفعّالة",
    (await owner("GET", "/auth/me")).data?.activeCompany?.id === beta.id,
  );

  const ownerProducts = (await owner("GET", "/products")).data;
  check(
    "المالك بعد التبديل يرى بيتا فقط",
    ownerProducts?.length > 0 && ownerProducts.every((p) => p.name.includes("بيتا")),
    JSON.stringify(ownerProducts?.map((p) => p.name)),
  );

  const madeByOwner = await owner("POST", "/products", {
    name: "منتج أنشأه المالك داخل بيتا",
    price: 10,
    categoryId: (await owner("GET", "/categories")).data[0].id,
    stock: 1,
  });
  check("المالك ينشئ داخل الشركة المختارة", madeByOwner.status < 300, `${madeByOwner.status}`);
  check("ويظهر لأدمن بيتا", (await b("GET", "/products")).data?.some((p) => p.name === "منتج أنشأه المالك داخل بيتا"));
  check("ولا يظهر لأدمن ألفا", !(await a("GET", "/products")).data?.some((p) => p.name === "منتج أنشأه المالك داخل بيتا"));

  await owner("POST", "/companies/switch/clear");
  check("بعد الإلغاء يرى الكل", (await owner("GET", "/products")).data?.length >= 5);

  section("٩) المالك بلا شركة لا ينشئ بيانات يتيمة");

  // العمود company_id يُملأ من نطاق الطلب، والنطاق هنا فارغ — فالصف يولد
  // بلا شركة ولا يراه أحد بعدها. الرفض أوضح من إنتاج بيانات صامتة.
  const orphan = await owner("POST", "/products", { name: "منتج يتيم", price: 1, categoryId: 1, stock: 0 });
  check("الإنشاء مرفوض بـ 409", orphan.status === 409, `${orphan.status}`);
  check("والرسالة توجّه لاختيار شركة", orphan.data?.code === "COMPANY_NOT_SELECTED");

  section("١٠) إعدادات الفاتورة لكل شركة");

  check("ألفا ترى إعداداتها", (await a("GET", "/settings/invoice")).data?.companyName === "شركة ألفا");
  check("بيتا ترى إعداداتها", (await b("GET", "/settings/invoice")).data?.companyName === "شركة بيتا");
  await a("PATCH", "/settings/invoice", { invoicePrefix: "ALFA" });
  check("تعديل ألفا لم يمس بيتا", (await b("GET", "/settings/invoice")).data?.invoicePrefix !== "ALFA");

  section("١١) النسخ الاحتياطي محصور في شركة واحدة");

  const exportA = await a("GET", "/backup/export");
  check("نسخة ألفا بلا أي صف من بيتا", !JSON.stringify(exportA.data).includes("بيتا"));

  const betaBefore = (await b("GET", "/products")).data?.length;

  // جداول كانت خارج قائمة الحذف المكتوبة بيد، فتبقى بعد "إعادة الضبط الكامل".
  const rental = await a("POST", "/rental", {
    propertyName: "شقة",
    tenantName: "مستأجر",
    amount: 500,
    period: "شهري",
    date: "2026-08-12",
  });
  check("إنشاء دفعة إيجار للاختبار", rental.status < 400, `${rental.status}`);

  check("إعادة تعيين ألفا نجحت", (await a("POST", "/backup/reset")).status === 200);
  check("منتجات ألفا مُسحت", (await a("GET", "/products")).data?.length === 0);
  check(
    "ودفعات الإيجار كمان",
    (await a("GET", "/rental")).data?.length === 0,
    JSON.stringify((await a("GET", "/rental")).data),
  );

  // TRUNCATE كان يتجاوز RLS تمامًا، فكانت هذه الضغطة تمسح كل الشركات.
  const betaAfter = (await b("GET", "/products")).data?.length;
  check("بيانات بيتا سليمة", betaAfter === betaBefore && betaAfter > 0, `قبل ${betaBefore} بعد ${betaAfter}`);

  check("الاستعادة نجحت", (await a("POST", "/backup/restore", exportA.data)).status === 200);
  check(
    "منتجات ألفا رجعت",
    (await a("GET", "/products")).data?.length === exportA.data.products.length,
  );
  check("وبيتا ما زالت سليمة", (await b("GET", "/products")).data?.length === betaBefore);
  check(
    "وفواتير ألفا رجعت",
    (await a("GET", "/invoices")).data?.length === exportA.data.invoices.length,
  );

  section("١٢) نقل مستخدم بين الشركات — للمالك وحده");

  const cashier = (await owner("GET", "/users")).data.find((u) => u.username === "cash_a");
  check("المالك يرى اسم شركة كل مستخدم", cashier?.companyName === "شركة ألفا", JSON.stringify(cashier));
  check("المالك ينقله لبيتا", (await owner("PATCH", `/users/${cashier.id}`, { companyId: beta.id })).status === 200);
  check("اختفى من قائمة ألفا", !(await a("GET", "/users")).data?.some((u) => u.username === "cash_a"));
  check("وظهر عند بيتا", (await b("GET", "/users")).data?.some((u) => u.username === "cash_a"));
  check(
    "أدمن ألفا لا يستطيع سحبه إليه",
    (await a("PATCH", `/users/${cashier.id}`, { companyId: alpha.id })).status >= 400,
  );
}
