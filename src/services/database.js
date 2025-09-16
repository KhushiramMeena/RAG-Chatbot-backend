const { Pool } = require("pg");

let dbConnection = null;

const initializeDatabase = async () => {
  try {
    // Check if database configuration is provided
    if (!process.env.DATABASE_URL) {
      console.log(
        "Database configuration not provided, skipping database initialization"
      );
      return null;
    }

    dbConnection = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });

    console.log("Connected to PostgreSQL database");

    // Create tables if they don't exist
    await createTables();

    return dbConnection;
  } catch (error) {
    console.error("Failed to connect to database:", error);
    return null;
  }
};

const createTables = async () => {
  if (!dbConnection) return;

  try {
    // Create sessions table
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('user', 'assistant')) NOT NULL,
        content TEXT NOT NULL,
        sources JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Create articles table (for persistence)
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        url VARCHAR(1000) NOT NULL,
        source VARCHAR(255) NOT NULL,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await dbConnection.query(
      `CREATE INDEX IF NOT EXISTS idx_title ON articles (title)`
    );
    await dbConnection.query(
      `CREATE INDEX IF NOT EXISTS idx_source ON articles (source)`
    );
    await dbConnection.query(
      `CREATE INDEX IF NOT EXISTS idx_published_at ON articles (published_at)`
    );

    console.log("Database tables created/verified");
  } catch (error) {
    console.error("Error creating tables:", error);
  }
};

const getDatabaseConnection = () => {
  return dbConnection;
};

// Save session to database
const saveSession = async (sessionId, sessionData) => {
  if (!dbConnection) return;

  try {
    await dbConnection.query(
      "INSERT INTO sessions (id, message_count, last_activity) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET message_count = $2, last_activity = NOW()",
      [sessionId, sessionData.messages.length]
    );
  } catch (error) {
    console.error("Error saving session:", error);
  }
};

// Save message to database
const saveMessage = async (
  messageId,
  sessionId,
  role,
  content,
  sources = null
) => {
  if (!dbConnection) return;

  try {
    await dbConnection.execute(
      "INSERT INTO messages (id, session_id, role, content, sources) VALUES (?, ?, ?, ?, ?)",
      [
        messageId,
        sessionId,
        role,
        content,
        sources ? JSON.stringify(sources) : null,
      ]
    );
  } catch (error) {
    console.error("Error saving message:", error);
  }
};

// Get session messages from database
const getSessionMessages = async (sessionId) => {
  if (!dbConnection) return [];

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
      [sessionId]
    );

    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      sources: row.sources ? JSON.parse(row.sources) : null,
      timestamp: row.created_at,
    }));
  } catch (error) {
    console.error("Error getting session messages:", error);
    return [];
  }
};

// Save article to database
const saveArticle = async (article) => {
  if (!dbConnection) return;

  try {
    await dbConnection.execute(
      "INSERT INTO articles (id, title, content, url, source, published_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)",
      [
        article.id,
        article.title,
        article.content,
        article.url,
        article.source,
        article.publishedAt,
      ]
    );
  } catch (error) {
    console.error("Error saving article:", error);
  }
};

// Get articles from database
const getArticles = async (limit = 100) => {
  if (!dbConnection) return [];

  try {
    const [rows] = await dbConnection.execute(
      "SELECT * FROM articles ORDER BY published_at DESC LIMIT ?",
      [limit]
    );

    return rows;
  } catch (error) {
    console.error("Error getting articles:", error);
    return [];
  }
};

// Get session statistics
const getSessionStats = async () => {
  if (!dbConnection) return null;

  try {
    const [sessionsResult] = await dbConnection.execute(
      "SELECT COUNT(*) as total_sessions FROM sessions"
    );
    const [messagesResult] = await dbConnection.execute(
      "SELECT COUNT(*) as total_messages FROM messages"
    );
    const [articlesResult] = await dbConnection.execute(
      "SELECT COUNT(*) as total_articles FROM articles"
    );

    return {
      totalSessions: sessionsResult[0].total_sessions,
      totalMessages: messagesResult[0].total_messages,
      totalArticles: articlesResult[0].total_articles,
    };
  } catch (error) {
    console.error("Error getting session stats:", error);
    return null;
  }
};

// Clean up old sessions and messages
const cleanupOldData = async (daysOld = 30) => {
  if (!dbConnection) return;

  try {
    await dbConnection.execute(
      "DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
      [daysOld]
    );

    await dbConnection.execute(
      "DELETE FROM sessions WHERE last_activity < DATE_SUB(NOW(), INTERVAL ? DAY)",
      [daysOld]
    );

    console.log(`Cleaned up data older than ${daysOld} days`);
  } catch (error) {
    console.error("Error cleaning up old data:", error);
  }
};

// Clear all data from database
const clearDatabase = async () => {
  try {
    const db = getDatabaseConnection();

    // Clear all tables
    await db.query("DELETE FROM messages");
    await db.query("DELETE FROM sessions");
    await db.query("DELETE FROM articles");

    console.log("Database cleared successfully");
    return { success: true };
  } catch (error) {
    console.error("Error clearing database:", error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getDatabaseConnection,
  saveSession,
  saveMessage,
  getSessionMessages,
  saveArticle,
  getArticles,
  getSessionStats,
  cleanupOldData,
  clearDatabase,
};
