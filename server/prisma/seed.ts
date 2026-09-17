import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const paracetamol = await prisma.medicine.create({
    data: { name: "Paracetamol", category: "Painkiller" },
  });

  const amoxicillin = await prisma.medicine.create({
    data: { name: "Amoxicillin", category: "Antibiotic" },
  });

  const today = new Date();
  const daysFromNow = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  await prisma.batch.createMany({
    data: [
      { medicineId: paracetamol.id, batchNo: "PARA-EXP", quantity: 100, expiryDate: daysFromNow(-10) },
      { medicineId: paracetamol.id, batchNo: "PARA-NEAR", quantity: 50, expiryDate: daysFromNow(15) },
      { medicineId: paracetamol.id, batchNo: "PARA-FAR", quantity: 200, expiryDate: daysFromNow(180) },
      { medicineId: amoxicillin.id, batchNo: "AMOX-EXP1", quantity: 30, expiryDate: daysFromNow(-5) },
      { medicineId: amoxicillin.id, batchNo: "AMOX-EXP2", quantity: 40, expiryDate: daysFromNow(-1) },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });