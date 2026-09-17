import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import medicineRoutes from "./routes/medicines";
import dispenseRoutes from "./routes/dispense";
import alertRoutes from "./routes/alerts";
import clockRoutes from "./routes/clock";
import outboxRoutes from "./routes/outbox";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Pharmacy FEFO API running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/dispense", dispenseRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/clock", clockRoutes);
app.use("/outbox", outboxRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});