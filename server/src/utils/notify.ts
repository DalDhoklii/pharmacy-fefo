import prisma from "../lib/prisma";

export async function checkAndNotifyReorder(medicineId: number) {
  const medicine = await prisma.medicine.findUnique({
    where: { id: medicineId },
    include: { batches: true },
  });

  if (!medicine) return;

  const now = new Date();
  const inDateStock = medicine.batches
    .filter((b) => new Date(b.expiryDate) > now && b.status !== "QUARANTINED")
    .reduce((sum, b) => sum + b.quantity, 0);

  if (inDateStock < medicine.reorderThreshold) {
    // Avoid spamming: only notify if no notification was sent in the last hour for this medicine
    const recentNotification = await prisma.notification.findFirst({
      where: {
        medicineId,
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!recentNotification) {
      await prisma.notification.create({
        data: {
          medicineId,
          message: `Reorder alert: ${medicine.name} in-date stock (${inDateStock}) is below threshold (${medicine.reorderThreshold})`,
          currentStock: inDateStock,
        },
      });
    }
  }
}