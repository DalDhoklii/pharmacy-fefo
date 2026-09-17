import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { checkAndNotifyReorder } from "../utils/notify";

const router = Router();

// POST /api/dispense
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { medicineId, quantity } = req.body;

    if (!medicineId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "medicineId and a positive quantity are required" });
    }

    const now = new Date();

    // Fetch valid (non-expired, in-stock) batches, oldest expiry first
    const validBatches = await prisma.batch.findMany({
      where: {
        medicineId: Number(medicineId),
        quantity: { gt: 0 },
        expiryDate: { gt: now },
        status: { not: "QUARANTINED" },
      },
      orderBy: { expiryDate: "asc" },
    });

    const totalAvailable = validBatches.reduce((sum, b) => sum + b.quantity, 0);

    if (totalAvailable < quantity) {
      return res.status(400).json({
        error: "Insufficient in-date stock",
        requested: quantity,
        available: totalAvailable,
      });
    }

    // Walk through batches oldest-expiry-first, deduct until quantity is fulfilled
    let remaining = quantity;
    const allocation: { batchId: number; batchNo: string; quantityUsed: number; expiryDate: Date }[] = [];

    for (const batch of validBatches) {
      if (remaining <= 0) break;

      const used = Math.min(batch.quantity, remaining);
      allocation.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        quantityUsed: used,
        expiryDate: batch.expiryDate,
      });
      remaining -= used;
    }

    // Perform all deductions + audit log atomically
    const result = await prisma.$transaction(async (tx) => {
      for (const a of allocation) {
        await tx.batch.update({
          where: { id: a.batchId },
          data: { quantity: { decrement: a.quantityUsed } },
        });
      }

      const dispenseLog = await tx.dispenseLog.create({
        data: {
          medicineId: Number(medicineId),
          totalQty: quantity,
          items: {
            create: allocation.map((a) => ({
              batchId: a.batchId,
              quantityUsed: a.quantityUsed,
            })),
          },
        },
        include: { items: true },
      });

      return dispenseLog;
    });

    await checkAndNotifyReorder(Number(medicineId));

    res.status(200).json({
      message: "Dispensed successfully",
      dispenseLogId: result.id,
      allocation,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to dispense medicine" });
  }
});

export default router;