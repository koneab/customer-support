import express from "express";
import triageRoutes from "./routes/triageRoutes.js";
import { errorHandler } from "./errors/errorHandler.js";

const app = express();

app.use(express.json());
app.use("/", triageRoutes);

// 404 handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Error handler middleware
app.use(errorHandler);

export default app;
