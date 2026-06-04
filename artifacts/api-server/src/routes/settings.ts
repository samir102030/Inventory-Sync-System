import { Router } from "express";
import { db, invoiceSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(invoiceSettingsTable).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db.insert(invoiceSettingsTable).values({}).returning();
  return created;
}

router.get("/settings/invoice", async (_req, res) => {
  const settings = await getOrCreateSettings();
  return res.json({ ...settings, taxRate: Number(settings.taxRate) });
});

router.patch("/settings/invoice", async (req, res) => {
  const settings = await getOrCreateSettings();
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
