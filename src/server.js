
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables BEFORE importing routes.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const recurringBillRoutes = require("./routes/recurringBillRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

const defaultClientOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8083",
  "http://127.0.0.1:8083",
];

const configuredClientOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...defaultClientOrigins,
  ...configuredClientOrigins,
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked request from ${origin}`));
    },
  }),
);

app.use(express.json({ limit: "1mb" }));

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Persona AI backend is running.",
    status: "healthy",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Persona AI API",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Existing API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/recurring-bills", recurringBillRoutes);

// Finance chatbot route
app.use("/api/chat", chatRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected server error occurred."
        : err.message,
  });
});

// Start server after connecting to MongoDB
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, HOST, () => {
      console.log(
        `Persona AI backend running on http://localhost:${PORT}`,
      );
      console.log(`Listening on ${HOST}:${PORT}`);
      console.log(
        `Health check: http://localhost:${PORT}/api/health`,
      );
      console.log(
        `Register: POST http://localhost:${PORT}/api/auth/register`,
      );
      console.log(
        `Login: POST http://localhost:${PORT}/api/auth/login`,
      );
      console.log(
        `Finance chat: POST http://localhost:${PORT}/api/chat`,
      );
    });
  } catch (error) {
    console.error(
      "Failed to start Persona AI backend:",
      error.message,
    );
    process.exit(1);
  }
}

startServer();
