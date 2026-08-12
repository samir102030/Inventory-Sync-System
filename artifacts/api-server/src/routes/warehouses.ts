import { Router } from "express";
import { db, warehousesTable, warehouseStockTable, warehouseTransfersTable, warehouseTransferItemsTable, productsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { nextDocumentNumber } from "../lib/document-number";

const router = Router();

// ── Warehouses CRUD ──────────────────────────────────────────────────────────

router.get("/warehouses", async (_req, res) => {
  const rows = await db.select().from(warehousesTable).orderBy(warehousesTable.id);
  return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/warehouses", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [row] = await db.insert(warehousesTable).values({ name, description: description || null, isMain: false }).returning();
  return res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.put("/warehouses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body;
  const [row] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.isMain) return res.status(400).json({ error: "Cannot edit the main warehouse" });
  const [updated] = await db.update(warehousesTable).set({ name, description: description || null }).where(eq(warehousesTable.id, id)).returning();
  return res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/warehouses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.isMain) return res.status(400).json({ error: "Cannot delete the main warehouse" });
  await db.delete(warehouseStockTable).where(eq(warehouseStockTable.warehouseId, id));
  await db.delete(warehousesTable).where(eq(warehousesTable.id, id));
  return res.json({ ok: true });
});

// ── Warehouse Stock ──────────────────────────────────────────────────────────

router.get("/warehouses/:id/stock", async (req, res) => {
  const warehouseId = Number(req.params.id);
  const [wh] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, warehouseId)).limit(1);
  if (!wh) return res.status(404).json({ error: "Not found" });

  if (wh.isMain) {
    // Main warehouse: read from products.stock
    const products = await db
      .select({ id: productsTable.id, name: productsTable.name, barcode: productsTable.barcode, quantity: productsTable.stock })
      .from(productsTable)
      .orderBy(productsTable.name);
    return res.json(products);
  }

  // Non-main: join warehouse_stock with products
  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      barcode: productsTable.barcode,
      quantity: warehouseStockTable.quantity,
    })
    .from(warehouseStockTable)
    .innerJoin(productsTable, eq(warehouseStockTable.productId, productsTable.id))
    .where(eq(warehouseStockTable.warehouseId, warehouseId))
    .orderBy(productsTable.name);
  return res.json(rows);
});

// ── Transfers ────────────────────────────────────────────────────────────────

router.get("/warehouse-transfers", async (_req, res) => {
  const transfers = await db
    .select({
      id: warehouseTransfersTable.id,
      transferNumber: warehouseTransfersTable.transferNumber,
      fromWarehouseId: warehouseTransfersTable.fromWarehouseId,
      toWarehouseId: warehouseTransfersTable.toWarehouseId,
      notes: warehouseTransfersTable.notes,
      createdAt: warehouseTransfersTable.createdAt,
    })
    .from(warehouseTransfersTable)
    .orderBy(sql`${warehouseTransfersTable.createdAt} DESC`);

  const warehouses = await db.select().from(warehousesTable);
  const whMap = Object.fromEntries(warehouses.map(w => [w.id, w.name]));

  return res.json(transfers.map(t => ({
    ...t,
    fromWarehouseName: t.fromWarehouseId ? whMap[t.fromWarehouseId] ?? null : null,
    toWarehouseName: t.toWarehouseId ? whMap[t.toWarehouseId] ?? null : null,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.get("/warehouse-transfers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [t] = await db.select().from(warehouseTransfersTable).where(eq(warehouseTransfersTable.id, id)).limit(1);
  if (!t) return res.status(404).json({ error: "Not found" });
  const items = await db
    .select({ id: warehouseTransferItemsTable.id, productId: warehouseTransferItemsTable.productId, quantity: warehouseTransferItemsTable.quantity, productName: productsTable.name })
    .from(warehouseTransferItemsTable)
    .innerJoin(productsTable, eq(warehouseTransferItemsTable.productId, productsTable.id))
    .where(eq(warehouseTransferItemsTable.transferId, id));
  return res.json({ ...t, createdAt: t.createdAt.toISOString(), items });
});

router.post("/warehouse-transfers", async (req, res) => {
  const { fromWarehouseId, toWarehouseId, notes, items } = req.body as {
    fromWarehouseId: number;
    toWarehouseId: number;
    notes?: string;
    items: Array<{ productId: number; quantity: number }>;
  };

  if (!fromWarehouseId || !toWarehouseId || !items?.length) {
    return res.status(400).json({ error: "fromWarehouseId, toWarehouseId and items required" });
  }
  if (fromWarehouseId === toWarehouseId) {
    return res.status(400).json({ error: "Source and destination cannot be the same" });
  }

  const [fromWh] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, fromWarehouseId)).limit(1);
  const [toWh] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, toWarehouseId)).limit(1);
  if (!fromWh || !toWh) return res.status(404).json({ error: "Warehouse not found" });

  // Validate stock availability
  for (const item of items) {
    if (fromWh.isMain) {
      const [prod] = await db.select({ stock: productsTable.stock }).from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      if (!prod || prod.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for product ${item.productId} in main warehouse` });
      }
    } else {
      const [ws] = await db.select().from(warehouseStockTable).where(and(eq(warehouseStockTable.warehouseId, fromWarehouseId), eq(warehouseStockTable.productId, item.productId))).limit(1);
      if (!ws || ws.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for product ${item.productId} in warehouse ${fromWh.name}` });
      }
    }
  }

  const transferNumber = await nextDocumentNumber("warehouse_transfers", "transfer_number", "TRF", 4);

  const [transfer] = await db.insert(warehouseTransfersTable).values({
    transferNumber,
    fromWarehouseId,
    toWarehouseId,
    notes: notes || null,
  }).returning();

  // Insert items and update stock
  for (const item of items) {
    await db.insert(warehouseTransferItemsTable).values({
      transferId: transfer.id,
      productId: item.productId,
      quantity: item.quantity,
    });

    // Deduct from source
    if (fromWh.isMain) {
      await db.update(productsTable).set({ stock: sql`${productsTable.stock} - ${item.quantity}` }).where(eq(productsTable.id, item.productId));
    } else {
      await db.update(warehouseStockTable).set({ quantity: sql`${warehouseStockTable.quantity} - ${item.quantity}` }).where(and(eq(warehouseStockTable.warehouseId, fromWarehouseId), eq(warehouseStockTable.productId, item.productId)));
    }

    // Add to destination
    if (toWh.isMain) {
      await db.update(productsTable).set({ stock: sql`${productsTable.stock} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
    } else {
      const [existing] = await db.select().from(warehouseStockTable).where(and(eq(warehouseStockTable.warehouseId, toWarehouseId), eq(warehouseStockTable.productId, item.productId))).limit(1);
      if (existing) {
        await db.update(warehouseStockTable).set({ quantity: sql`${warehouseStockTable.quantity} + ${item.quantity}` }).where(and(eq(warehouseStockTable.warehouseId, toWarehouseId), eq(warehouseStockTable.productId, item.productId)));
      } else {
        await db.insert(warehouseStockTable).values({ warehouseId: toWarehouseId, productId: item.productId, quantity: item.quantity });
      }
    }
  }

  return res.json({ ...transfer, createdAt: transfer.createdAt.toISOString() });
});

export default router;
