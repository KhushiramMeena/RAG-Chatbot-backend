const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  createSession,
  getSession,
  getAllSessions,
  clearSession,
  updateSession,
} = require("../services/redis");
const { getSessionStats, cleanupOldData } = require("../services/database");

const router = express.Router();

// Create a new session
router.post("/", async (req, res) => {
  try {
    const sessionId = uuidv4();
    const sessionData = await createSession(sessionId, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip || req.connection.remoteAddress,
    });

    res.status(201).json({
      success: true,
      session: {
        id: sessionId,
        createdAt: sessionData.createdAt,
        messageCount: 0,
      },
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create session",
    });
  }
});

// Get session by ID
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages ? session.messages.length : 0,
        lastActivity: session.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get session",
    });
  }
});

// Get all sessions (admin endpoint)
router.get("/", async (req, res) => {
  try {
    const sessions = await getAllSessions();

    const sessionSummaries = sessions
      .map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages ? session.messages.length : 0,
      }))
      .filter((session) => session.messageCount > 0); // Only return sessions with messages

    res.json({
      success: true,
      sessions: sessionSummaries,
      total: sessionSummaries.length,
    });
  } catch (error) {
    console.error("Error getting all sessions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sessions",
    });
  }
});

// Update session
router.put("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const updatedSession = await updateSession(sessionId, updates);

    res.json({
      success: true,
      session: {
        id: updatedSession.id,
        createdAt: updatedSession.createdAt,
        updatedAt: updatedSession.updatedAt,
        messageCount: updatedSession.messages
          ? updatedSession.messages.length
          : 0,
      },
    });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update session",
    });
  }
});

// Delete session
router.delete("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await clearSession(sessionId);

    res.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete session",
    });
  }
});

// Get session statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const stats = await getSessionStats();

    res.json({
      success: true,
      stats: stats || {
        totalSessions: 0,
        totalMessages: 0,
        totalArticles: 0,
      },
    });
  } catch (error) {
    console.error("Error getting session stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get session statistics",
    });
  }
});

// Cleanup old sessions (admin endpoint)
router.post("/cleanup", async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;

    await cleanupOldData(daysOld);

    res.json({
      success: true,
      message: `Cleaned up sessions older than ${daysOld} days`,
    });
  } catch (error) {
    console.error("Error cleaning up sessions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup sessions",
    });
  }
});

// Session health check
router.get("/health/check", (req, res) => {
  res.json({
    success: true,
    service: "session",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
});

module.exports = router;
