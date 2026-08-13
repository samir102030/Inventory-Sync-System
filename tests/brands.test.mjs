// A vendor proposes brands; an admin approves them.
import { api, call, check, login, section } from "./lib.mjs";

export default async function run() {
  const owner = api(await login("owner"));
  const a = api(await login("admin_a"));
  const cashier = api(await login("cash_a"));

  // مورّد في شركة ألفا — الدور الجديد.
  await owner("POST", `/companies/${(await owner("GET", "/companies")).data.find((c) => c.name === "شركة ألفا").id}/switch`);
  const created = await owner("POST", "/users", {
    username: "vendor_a",
    password: "Vendor!2345",
    name: "مورّد ألفا",
    role: "vendor",
  });
  check("إنشاء حساب مورّد", created.status === 201, `${created.status} ${JSON.stringify(created.data)}`);
  await owner("POST", "/companies/switch/clear");

  const vendor = api(await login("vendor_a", "Vendor!2345"));

  section("٣٨) المورّد يضيف براند فينتظر الاعتماد");

  const added = await vendor("POST", "/brands", { name: "Hikvision", description: "كاميرات" });
  check("الإضافة تنجح", added.status === 201, `${added.status} ${JSON.stringify(added.data)}`);
  check("والحالة بانتظار الاعتماد", added.data?.approvalStatus === "pending", added.data?.approvalStatus);
  check("ومسجَّل مين أضافه", added.data?.createdBy === "مورّد ألفا", JSON.stringify(added.data?.createdBy));

  const byAdmin = await a("POST", "/brands", { name: "Dahua" });
  check("وما يضيفه الأدمن معتمد فورًا", byAdmin.data?.approvalStatus === "approved", byAdmin.data?.approvalStatus);

  section("٣٩) ما ينتظر لا يراه باقي الموظفين");

  check(
    "الكاشير يرى المعتمد وحده",
    (await cashier("GET", "/brands")).data?.every((b) => b.approvalStatus === "approved"),
    JSON.stringify((await cashier("GET", "/brands")).data?.map((b) => b.name)),
  );
  check("والمورّد يرى ما أضافه", (await vendor("GET", "/brands")).data?.some((b) => b.name === "Hikvision"));
  check("والأدمن يرى الاتنين", (await a("GET", "/brands")).data?.length === 2);

  section("٤٠) المورّد يعدّل ولا يحذف ولا يعتمد");

  check(
    "التعديل ينجح",
    (await vendor("PATCH", `/brands/${added.data.id}`, { description: "كاميرات وأنظمة" })).status === 200,
  );
  check("الاعتماد ممنوع عليه", (await vendor("POST", `/brands/${added.data.id}/approve`)).status === 403);
  check("والحذف ممنوع", (await vendor("DELETE", `/brands/${byAdmin.data.id}`)).status === 403);
  check("والبراند ما زال موجودًا", (await a("GET", "/brands")).data?.some((b) => b.id === byAdmin.data.id));

  // وإلا لكانت الموافقة بابًا يُفتح مرة ثم يُغيَّر ما خلفه.
  const editApproved = await vendor("PATCH", `/brands/${byAdmin.data.id}`, { name: "Dahua Pro" });
  check("تعديله لبراند معتمد يعيده للانتظار", editApproved.data?.approvalStatus === "pending", editApproved.data?.approvalStatus);

  section("٤١) المورّد لا يرى غير البراندات");

  for (const path of ["/products", "/invoices", "/customers", "/accounts", "/users"]) {
    check(`${path} ممنوع عليه`, (await vendor("GET", path)).status === 403);
  }
  check("والبيع ممنوع", (await vendor("POST", "/invoices", { items: [], paymentMethod: "cash" })).status === 403);

  section("٤٢) الأدمن يعتمد فيراه الجميع");

  const approved = await a("POST", `/brands/${added.data.id}/approve`);
  check("الاعتماد ينجح", approved.status === 200, `${approved.status}`);
  check("ويسجّل من اعتمده", approved.data?.approvedBy === "أدمن ألفا", JSON.stringify(approved.data?.approvedBy));
  check("والكاشير بقى يشوفه", (await cashier("GET", "/brands")).data?.some((b) => b.name === "Hikvision"));

  section("٤٣) البراندات معزولة بين الشركات");

  const b = api(await login("admin_b"));
  check("أدمن بيتا لا يرى براندات ألفا", (await b("GET", "/brands")).data?.length === 0, JSON.stringify((await b("GET", "/brands")).data));
  check(
    "ونفس الاسم متاح عنده",
    (await b("POST", "/brands", { name: "Hikvision" })).status === 201,
  );
  check("والمورّد لا يرى ما أضافته بيتا", !(await vendor("GET", "/brands")).data?.some((br) => br.id > 100));
}
