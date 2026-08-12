// Self-signup: employee joining a company, and a new client company.
import { api, call, check, login, section } from "./lib.mjs";

export default async function run() {
  const owner = api(await login("owner"));
  const a = api(await login("admin_a"));
  const b = api(await login("admin_b"));

  const companies = (await owner("GET", "/companies")).data;
  const alpha = companies.find((c) => c.name === "شركة ألفا");

  section("١٦) كود الانضمام");
  check("كل شركة لها كود", companies.every((c) => c.joinCode?.length >= 8), JSON.stringify(companies.map((c) => c.joinCode)));
  check("والأكواد مختلفة", new Set(companies.map((c) => c.joinCode)).size === companies.length);

  section("١٧) مسار الموظف");

  const bad = await call("POST", "/auth/signup", { name: "س", email: "bad@x.test", joinCode: "ZZZZZZZZ" });
  check("كود غلط يُرفض", bad.status === 400 && bad.data?.code === "BAD_JOIN_CODE", `${bad.status}`);

  const signup = await call("POST", "/auth/signup", {
    name: "موظف جديد",
    email: "emp@alfa.test",
    phone: "0100",
    joinCode: alpha.joinCode,
  });
  check("التسجيل بكود صحيح يُقبل", signup.status === 202, `${signup.status} ${JSON.stringify(signup.data)}`);
  check(
    "لا دخول قبل الموافقة",
    (await call("POST", "/auth/login", { username: "emp@alfa.test", password: "anything" })).status !== 200,
  );

  const pendingForA = (await a("GET", "/users")).data.filter((u) => u.status === "pending");
  check("الطلب يظهر لأدمن ألفا", pendingForA.some((u) => u.email === "emp@alfa.test"));
  check(
    "ولا يظهر لأدمن بيتا",
    !(await b("GET", "/users")).data.some((u) => u.email === "emp@alfa.test"),
  );

  const target = pendingForA.find((u) => u.email === "emp@alfa.test");
  const approval = await a("POST", `/users/${target.id}/approve`, { role: "cashier" });
  check("أدمن ألفا يوافق", approval.status === 200, `${approval.status} ${JSON.stringify(approval.data)}`);
  check("ويرجع كود من ٦ حروف", /^[A-Z0-9]{6}$/.test(approval.data?.activationCode ?? ""), approval.data?.activationCode);

  check(
    "لا دخول قبل التفعيل",
    (await call("POST", "/auth/login", { username: "emp@alfa.test", password: "Passw0rd!23" })).status !== 200,
  );
  check(
    "كود تفعيل غلط يُرفض",
    (await call("POST", "/auth/activate", { email: "emp@alfa.test", code: "AAAAAA", password: "Passw0rd!23" })).status === 400,
  );

  const activated = await call("POST", "/auth/activate", {
    email: "emp@alfa.test",
    code: approval.data.activationCode,
    password: "Passw0rd!23",
  });
  check("التفعيل بالكود الصحيح ينجح", activated.status === 200, `${activated.status}`);

  const loggedIn = await call("POST", "/auth/login", { username: "emp@alfa.test", password: "Passw0rd!23" });
  check("الدخول بالإيميل ينجح", loggedIn.status === 200, `${loggedIn.status}`);
  check("وانضم لشركة ألفا", loggedIn.data?.user?.company?.name === "شركة ألفا");

  const employee = api(loggedIn.cookie);
  const seen = (await employee("GET", "/products")).data;
  check("ويرى منتجات ألفا فقط", Array.isArray(seen) && seen.every((p) => p.name.includes("ألفا")));

  check(
    "الكود لا يُستخدم مرتين",
    (await call("POST", "/auth/activate", {
      email: "emp@alfa.test",
      code: approval.data.activationCode,
      password: "Other!2345",
    })).status === 400,
  );

  section("١٨) مسار العميل الجديد");

  const client = await call("POST", "/auth/signup", {
    name: "عميل جديد",
    email: "client@new.test",
    phone: "0111",
    companyName: "شركة جاما",
  });
  check("التسجيل بلا كود يُقبل", client.status === 202, `${client.status}`);

  const request = (await owner("GET", "/users")).data.find((u) => u.email === "client@new.test");
  check("الطلب يظهر للمالك", Boolean(request));
  check("مع اسم الشركة المطلوبة", request?.requestedCompanyName === "شركة جاما");
  check("ولا يظهر لأي أدمن شركة", !(await a("GET", "/users")).data.some((u) => u.email === "client@new.test"));
  check(
    "أدمن الشركة لا يوافق على عميل جديد",
    (await a("POST", `/users/${request.id}/approve`, { role: "admin" })).status >= 400,
  );

  const ownerApproval = await owner("POST", `/users/${request.id}/approve`, { role: "admin" });
  check("المالك يوافق", ownerApproval.status === 200, `${ownerApproval.status}`);

  const gamma = (await owner("GET", "/companies")).data.find((c) => c.name === "شركة جاما");
  check("الشركة الجديدة اتعملت", Boolean(gamma));
  check("ولها كود انضمام", Boolean(gamma?.joinCode));

  await call("POST", "/auth/activate", {
    email: "client@new.test",
    code: ownerApproval.data.activationCode,
    password: "Client!2345",
  });
  const clientLogin = await call("POST", "/auth/login", { username: "client@new.test", password: "Client!2345" });
  check("العميل يدخل بحسابه", clientLogin.status === 200);
  check(
    "كأدمن لشركته الجديدة",
    clientLogin.data?.user?.role === "admin" && clientLogin.data?.user?.company?.name === "شركة جاما",
  );

  const clientApi = api(clientLogin.cookie);
  check("وشركته فاضية تمامًا", (await clientApi("GET", "/products")).data?.length === 0);
  check("ولا يرى بيانات ألفا", !(await clientApi("GET", "/customers")).data?.some?.((c) => c.name?.includes("ألفا")));

  section("١٩) حماية التسجيل");

  const duplicate = await call("POST", "/auth/signup", {
    name: "مكرر",
    email: "emp@alfa.test",
    joinCode: alpha.joinCode,
  });
  // الرد 202 عمدًا: رسالة "هذا البريد مسجَّل" تحوّل الشاشة إلى أداة لمعرفة
  // من له حساب في النظام.
  check("بريد مسجَّل لا يفضح نفسه", duplicate.status === 202, `${duplicate.status}`);
  check(
    "ولا صف مكرر في القاعدة",
    (await a("GET", "/users")).data.filter((u) => u.email === "emp@alfa.test").length === 1,
  );

  const noCompany = await call("POST", "/auth/signup", { name: "بلا", email: "none@x.test" });
  check("بلا كود وبلا اسم شركة يُرفض", noCompany.status === 400 && noCompany.data?.code === "COMPANY_REQUIRED");
  check(
    "كلمة مرور قصيرة تُرفض",
    (await call("POST", "/auth/activate", { email: "x@y.z", code: "ABCDEF", password: "123" })).status === 400,
  );
}
