/**
 * ================================
 *  College Media – Backend Server
 *  Feature-Flag Safe | Prod Ready
 * ================================
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const os = require("os");
const axios = require("axios");

/* ------------------
   🔧 INTERNAL IMPORTS
------------------ */
const { initDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const resumeRoutes = require("./routes/resume");
const uploadRoutes = require("./routes/upload");
const { globalLimiter, authLimiter } = require("./middleware/rateLimiter");
const { slidingWindowLimiter } = require("./middleware/slidingWindowLimiter");
const logger = require("./utils/logger");

/* ------------------
   🌱 ENV SETUP
------------------ */
dotenv.config();

const ENV = process.env.NODE_ENV || "development";
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");

/* =================================================
   🚩 FEATURE FLAGS (CENTRALIZED + SAFE)
================================================= */
/**
 * Rules:
 * - Production → risky features OFF by default
 * - Dev/Staging → controlled ON
 * - Flags are IMMUTABLE at runtime
 */
const FEATURE_FLAGS = Object.freeze({
  ENABLE_EXPERIMENTAL_RESUME: ENV !== "production",
  ENABLE_NEW_MESSAGING_FLOW: ENV !== "production",
  ENABLE_DEBUG_LOGS: ENV !== "production",
  ENABLE_STRICT_RATE_LIMITING: ENV === "production",
  ENABLE_VERBOSE_ERRORS: ENV !== "production",
});

/* ---------- Feature Flag Validation (FAIL FAST) ---------- */
const validateFeatureFlags = () => {
  Object.entries(FEATURE_FLAGS).forEach(([key, value]) => {
    if (typeof value !== "boolean") {
      logger.critical("Invalid feature flag configuration", {
        flag: key,
        value,
      });
      process.exit(1);
    }
  });

  if (
    ENV === "production" &&
    (FEATURE_FLAGS.ENABLE_EXPERIMENTAL_RESUME ||
      FEATURE_FLAGS.ENABLE_NEW_MESSAGING_FLOW)
  ) {
    logger.critical(
      "Unsafe feature flag enabled in production",
      FEATURE_FLAGS
    );
    process.exit(1);
  }

  logger.info("Feature flags initialized", {
    env: ENV,
    flags: FEATURE_FLAGS,
  });
};

validateFeatureFlags();

/* ---------- Expose flags safely ---------- */
app.use((req, res, next) => {
  req.features = FEATURE_FLAGS; // read-only
  next();
});

/* ------------------
   🌍 CORS
------------------ */
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

/* ------------------
   📦 BODY PARSERS
------------------ */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ------------------
   🔁 API VERSIONING
------------------ */
app.use((req, res, next) => {
  req.apiVersion = req.headers["x-api-version"] || "v1";
  res.setHeader("X-API-Version", req.apiVersion);
  next();
});

/* ------------------
   ⏱️ RATE LIMITING
------------------ */
app.use("/api", slidingWindowLimiter);
if (FEATURE_FLAGS.ENABLE_STRICT_RATE_LIMITING) {
  app.use("/api", globalLimiter);
}

/* ------------------
   📁 STATIC FILES
------------------ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1h",
  })
);

/* ------------------
   ❤️ HEALTH CHECK
------------------ */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "College Media API is running!",
    env: ENV,
    features: FEATURE_FLAGS,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
  });
});

/* ------------------
   🚀 START SERVER
------------------ */
let dbConnection = null;

const startServer = async () => {
  try {
    dbConnection = await initDB();
    logger.info("Database initialized successfully");
  } catch (err) {
    logger.critical("Database initialization failed", {
      error: err.message,
    });
    process.exit(1);
  }

  /* ---------- ROUTES (FLAG GUARDED) ---------- */

  app.use("/api/auth", authLimiter, require("./routes/auth"));
  app.use("/api/users", require("./routes/users"));

  if (FEATURE_FLAGS.ENABLE_EXPERIMENTAL_RESUME) {
    app.use("/api/resume", resumeRoutes);
  } else {
    logger.warn("Resume routes disabled by feature flag");
  }

  app.use("/api/upload", uploadRoutes);

  if (FEATURE_FLAGS.ENABLE_NEW_MESSAGING_FLOW) {
    app.use("/api/messages", require("./routes/messages"));
  } else {
    logger.warn("Messaging routes disabled by feature flag");
  }

  app.use("/api/account", require("./routes/account"));
  app.use("/api/notifications", require("./routes/notifications"));

  app.use(notFound);
  app.use(errorHandler);

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

/* ------------------
   🧹 GRACEFUL SHUTDOWN
------------------ */
const shutdown = async (signal) => {
  logger.warn("Shutdown signal received", { signal });

  server.close(async () => {
    if (dbConnection?.mongoose) {
      await dbConnection.mongoose.connection.close(false);
    }
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/* ------------------
   🧨 PROCESS SAFETY
------------------ */
process.on("unhandledRejection", (reason) => {
  logger.critical("Unhandled Promise Rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.critical("Uncaught Exception", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

/* ------------------
   ▶️ BOOTSTRAP
------------------ */
startServer();
