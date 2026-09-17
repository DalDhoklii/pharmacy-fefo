import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

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