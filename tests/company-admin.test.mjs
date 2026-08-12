// Creating a company and its admin in one step.
import { api, call, check, login, section } from "./lib.mjs";

export default async function run() {
  const owner = api(await login("owner"));
  const a = api(await login("admin_a"));

  section("٢٥) شركة ومديرها في خطوة واحدة");

  const created = await owner("POST", "/companies", {
    name: "شركة دلتا",
    adminName: "مدير دلتا",
    adminEmail: "delta.admin@test.local",
    adminPhone: "0122",
  });

  check("الإنشاء نجح", created.status === 201, `${created.status} ${JSON.stringify(created.data)}`);
  check("ورجع كود انضمام", Boolean(created.data?.joinCode), JSON.stringify(created.data?.joinCode));
  check(
    "وكود تفعيل من ٦ حروف للمدير",
    /^[A-Z0-9]{6}$/.test(created.data?.admin?.activationCode ?? ""),
    JSON.stringify(created.data?.admin),
  );

  section("٢٦) المدير الجديد لا يدخل قبل التفعيل");

  check(
    "الدخول مرفوض",
    (await call("POST", "/auth/login", { username: "delta.admin@test.local", password: "Delta!2345" })).status !== 200,
  );

  const activated = await call("POST", "/auth/activate", {
    email: "delta.admin@test.local",
    code: created.data.admin.activationCode,
    password: "Delta!2345",
  });
  check("التفعيل بالكود ينجح", activated.status === 200, `${activated.status} ${JSON.stringify(activated.data)}`);

  const session = await call("POST", "/auth/login", {
    username: "delta.admin@test.local",
    password: "Delta!2345",
  });
  check("ويدخل بعدها", session.status === 200, `${session.status}`);
  check(
    "كأدمن لشركة دلتا",
    session.data?.user?.role === "admin" && session.data?.user?.company?.name === "شركة دلتا",
    JSON.stringify(session.data?.user?.company),
  );

  section("٢٧) شركته معزولة من أول لحظة");

  const delta = api(session.cookie);
  check("شركته فاضية", (await delta("GET", "/products")).data?.length === 0);
  check("لا يرى بيانات ألفا", !(await delta("GET", "/customers")).data?.some?.((c) => c.name?.includes("ألفا")));
  check("ولا تراه ألفا في مستخدميها", !(await a("GET", "/users")).data?.some((u) => u.email === "delta.admin@test.local"));

  section("٢٨) الشركة تُنشأ حتى لو تعذّر مديرها");

  // البريد مستخدم بالفعل. الشركة أُنشئت — نقولها صراحةً بدل التراجع بصمت.
  const clash = await owner("POST", "/companies", {
    name: "شركة إبسلون",
    adminName: "مدير مكرر",
    adminEmail: "delta.admin@test.local",
  });
  check("الشركة أُنشئت", clash.status === 201 && Boolean(clash.data?.id), `${clash.status}`);
  check("بلا مدير", clash.data?.admin === null);
  check("مع سبب واضح", Boolean(clash.data?.adminError), JSON.stringify(clash.data?.adminError));

  const noAdmin = await owner("POST", "/companies", { name: "شركة زيتا" });
  check("وشركة بلا مدير تُنشأ عادي", noAdmin.status === 201 && noAdmin.data?.admin === null);
  check("ولها كود انضمام", Boolean(noAdmin.data?.joinCode));

  section("٢٩) حذف شركة — الفاضية وحدها");

  // شركة أُنشئت للتجربة ولا شيء فيها: تُحذف.
  const empty = await owner("DELETE", `/companies/${noAdmin.data.id}`);
  check("الشركة الفاضية تُحذف", empty.status === 200, `${empty.status} ${JSON.stringify(empty.data)}`);
  check("واختفت من القائمة", !(await owner("GET", "/companies")).data.some((c) => c.id === noAdmin.data.id));

  // شركة فيها حساب مدير فقط: الحساب ليس بيانات عمل، فتُحذف معه.
  const withAdminOnly = await owner("DELETE", `/companies/${created.data.id}`);
  check("شركة بحساب مدير فقط تُحذف", withAdminOnly.status === 200, `${withAdminOnly.status}`);
  check("ويُقال كم حسابًا اتشال", withAdminOnly.data?.deletedUsers >= 1, JSON.stringify(withAdminOnly.data));
  check(
    "ومديرها ما بقاش يقدر يدخل",
    (await call("POST", "/auth/login", { username: "delta.admin@test.local", password: "Delta!2345" })).status !== 200,
  );

  // شركة ألفا فيها فواتير ومنتجات: يُرفض حذفها.
  const companies = (await owner("GET", "/companies")).data;
  const alpha = companies.find((c) => c.name === "شركة ألفا");
  const busy = await owner("DELETE", `/companies/${alpha.id}`);
  check("شركة فيها بيانات لا تُحذف", busy.status === 409, `${busy.status}`);
  check("والرد يقول ما فيها", Array.isArray(busy.data?.holding) && busy.data.holding.length > 0, JSON.stringify(busy.data?.holding));
  check("وهي باقية", (await owner("GET", "/companies")).data.some((c) => c.id === alpha.id));
  check("وبياناتها سليمة", (await a("GET", "/products")).data?.length > 0);

  section("٣٠) الحذف والرفض لمن يملكهما فقط");

  check("أدمن الشركة لا يحذف شركة", (await a("DELETE", `/companies/${alpha.id}`)).status === 403);

  const request = await call("POST", "/auth/signup", {
    name: "طلب للرفض",
    email: "reject.me@test.local",
    joinCode: alpha.joinCode,
  });
  check("وصل طلب جديد", request.status === 202);

  const target = (await a("GET", "/users")).data.find((u) => u.email === "reject.me@test.local");
  check("ظهر لأدمن ألفا", Boolean(target));
  check("والرفض يشيله", (await a("POST", `/users/${target.id}/reject`)).status === 200);
  check("فعلًا", !(await a("GET", "/users")).data.some((u) => u.email === "reject.me@test.local"));

  section("٣١) صندوق الطلبات لا يتأثر بتبديل الشركة");

  // طلب العميل الجديد بلا شركة، فكان يختفي لحظة تبديل المالك إلى أي شركة
  // وتردّ الموافقة بـ "الطلب غير موجود". الموافقة دور مالكٍ لا دور شخص داخل
  // شركة، فصندوق الطلبات يتجاوز التبديل.
  await call("POST", "/auth/signup", {
    name: "عميل مبدَّل",
    email: "switched@test.local",
    companyName: "شركة السويتش",
  });

  await owner("POST", `/companies/${alpha.id}/switch`);

  const inbox = await owner("GET", "/users/requests");
  check("المالك المبدَّل يرى طلب العميل الجديد", inbox.data?.some((u) => u.email === "switched@test.local"), JSON.stringify(inbox.data?.map((u) => u.email)));

  const switched = inbox.data.find((u) => u.email === "switched@test.local");
  const approvedWhileSwitched = await owner("POST", `/users/${switched.id}/approve`, { role: "admin" });
  check("ويقدر يوافق عليه", approvedWhileSwitched.status === 200, `${approvedWhileSwitched.status} ${JSON.stringify(approvedWhileSwitched.data)}`);

  await owner("POST", "/companies/switch/clear");
  check(
    "والشركة المطلوبة اتعملت",
    (await owner("GET", "/companies")).data.some((c) => c.name === "شركة السويتش"),
  );

  await call("POST", "/auth/activate", {
    email: "switched@test.local",
    code: approvedWhileSwitched.data.activationCode,
    password: "Switch!2345",
  });
  const hisSession = await call("POST", "/auth/login", {
    username: "switched@test.local",
    password: "Switch!2345",
  });
  check("ويدخل على شركته هو", hisSession.data?.user?.company?.name === "شركة السويتش", JSON.stringify(hisSession.data?.user?.company));

  const his = api(hisSession.cookie);
  check("لا يرى منتجات ألفا", !(await his("GET", "/products")).data?.some?.((p) => p.name?.includes("ألفا")));
  check("ولا عملاءها", !(await his("GET", "/customers")).data?.some?.((c) => c.name?.includes("ألفا")));

  section("٣٢) صندوق الطلبات محصور لأدمن الشركة");

  const adminInbox = await a("GET", "/users/requests");
  check(
    "أدمن ألفا لا يرى طلبات بلا شركة",
    !adminInbox.data?.some((u) => u.email === "switched@test.local"),
    JSON.stringify(adminInbox.data?.map((u) => u.email)),
  );
}
