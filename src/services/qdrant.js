const axios = require("axios");

let qdrantClient = null;
const COLLECTION_NAME = "news_articles";

const initializeQdrant = async () => {
  try {
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    const apiKey = process.env.QDRANT_API_KEY;

    qdrantClient = axios.create({
      baseURL: qdrantUrl,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "api-key": apiKey }),
      },
    });

    // Test connection
    await qdrantClient.get("/collections");
    console.log("Connected to Qdrant");

    // Create collection if it doesn't exist
    await createCollection();

    return qdrantClient;
  } catch (error) {
    console.error("Failed to connect to Qdrant:", error);
    throw error;
  }
};

const createCollection = async () => {
  try {
    // Check if collection exists
    const collections = await qdrantClient.get("/collections");
    const collectionExists = collections.data.result.collections.some(
      (col) => col.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      // Create collection with Jina embeddings dimensions (768)
      await qdrantClient.put(`/collections/${COLLECTION_NAME}`, {
        vectors: {
          size: 768, // Jina embeddings dimension
          distance: "Cosine",
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });
      console.log(`Created collection: ${COLLECTION_NAME}`);
    } else {
      console.log(`Collection ${COLLECTION_NAME} already exists`);
    }
  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
};

const getQdrantClient = () => {
  if (!qdrantClient) {
    throw new Error("Qdrant client not initialized");
  }
  return qdrantClient;
};

// Add document to vector store
const addDocument = async (document) => {
  const client = getQdrantClient();

  try {
    const payload = {
      points: [
        {
          id: document.id,
          vector: document.embedding,
          payload: {
            title: document.title,
            content: document.content,
            url: document.url,
            publishedAt: document.publishedAt,
            source: document.source,
            summary: document.summary || "",
          },
        },
      ],
    };

    await client.put(`/collections/${COLLECTION_NAME}/points`, payload);
    console.log(`Added document: ${document.id}`);
  } catch (error) {
    console.error("Error adding document:", error);
    throw error;
  }
};

// Add multiple documents
const addDocuments = async (documents) => {
  const client = getQdrantClient();

  try {
    const points = documents.map((doc) => ({
      id: doc.id,
      vector: doc.embedding,
      payload: {
        title: doc.title,
        content: doc.content,
        url: doc.url,
        publishedAt: doc.publishedAt,
        source: doc.source,
        summary: doc.summary || "",
      },
    }));

    const payload = { points };

    await client.put(`/collections/${COLLECTION_NAME}/points`, payload);
    console.log(`Added ${documents.length} documents`);
  } catch (error) {
    console.error("Error adding documents:", error);
    throw error;
  }
};

// Search for similar documents
const searchSimilar = async (
  queryEmbedding,
  limit = 5,
  scoreThreshold = 0.7
) => {
  const client = getQdrantClient();

  try {
    const payload = {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true,
      score_threshold: scoreThreshold,
    };

    const response = await client.post(
      `/collections/${COLLECTION_NAME}/points/search`,
      payload
    );

    return response.data.result.map((result) => ({
      id: result.id,
      score: result.score,
      title: result.payload.title,
      content: result.payload.content,
      url: result.payload.url,
      publishedAt: result.payload.publishedAt,
      source: result.payload.source,
      summary: result.payload.summary,
    }));
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
};

// Get collection info
const getCollectionInfo = async () => {
  const client = getQdrantClient();

  try {
    const response = await client.get(`/collections/${COLLECTION_NAME}`);
    return response.data.result;
  } catch (error) {
    console.error("Error getting collection info:", error);
    throw error;
  }
};

// Delete collection
const deleteCollection = async () => {
  const client = getQdrantClient();

  try {
    await client.delete(`/collections/${COLLECTION_NAME}`);
    console.log(`Deleted collection: ${COLLECTION_NAME}`);
  } catch (error) {
    console.error("Error deleting collection:", error);
    throw error;
  }
};

// Get all points in collection
const getAllPoints = async () => {
  const client = getQdrantClient();

  try {
    const response = await client.post(
      `/collections/${COLLECTION_NAME}/points/scroll`,
      {
        limit: 10000,
        with_payload: true,
      }
    );

    return response.data.result.points;
  } catch (error) {
    console.error("Error getting all points:", error);
    throw error;
  }
};

module.exports = {
  initializeQdrant,
  getQdrantClient,
  createCollection,
  addDocument,
  addDocuments,
  searchSimilar,
  getCollectionInfo,
  deleteCollection,
  getAllPoints,
};
