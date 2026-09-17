import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { parseQuantity, parseFlexibleDate } from "../utils/parseImport";

const router = Router();

// GET /api/medicines - list with search, sort, pagination, and in-date stock calc
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      search = "",
      sortBy = "name",
      order = "asc",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const where = search
      ? {
          OR: [
            { name: { contains: search as string } },
            { category: { contains: search as string } },
          ],
        }
      : {};

    const medicines = await prisma.medicine.findMany({
      where,
      include: { batches: true },
      skip,
      take: limitNum,
    });

    const total = await prisma.medicine.count({ where });

    const now = new Date();

    // Compute in-date stock and expired stock per medicine
    const enriched = medicines.map((med) => {
      const inDateStock = med.batches
        .filter((b) => new Date(b.expiryDate) > now)
        .reduce((sum, b) => sum + b.quantity, 0);

      const expiredStock = med.batches
        .filter((b) => new Date(b.expiryDate) <= now)
        .reduce((sum, b) => sum + b.quantity, 0);

      return {
        id: med.id,
        name: med.name,
        category: med.category,
        inDateStock,
        expiredStock,
        totalBatches: med.batches.length,
      };
    });

    // Sort in-memory (name/category are DB-sortable, but stock is computed)
    enriched.sort((a: any, b: any) => {
      const valA = a[sortBy as string];
      const valB = b[sortBy as string];
      if (typeof valA === "string") {
        return order === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return order === "asc" ? valA - valB : valB - valA;
    });

    res.json({
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch medicines" });
  }
});

// POST /api/medicines/import - bulk import messy batch data
router.post("/import", authenticate, async (req: AuthRequest, res) => {
  try {
    const rows = req.body.batches;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Body must include a 'batches' array" });
    }

    let imported = 0;
    let deduped = 0;
    let rejected = 0;
    const rejectedDetails: { row: any; reason: string }[] = [];

    // Track batchNo+medicineId pairs seen in THIS import, to catch in-payload duplicates
    const seenInPayload = new Set<string>();

    for (const row of rows) {
      const medicineName = typeof row?.medicineName === "string" ? row.medicineName.trim() : null;
      const batchNo = typeof row?.batchNo === "string" ? row.batchNo.trim() : null;
      const quantity = parseQuantity(row?.quantity);
      const expiryDate = parseFlexibleDate(row?.expiryDate);

      if (!medicineName || !batchNo || quantity === null || expiryDate === null) {
        rejected++;
        rejectedDetails.push({
          row,
          reason: "Missing or unparseable required field (medicineName, batchNo, quantity, expiryDate)",
        });
        continue;
      }

      const dedupeKey = `${medicineName.toLowerCase()}::${batchNo.toLowerCase()}`;
      if (seenInPayload.has(dedupeKey)) {
        deduped++;
        continue;
      }
      seenInPayload.add(dedupeKey);

      // Find or create the medicine
      let medicine = await prisma.medicine.findFirst({
        where: { name: { equals: medicineName } },
      });
      if (!medicine) {
        medicine = await prisma.medicine.create({
          data: { name: medicineName },
        });
      }

      // Check if this batch already exists in the DB (cross-import dedupe)
      const existing = await prisma.batch.findFirst({
        where: { medicineId: medicine.id, batchNo },
      });
      if (existing) {
        deduped++;
        continue;
      }

      await prisma.batch.create({
        data: {
          medicineId: medicine.id,
          batchNo,
          quantity,
          expiryDate,
          status: expiryDate <= new Date() ? "QUARANTINED" : "ACTIVE",
        },
      });
      imported++;
    }

    res.json({ imported, deduped, rejected, rejectedDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Import failed" });
  }
});

// GET /api/medicines/:id - single medicine with full batch breakdown
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const medicine = await prisma.medicine.findUnique({
      where: { id: Number(req.params.id) },
      include: { batches: { orderBy: { expiryDate: "asc" } } },
    });

    if (!medicine) {
      return res.status(404).json({ error: "Medicine not found" });
    }

    const now = new Date();
    const batchesWithStatus = medicine.batches.map((b) => ({
      ...b,
      status: new Date(b.expiryDate) <= now ? "expired" : "in-date",
    }));

    res.json({ ...medicine, batches: batchesWithStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch medicine" });
  }
});

export default router;