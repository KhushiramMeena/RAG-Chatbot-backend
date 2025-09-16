const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { router: chatRoutes, setIo: setChatIo } = require("./routes/chat");
const sessionRoutes = require("./routes/session");
const { initializeRedis } = require("./services/redis");
const { initializeQdrant } = require("./services/qdrant");
const { initializeDatabase } = require("./services/database");
const { initializeNewsIngestion } = require("./services/newsIngestion");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Set io reference for chat routes
setChatIo(io);

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Logging
app.use(morgan("combined"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api/chat", chatRoutes);
app.use("/api/session", sessionRoutes);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_session", (sessionId) => {
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session: ${sessionId}`);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Initialize services and start server
async function startServer() {
  try {
    console.log("Initializing services...");

    // Initialize Redis
    await initializeRedis();
    console.log("✓ Redis connected");

    // Initialize Qdrant
    await initializeQdrant();
    console.log("✓ Qdrant connected");

    // Initialize Database (optional)
    await initializeDatabase();
    console.log("✓ Database connected");

    // Initialize news ingestion (run in background, don't block server startup)
    initializeNewsIngestion()
      .then(() => {
        console.log("✓ News ingestion completed");
      })
      .catch((error) => {
        console.error("News ingestion failed:", error);
      });

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

// Export io for use in other modules
module.exports = { io };

// Start the server
startServer();
