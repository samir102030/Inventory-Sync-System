import { Router } from "express";
import { db, invoiceSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * إعدادات الفاتورة صفٌّ لكل شركة: اسمها ولوجوها ورقمها الضريبي على فواتيرها
 * هي. RLS يحصر القراءة في شركة الطلب، والصف الجديد يأخذ شركتها تلقائيًا.
 *
 * مالك النظام قبل اختيار شركة لا شركة له، فلا يُنشأ له صف — كان سيولد صفًّا
 * بلا شركة لا يراه أحد بعدها.
 */
async function getOrCreateSettings(req: any) {
  const rows = await db.select().from(invoiceSettingsTable).limit(1);
  if (rows[0]) return rows[0];

  const hasCompany =
    (req.session as any)?.role === "owner"
      ? Boolean((req.session as any)?.activeCompanyId)
      : Boolean((req.session as any)?.companyId);

  if (!hasCompany) return null;

  const [created] = await db.insert(invoiceSettingsTable).values({}).returning();
  return created;
}

/** القيم الافتراضية حين لا توجد شركة فعّالة — لتعرض الواجهة شيئًا بدل الانهيار. */
const EMPTY_SETTINGS = {
  id: 0,
  companyName: "",
  companyAddress: null,
  companyPhone: null,
  companyEmail: null,
  companyLogo: null,
  invoicePrefix: "INV",
  showTax: false,
  taxRate: 14,
  footerNote: null,
  primaryColor: "#1e40af",
  companyId: null,
};

router.get("/settings/invoice", async (req, res) => {
  const settings = await getOrCreateSettings(req);
  if (!settings) return res.json(EMPTY_SETTINGS);
  return res.json({ ...settings, taxRate: Number(settings.taxRate) });
});

router.patch("/settings/invoice", async (req, res) => {
  const settings = await getOrCreateSettings(req);
  if (!settings) {
    return res.status(409).json({
      error: "اختر شركة أولًا من الزر أسفل القائمة الجانبية، ثم أعد المحاولة.",
      code: "COMPANY_NOT_SELECTED",
    });
  }
  const { companyName, companyAddress, companyPhone, companyEmail, companyLogo, invoicePrefix, showTax, taxRate, footerNote, primaryColor } = req.body;
  const updates: Record<string, any> = {};
  if (companyName !== undefined) updates.companyName = companyName;
  if (companyAddress !== undefined) updates.companyAddress = companyAddress;
  if (companyPhone !== undefined) updates.companyPhone = companyPhone;
  if (companyEmail !== undefined) updates.companyEmail = companyEmail;
  if (companyLogo !== undefined) updates.companyLogo = companyLogo;
  if (invoicePrefix !== undefined) updates.invoicePrefix = invoicePrefix;
  if (showTax !== undefined) updates.showTax = showTax;
  if (taxRate !== undefined) updates.taxRate = String(taxRate);
  if (footerNote !== undefined) updates.footerNote = footerNote;
  if (primaryColor !== undefined) updates.primaryColor = primaryColor;
  const [updated] = await db.update(invoiceSettingsTable).set(updates).where(eq(invoiceSettingsTable.id, settings.id)).returning();
  return res.json({ ...updated, taxRate: Number(updated.taxRate) });
});

export default router;
