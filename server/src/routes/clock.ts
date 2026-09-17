import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// POST /clock - simulates the daily batch-status job
router.post("/", async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    // 1. Quarantine batches that are expired but not yet marked QUARANTINED
    const toQuarantine = await prisma.batch.findMany({
      where: {
        expiryDate: { lte: now },
        status: { not: "QUARANTINED" },
      },
    });

    await prisma.batch.updateMany({
      where: { id: { in: toQuarantine.map((b) => b.id) } },
      data: { status: "QUARANTINED" },
    });

    // 2. Flag batches expiring within 7 days (not expired, not already flagged)
    const toFlag = await prisma.batch.findMany({
      where: {
        expiryDate: { gt: now, lte: sevenDaysFromNow },
        status: "ACTIVE",
        quantity: { gt: 0 },
      },
    });

    await prisma.batch.updateMany({
      where: { id: { in: toFlag.map((b) => b.id) } },
      data: { status: "NEAR_EXPIRY" },
    });

    // 3. Reset any NEAR_EXPIRY batch back to ACTIVE if it no longer qualifies
    //    (e.g. restocked with a later date, or a data correction) — keeps job idempotent/consistent
    const toUnflag = await prisma.batch.findMany({
      where: {
        status: "NEAR_EXPIRY",
        expiryDate: { gt: sevenDaysFromNow },
      },
    });

    await prisma.batch.updateMany({
      where: { id: { in: toUnflag.map((b) => b.id) } },
      data: { status: "ACTIVE" },
    });

    res.json({
      ranAt: now.toISOString(),
      quarantined: toQuarantine.length,
      flaggedNearExpiry: toFlag.length,
      unflagged: toUnflag.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Clock job failed" });
  }
});

export default router;