// A cashier's invoice waits for an admin to review it.
import { api, check, login, section } from "./lib.mjs";

export default async function run() {
  const a = api(await login("admin_a"));
  const cashier = api(await login("cash_a"));

  const product = (await a("GET", "/products")).data[0];
  const account = (await a("GET", "/accounts")).data[0];
  const sale = {
    items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
    paymentMethod: "cash",
    accountId: account.id,
  };

  section("٣٤) فاتورة الكاشير تنتظر الاعتماد");

  const stockBefore = (await a("GET", `/products/${product.id}`)).data.stock;

  const byCashier = await cashier("POST", "/invoices", sale);
  check("الكاشير يقدر يبيع", byCashier.status === 201, `${byCashier.status} ${JSON.stringify(byCashier.data)}`);
  check("والفاتورة تولد بانتظار الاعتماد", byCashier.data?.approvalStatus === "pending", JSON.stringify(byCashier.data?.approvalStatus));

  // الزبون أخذ البضاعة ودفع؛ تأجيل ذلك يجعل المخزون كاذبًا حتى يمر الأدمن.
  const stockAfter = (await a("GET", `/products/${product.id}`)).data.stock;
  check("والمخزون نقص فورًا", stockAfter === stockBefore - 1, `${stockBefore} ⇒ ${stockAfter}`);

  const byAdmin = await a("POST", "/invoices", sale);
  check("وفاتورة الأدمن معتمدة من نفسها", byAdmin.data?.approvalStatus === "approved", JSON.stringify(byAdmin.data?.approvalStatus));

  section("٣٥) الكاشير لا يعتمد فاتورة");

  // ‏POST /invoices مسموح له، و/invoices/:id/approve يقع تحته بالبادئة —
  // فلولا فحصٌ بالنمط لاعتمد فواتير نفسه ولأصبحت المراجعة اسمًا بلا معنى.
  const selfApprove = await cashier("POST", `/invoices/${byCashier.data.id}/approve`);
  check("محاولته تُرفض بـ 403", selfApprove.status === 403, `${selfApprove.status}`);
  check(
    "والفاتورة ما زالت منتظرة",
    (await a("GET", `/invoices/${byCashier.data.id}`)).data?.approvalStatus === "pending",
  );

  section("٣٦) الأدمن يراجع ويعتمد");

  const queue = await a("GET", "/invoices?approval=pending");
  check("الفاتورة في قائمة المراجعة", queue.data?.some((i) => i.id === byCashier.data.id), `${queue.data?.length}`);
  check("وفاتورة الأدمن ليست فيها", !queue.data?.some((i) => i.id === byAdmin.data.id));

  // الأدمن يصحّح قبل الاعتماد — وهذا سبب وجود المراجعة أصلًا.
  const corrected = await a("PATCH", `/invoices/${byCashier.data.id}`, { notes: "صُحِّحت بالمراجعة" });
  check("الأدمن يقدر يعدّلها", corrected.status === 200, `${corrected.status}`);

  const approved = await a("POST", `/invoices/${byCashier.data.id}/approve`);
  check("والاعتماد ينجح", approved.status === 200, `${approved.status} ${JSON.stringify(approved.data)}`);
  check("ويسجّل من اعتمدها", approved.data?.approvedBy === "أدمن ألفا", JSON.stringify(approved.data?.approvedBy));
  check("ووقتها", Boolean(approved.data?.approvedAt));
  check("والقائمة فضيت", (await a("GET", "/invoices?approval=pending")).data?.length === 0);

  section("٣٧) المراجعة محصورة داخل الشركة");

  const b = api(await login("admin_b"));
  const betaProduct = (await b("GET", "/products")).data[0];
  const betaAccount = (await b("GET", "/accounts")).data[0];
  await b("POST", "/invoices", {
    items: [{ productId: betaProduct.id, quantity: 1, unitPrice: 50 }],
    paymentMethod: "cash",
    accountId: betaAccount.id,
  });

  const cashierBeta = await b("GET", "/invoices?approval=pending");
  check("أدمن بيتا لا يرى شيئًا من ألفا", !cashierBeta.data?.some((i) => i.createdBy === "كاشير ألفا"), JSON.stringify(cashierBeta.data?.map((i) => i.createdBy)));
}
