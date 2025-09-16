const redis = require("redis");

let redisClient = null;

const initializeRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === "ECONNREFUSED") {
          return new Error("The server refused the connection");
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error("Retry time exhausted");
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("Connected to Redis");
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error("Redis client not initialized");
  }
  return redisClient;
};

// Session management functions
const createSession = async (sessionId, initialData = {}) => {
  const client = getRedisClient();
  const sessionData = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    messages: [],
    ...initialData,
  };

  await client.setEx(
    `session:${sessionId}`,
    parseInt(process.env.SESSION_TTL) || 3600,
    JSON.stringify(sessionData)
  );

  return sessionData;
};

const getSession = async (sessionId) => {
  const client = getRedisClient();
  const sessionData = await client.get(`session:${sessionId}`);
  return sessionData ? JSON.parse(sessionData) : null;
};

const updateSession = async (sessionId, updates) => {
  const client = getRedisClient();
  const existingSession = await getSession(sessionId);

  if (!existingSession) {
    throw new Error("Session not found");
  }

  const updatedSession = {
    ...existingSession,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await client.setEx(
    `session:${sessionId}`,
    parseInt(process.env.SESSION_TTL) || 3600,
    JSON.stringify(updatedSession)
  );

  return updatedSession;
};

const addMessageToSession = async (sessionId, message) => {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const updatedMessages = [
    ...session.messages,
    {
      ...message,
      timestamp: new Date().toISOString(),
      id: require("uuid").v4(),
    },
  ];

  return await updateSession(sessionId, { messages: updatedMessages });
};

const clearSession = async (sessionId) => {
  const client = getRedisClient();
  await client.del(`session:${sessionId}`);
};

const getAllSessions = async () => {
  const client = getRedisClient();
  const keys = await client.keys("session:*");
  const sessions = [];

  for (const key of keys) {
    const sessionData = await client.get(key);
    if (sessionData) {
      sessions.push(JSON.parse(sessionData));
    }
  }

  return sessions;
};

// Cache functions
const setCache = async (key, value, ttl = null) => {
  const client = getRedisClient();
  const cacheKey = `cache:${key}`;
  const cacheValue = JSON.stringify(value);

  if (ttl) {
    await client.setEx(cacheKey, ttl, cacheValue);
  } else {
    await client.setEx(
      cacheKey,
      parseInt(process.env.CACHE_TTL) || 1800,
      cacheValue
    );
  }
};

const getCache = async (key) => {
  const client = getRedisClient();
  const cacheKey = `cache:${key}`;
  const cachedValue = await client.get(cacheKey);

  return cachedValue ? JSON.parse(cachedValue) : null;
};

const deleteCache = async (key) => {
  const client = getRedisClient();
  const cacheKey = `cache:${key}`;
  await client.del(cacheKey);
};

const clearAllCache = async () => {
  const client = getRedisClient();
  const keys = await client.keys("cache:*");
  if (keys.length > 0) {
    await client.del(keys);
  }
};

module.exports = {
  initializeRedis,
  getRedisClient,
  createSession,
  getSession,
  updateSession,
  addMessageToSession,
  clearSession,
  getAllSessions,
  setCache,
  getCache,
  deleteCache,
  clearAllCache,
};
