const { createQueryEmbedding } = require("./embeddings");
const { searchSimilar } = require("./qdrant");
const { generateResponse, generateStreamingResponse } = require("./gemini");
const { getCache, setCache } = require("./redis");

// Main RAG pipeline function
const processQuery = async (query, sessionId, sessionHistory = []) => {
  try {
    console.log(`Processing query: "${query}" for session: ${sessionId}`);

    // Check cache first
    const cacheKey = `query:${Buffer.from(query).toString("base64")}`;
    const cachedResult = await getCache(cacheKey);

    if (cachedResult) {
      console.log("Returning cached result");
      return cachedResult;
    }

    // Step 1: Create query embedding
    console.log("Creating query embedding...");
    const queryEmbedding = await createQueryEmbedding(query);

    // Step 2: Search for similar documents
    console.log("Searching for similar documents...");
    const similarDocs = await searchSimilar(queryEmbedding, 5, 0.7);

    if (similarDocs.length === 0) {
      console.log("No similar documents found, generating general AI response");
      // Generate AI response even without relevant articles
      const result = await generateResponse(query, [], sessionHistory);
      
      const finalResult = {
        ...result,
        query: query,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        cached: false,
        sources: result.sources || [],
        note: "No relevant news articles found, but here's an AI-generated response"
      };

      // Cache the result
      await setCache(cacheKey, finalResult, 1800); // 30 minutes
      return finalResult;
    }

    console.log(`Found ${similarDocs.length} similar documents`);

    // Step 3: Generate response using Gemini
    console.log("Generating response with Gemini...");
    const result = await generateResponse(query, similarDocs, sessionHistory);

    // Add metadata
    const finalResult = {
      ...result,
      query: query,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Cache the result
    await setCache(cacheKey, finalResult, 1800); // 30 minutes cache

    console.log("Query processed successfully");
    return finalResult;
  } catch (error) {
    console.error("Error processing query:", error);
    throw error;
  }
};

// Streaming RAG pipeline function
const processQueryStreaming = async (
  query,
  sessionId,
  sessionHistory = [],
  onChunk
) => {
  try {
    console.log(
      `Processing streaming query: "${query}" for session: ${sessionId}`
    );

    // Step 1: Create query embedding
    console.log("Creating query embedding...");
    const queryEmbedding = await createQueryEmbedding(query);

    // Step 2: Search for similar documents
    console.log("Searching for similar documents...");
    const similarDocs = await searchSimilar(queryEmbedding, 5, 0.7);

    if (similarDocs.length === 0) {
      console.log("No similar documents found");
      onChunk(
        "I couldn't find any relevant news articles to answer your question. Please try rephrasing your query or ask about a different topic."
      );
      return {
        response:
          "I couldn't find any relevant news articles to answer your question. Please try rephrasing your query or ask about a different topic.",
        sources: [],
        cached: false,
      };
    }

    console.log(`Found ${similarDocs.length} similar documents`);

    // Step 3: Generate streaming response using Gemini
    console.log("Generating streaming response with Gemini...");
    const result = await generateStreamingResponse(
      query,
      similarDocs,
      sessionHistory,
      onChunk
    );

    // Add metadata
    const finalResult = {
      ...result,
      query: query,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    console.log("Streaming query processed successfully");
    return finalResult;
  } catch (error) {
    console.error("Error processing streaming query:", error);
    throw error;
  }
};

// Get relevant articles for a query (without generating response)
const getRelevantArticles = async (query, limit = 10) => {
  try {
    console.log(`Getting relevant articles for: "${query}"`);

    // Create query embedding
    const queryEmbedding = await createQueryEmbedding(query);

    // Search for similar documents
    const similarDocs = await searchSimilar(queryEmbedding, limit, 0.6);

    return similarDocs.map((doc) => ({
      title: doc.title,
      content: doc.content.substring(0, 500) + "...", // Truncate for preview
      url: doc.url,
      source: doc.source,
      publishedAt: doc.publishedAt,
      score: doc.score,
    }));
  } catch (error) {
    console.error("Error getting relevant articles:", error);
    throw error;
  }
};

// Search articles by keyword
const searchArticles = async (keyword, limit = 20) => {
  try {
    console.log(`Searching articles for keyword: "${keyword}"`);

    // Create embedding for the keyword
    const keywordEmbedding = await createQueryEmbedding(keyword);

    // Search for similar documents
    const similarDocs = await searchSimilar(keywordEmbedding, limit, 0.5);

    return similarDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      url: doc.url,
      source: doc.source,
      publishedAt: doc.publishedAt,
      summary: doc.summary,
      score: doc.score,
    }));
  } catch (error) {
    console.error("Error searching articles:", error);
    throw error;
  }
};

// Get trending topics (most frequently asked about)
const getTrendingTopics = async () => {
  try {
    // This would require tracking query patterns
    // For now, return some sample trending topics
    return [
      "technology",
      "politics",
      "economy",
      "health",
      "environment",
      "sports",
      "entertainment",
      "science",
    ];
  } catch (error) {
    console.error("Error getting trending topics:", error);
    return [];
  }
};

// Validate query
const validateQuery = (query) => {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Query must be a non-empty string" };
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return { valid: false, error: "Query must be at least 3 characters long" };
  }

  if (trimmedQuery.length > 500) {
    return { valid: false, error: "Query must be less than 500 characters" };
  }

  return { valid: true };
};

// Extract keywords from query
const extractKeywords = (query) => {
  // Simple keyword extraction (could be enhanced with NLP)
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  // Remove common stop words
  const stopWords = [
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "what",
    "when",
    "where",
    "why",
    "how",
    "who",
  ];

  return words.filter((word) => !stopWords.includes(word));
};

module.exports = {
  processQuery,
  processQueryStreaming,
  getRelevantArticles,
  searchArticles,
  getTrendingTopics,
  validateQuery,
  extractKeywords,
};
