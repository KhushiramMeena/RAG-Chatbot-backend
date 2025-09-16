#!/usr/bin/env node

/**
 * News Ingestion Script
 *
 * This script fetches news articles from RSS feeds, processes them,
 * creates embeddings, and stores them in the vector database.
 *
 * Usage:
 *   npm run ingest
 *   node src/scripts/ingestNews.js
 */

require("dotenv").config({
  path: require("path").join(__dirname, "../../../.env"),
});
const { ingestNews, runIngestion } = require("../services/newsIngestion");
const { initializeRedis } = require("../services/redis");
const { initializeQdrant } = require("../services/qdrant");
const { initializeDatabase } = require("../services/database");

async function main() {
  console.log("🚀 Starting news ingestion process...");
  console.log("=====================================");

  try {
    // Initialize services
    console.log("📡 Initializing services...");

    await initializeRedis();
    console.log("✓ Redis connected");

    await initializeQdrant();
    console.log("✓ Qdrant connected");

    await initializeDatabase();
    console.log("✓ Database connected");

    // Run ingestion
    console.log("\n📰 Starting news ingestion...");
    const result = await runIngestion();

    if (result.success) {
      console.log("\n✅ News ingestion completed successfully!");
      console.log(`📊 Processed ${result.articlesCount} articles`);
      console.log("🎉 Articles are now available for querying");
    } else {
      console.error("\n❌ News ingestion failed:");
      console.error(result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Fatal error during news ingestion:");
    console.error(error.message);
    console.error("\nStack trace:");
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

module.exports = { main };
