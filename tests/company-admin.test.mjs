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
}
