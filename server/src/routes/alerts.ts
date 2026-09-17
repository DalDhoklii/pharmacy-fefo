import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/alerts/expiring-soon
router.get("/expiring-soon", authenticate, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const expiringBatches = await prisma.batch.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { gt: now, lte: thirtyDaysFromNow },
      },
      include: { medicine: true },
      orderBy: { expiryDate: "asc" },
    });

    const alerts = expiringBatches.map((b) => ({
      batchId: b.id,
      batchNo: b.batchNo,
      medicineName: b.medicine.name,
      quantity: b.quantity,
      expiryDate: b.expiryDate,
      daysUntilExpiry: Math.ceil(
        (new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    res.json({ count: alerts.length, alerts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expiry alerts" });
  }
});

export default router;