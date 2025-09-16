const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  processQuery,
  processQueryStreaming,
  validateQuery,
} = require("../services/ragService");
const {
  createSession,
  getSession,
  addMessageToSession,
  clearSession,
} = require("../services/redis");
const { saveMessage, saveSession } = require("../services/database");

const router = express.Router();

let io = null;

const setIo = (socketIo) => {
  io = socketIo;
};


router.post("/session", async (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = await createSession(sessionId);

    // Save to database if available
    await saveSession(sessionId, session);

    res.json({
      success: true,
      sessionId: sessionId,
      message: "New session created successfully",
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create session",
    });
  }
});

// Send message to chat
router.post("/message", async (req, res) => {
  try {
    const { sessionId, message, streaming = false } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: "Session ID and message are required",
      });
    }

    // Validate query
    const validation = validateQuery(message);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Get or create session
    let session = await getSession(sessionId);
    if (!session) {
      session = await createSession(sessionId);
      await saveSession(sessionId, session);
    }

    // Add user message to session
    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    await addMessageToSession(sessionId, userMessage);
    await saveMessage(userMessage.id, sessionId, "user", message);

    // Process query with RAG
    const sessionHistory = session.messages || [];
    let ragResult;

    if (streaming) {
      // For streaming, we'll handle it differently
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      });

      ragResult = await processQueryStreaming(
        message,
        sessionId,
        sessionHistory,
        (chunk) => {
          res.write(chunk);
        }
      );

      res.end();
    } else {
      ragResult = await processQuery(message, sessionId, sessionHistory);
    }

    // Add assistant response to session
    const assistantMessage = {
      role: "assistant",
      content: ragResult.response,
      sources: ragResult.sources,
      timestamp: new Date().toISOString(),
    };

    await addMessageToSession(sessionId, assistantMessage);
    await saveMessage(
      assistantMessage.id,
      sessionId,
      "assistant",
      ragResult.response,
      ragResult.sources
    );

    // Emit to socket.io for real-time updates
    io.to(sessionId).emit("new_message", {
      role: "assistant",
      content: ragResult.response,
      sources: ragResult.sources,
      timestamp: assistantMessage.timestamp,
    });

    if (!streaming) {
      res.json({
        success: true,
        response: ragResult.response,
        sources: ragResult.sources,
        sessionId: sessionId,
        timestamp: assistantMessage.timestamp,
      });
    }
  } catch (error) {
    console.error("Error processing message:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Failed to process message",
      });
    }
  }
});

// Get chat history for a session
router.get("/history/:sessionId", async (req, res) => {
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
      sessionId: sessionId,
      messages: session.messages || [],
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get chat history",
    });
  }
});

// Clear chat history for a session
router.delete("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await clearSession(sessionId);

    // Emit to socket.io
    io.to(sessionId).emit("session_cleared");

    res.json({
      success: true,
      message: "Chat history cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear chat history",
    });
  }
});

// Get session info
router.get("/session/:sessionId", async (req, res) => {
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
      },
    });
  } catch (error) {
    console.error("Error getting session info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get session info",
    });
  }
});

// Health check for chat service
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "chat",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
});

module.exports = { router, setIo };
