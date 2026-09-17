import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /outbox - lists all notifications sent by the mock Notification Service
router.get("/", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      include: { medicine: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      count: notifications.length,
      notifications: notifications.map((n) => ({
        id: n.id,
        medicineId: n.medicineId,
        medicineName: n.medicine.name,
        message: n.message,
        currentStock: n.currentStock,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch outbox" });
  }
});

export default router;