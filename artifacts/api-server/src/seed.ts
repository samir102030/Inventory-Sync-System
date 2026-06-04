import { db, usersTable, categoriesTable, productsTable, customersTable, invoiceSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const adminHash = await bcrypt.hash("admin123", 10);
  const cashierHash = await bcrypt.hash("cashier123", 10);

  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
  if (!existingAdmin.length) {
    await db.insert(usersTable).values([
      { username: "admin", passwordHash: adminHash, name: "مدير النظام", role: "admin" },
      { username: "cashier", passwordHash: cashierHash, name: "أحمد الكاشير", role: "cashier" },
    ]);
    console.log("Users created");
  } else {
    console.log("Users already exist");
  }

  const existingCats = await db.select().from(categoriesTable).limit(1);
  let catIds: number[] = [];
  if (!existingCats.length) {
    const cats = await db.insert(categoriesTable).values([
      { name: "كاميرات مراقبة", description: "Security Cameras", icon: "camera" },
      { name: "أجهزة شبكات", description: "Access Points & Network Solutions", icon: "wifi" },
      { name: "أجهزة كمبيوتر", description: "PCs & Laptops", icon: "monitor" },
      { name: "أنظمة تحكم بالدخول", description: "Access Control Systems", icon: "lock" },
      { name: "إنذار الحريق", description: "Fire Alarm Systems", icon: "alarm" },
    ]).returning();
    catIds = cats.map(c => c.id);
    console.log("Categories created");
  } else {
    const allCats = await db.select().from(categoriesTable);
    catIds = allCats.map(c => c.id);
    console.log("Categories already exist");
  }

  const existingProds = await db.select().from(productsTable).limit(1);
  if (!existingProds.length && catIds.length >= 5) {
    await db.insert(productsTable).values([
      { name: "كاميرا Hikvision 2MP", price: "850.00", costPrice: "600.00", categoryId: catIds[0], stock: 15, minStock: 3, barcode: "HIK001", unit: "قطعة" },
      { name: "كاميرا Dahua 4MP Dome", price: "1200.00", costPrice: "900.00", categoryId: catIds[0], stock: 8, minStock: 3, barcode: "DAH001", unit: "قطعة" },
      { name: "DVR 8 Channel Hikvision", price: "2500.00", costPrice: "1800.00", categoryId: catIds[0], stock: 5, minStock: 2, barcode: "HIK002", unit: "قطعة" },
      { name: "Access Point Ubiquiti UniFi", price: "1800.00", costPrice: "1300.00", categoryId: catIds[1], stock: 10, minStock: 3, barcode: "UBQ001", unit: "قطعة" },
      { name: "Router Mikrotik RB750", price: "950.00", costPrice: "700.00", categoryId: catIds[1], stock: 7, minStock: 2, barcode: "MTK001", unit: "قطعة" },
      { name: "Switch 24-Port TP-Link", price: "1400.00", costPrice: "1000.00", categoryId: catIds[1], stock: 4, minStock: 2, barcode: "TPL001", unit: "قطعة" },
      { name: "لابتوب Dell Inspiron Core i5", price: "18000.00", costPrice: "14000.00", categoryId: catIds[2], stock: 3, minStock: 1, barcode: "DEL001", unit: "قطعة" },
      { name: "Desktop HP Core i7", price: "22000.00", costPrice: "17000.00", categoryId: catIds[2], stock: 2, minStock: 1, barcode: "HP001", unit: "قطعة" },
      { name: "نظام بصمة Suprema", price: "3500.00", costPrice: "2500.00", categoryId: catIds[3], stock: 6, minStock: 2, barcode: "SUP001", unit: "قطعة" },
      { name: "كارت ريدر HID", price: "800.00", costPrice: "550.00", categoryId: catIds[3], stock: 12, minStock: 5, barcode: "HID001", unit: "قطعة" },
      { name: "جرس إنذار Bosch", price: "450.00", costPrice: "300.00", categoryId: catIds[4], stock: 20, minStock: 5, barcode: "BOS001", unit: "قطعة" },
      { name: "لوحة تحكم إنذار 8 زون", price: "2800.00", costPrice: "2000.00", categoryId: catIds[4], stock: 4, minStock: 1, barcode: "FAP001", unit: "قطعة" },
    ]);
    console.log("Products created");
  } else {
    console.log("Products already exist");
  }

  const existingCusts = await db.select().from(customersTable).limit(1);
  if (!existingCusts.length) {
    await db.insert(customersTable).values([
      { name: "شركة المستقبل للتقنية", phone: "0101234567", email: "info@mustaqbal.com", address: "القاهرة - مدينة نصر" },
      { name: "مصطفى أحمد", phone: "0109876543", address: "الجيزة - الدقي" },
      { name: "شركة النور للمقاولات", phone: "0123456789", email: "nour@contracting.eg", address: "الإسكندرية" },
    ]);
    console.log("Customers created");
  } else {
    console.log("Customers already exist");
  }

  const existingSettings = await db.select().from(invoiceSettingsTable).limit(1);
  if (!existingSettings.length) {
    await db.insert(invoiceSettingsTable).values({
      companyName: "شركتي للتقنية والأمن",
      companyPhone: "01000000000",
      invoicePrefix: "INV",
      showTax: false,
      taxRate: "14",
      primaryColor: "#1e40af",
    });
    console.log("Invoice settings created");
  } else {
    console.log("Settings already exist");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
