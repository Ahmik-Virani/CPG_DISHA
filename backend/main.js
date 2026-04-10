import dns from "node:dns";

// Use OS/network DNS settings. Forcing public resolvers can break Atlas SRV lookups on restricted networks.

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import { PORT, JWT_SECRET } from "./config.js";
import { connectMongoWithRetry } from "./db.js";
import { startRecurringTemplatesScheduler } from "./scheduler.js";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import paymentRoutes from "./routes/create-payment-request.js";
import deletePaymentRoutes from "./routes/delete-payment-request.js";
import healthRoutes from "./routes/health.js";
import adminRoutes from "./routes/admin.js";
import userPaymentRoutes from "./routes/user-payments.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/events", paymentRoutes);
app.use("/events", deletePaymentRoutes);
app.use("/admin", adminRoutes);
app.use("/user-payments", userPaymentRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status) || 500;
  if (status === 503) {
    return res.status(503).json({ message: "Database unavailable. Please retry shortly." });
  }
  return res.status(500).json({ message: "Internal server error" });
});

function startServer() {
  app.listen(PORT, () => {
    if (JWT_SECRET === "dev-jwt-secret-change-me") {
      console.warn("Using fallback JWT secret. Set JWT_SECRET in backend/.env");
    }
    console.log("Backend running on http://localhost:" + PORT);
  });

  void connectMongoWithRetry();
  void startRecurringTemplatesScheduler();
}

startServer();
