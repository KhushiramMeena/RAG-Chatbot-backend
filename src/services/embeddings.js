const axios = require("axios");

let jinaClient = null;

const initializeJina = () => {
  const apiKey = process.env.JINA_API_KEY;

  if (!apiKey || apiKey === "your_jina_api_key_here") {
    console.warn(
      "⚠️  JINA_API_KEY not set or invalid - using fallback embeddings"
    );
    return null; // Return null to indicate fallback mode
  }

  jinaClient = axios.create({
    baseURL: "https://api.jina.ai/v1",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  return jinaClient;
};

const getJinaClient = () => {
  if (!jinaClient) {
    jinaClient = initializeJina();
  }
  return jinaClient;
};

// Simple fallback embedding function (mock embeddings for demo)
const createFallbackEmbedding = (text) => {
  // Create a simple hash-based embedding for demo purposes
  const hash = text.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Generate a 768-dimensional vector based on the hash
  const embedding = [];
  for (let i = 0; i < 768; i++) {
    embedding.push(Math.sin(hash + i) * 0.1);
  }

  return embedding;
};

// Create embeddings for text
const createEmbedding = async (text) => {
  const client = getJinaClient();

  // Use fallback if Jina client is not available
  if (!client) {
    console.log("Using fallback embedding for:", text.substring(0, 50) + "...");
    return createFallbackEmbedding(text);
  }

  try {
    const response = await client.post("/embeddings", {
      input: text,
      model: "jina-embeddings-v2-base-en",
    });

    return response.data.data[0].embedding;
  } catch (error) {
    console.error(
      "Error creating embedding with Jina, using fallback:",
      error.message
    );
    return createFallbackEmbedding(text);
  }
};

// Create embeddings for multiple texts
const createEmbeddings = async (texts) => {
  const client = getJinaClient();

  // Use fallback if Jina client is not available
  if (!client) {
    console.log("Using fallback embeddings for", texts.length, "texts");
    return texts.map((text) => createFallbackEmbedding(text));
  }

  try {
    const response = await client.post("/embeddings", {
      input: texts,
      model: "jina-embeddings-v2-base-en",
    });

    return response.data.data.map((item) => item.embedding);
  } catch (error) {
    console.error(
      "Error creating embeddings with Jina, using fallback:",
      error.message
    );
    return texts.map((text) => createFallbackEmbedding(text));
  }
};

// Create embedding for a news article
const createArticleEmbedding = async (article) => {
  try {
    // Combine title and content for better context
    const textToEmbed = `${article.title}\n\n${article.content}`;

    // Truncate if too long (Jina has limits)
    const maxLength = 8000; // Conservative limit
    const truncatedText =
      textToEmbed.length > maxLength
        ? textToEmbed.substring(0, maxLength) + "..."
        : textToEmbed;

    const embedding = await createEmbedding(truncatedText);

    return {
      ...article,
      embedding: embedding,
      textForEmbedding: truncatedText,
    };
  } catch (error) {
    console.error("Error creating article embedding:", error);
    throw error;
  }
};

// Create embeddings for multiple articles
const createArticleEmbeddings = async (articles) => {
  try {
    const embeddings = [];

    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const batchPromises = batch.map((article) =>
        createArticleEmbedding(article)
      );
      const batchEmbeddings = await Promise.all(batchPromises);

      embeddings.push(...batchEmbeddings);

      // Small delay between batches
      if (i + batchSize < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return embeddings;
  } catch (error) {
    console.error("Error creating article embeddings:", error);
    throw error;
  }
};

// Create embedding for user query
const createQueryEmbedding = async (query) => {
  try {
    const embedding = await createEmbedding(query);
    return embedding;
  } catch (error) {
    console.error("Error creating query embedding:", error);
    throw error;
  }
};

// Test Jina connection
const testConnection = async () => {
  try {
    const client = getJinaClient();
    const response = await client.post("/embeddings", {
      input: "test",
      model: "jina-embeddings-v2-base-en",
    });

    return response.status === 200;
  } catch (error) {
    console.error("Jina connection test failed:", error);
    return false;
  }
};

module.exports = {
  initializeJina,
  getJinaClient,
  createEmbedding,
  createEmbeddings,
  createArticleEmbedding,
  createArticleEmbeddings,
  createQueryEmbedding,
  testConnection,
};
