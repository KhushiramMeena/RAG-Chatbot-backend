const axios = require("axios");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const { v4: uuidv4 } = require("uuid");
const { createArticleEmbeddings } = require("./embeddings");
const { addDocuments } = require("./qdrant");
const { setCache } = require("./redis");

const parser = new Parser();

// Default RSS feeds
const DEFAULT_FEEDS = [
  "https://feeds.reuters.com/reuters/topNews",
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://feeds.cnn.com/rss/edition.rss",
  "https://rss.cnn.com/rss/edition.rss",
  "https://feeds.npr.org/1001/rss.xml",
];

// Extract text content from HTML
const extractTextContent = (html) => {
  const $ = cheerio.load(html);

  // Remove script and style elements
  $("script, style").remove();

  // Get text content
  const text = $.text();

  // Clean up whitespace
  return text.replace(/\s+/g, " ").trim();
};

// Fetch and parse RSS feed
const fetchRSSFeed = async (feedUrl) => {
  try {
    console.log(`Fetching RSS feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);

    const articles = feed.items.map((item) => ({
      id: uuidv4(),
      title: item.title || "",
      content: item.contentSnippet || item.content || item.description || "",
      url: item.link || "",
      publishedAt: item.pubDate || new Date().toISOString(),
      source: feed.title || "Unknown Source",
      summary: item.contentSnippet || item.description || "",
    }));

    console.log(`Fetched ${articles.length} articles from ${feedUrl}`);
    return articles;
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
};

// Fetch HTML content for articles that need more content
const fetchArticleContent = async (article) => {
  try {
    if (!article.url || article.content.length > 500) {
      return article; // Skip if no URL or already has good content
    }

    console.log(`Fetching content for: ${article.title}`);
    const response = await axios.get(article.url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // Try to find article content
    let content = "";

    // Common selectors for article content
    const contentSelectors = [
      "article",
      ".article-content",
      ".post-content",
      ".entry-content",
      ".story-body",
      ".article-body",
      '[data-module="ArticleBody"]',
      ".StandardArticleBody_body",
      ".ArticleBody-articleBody",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = extractTextContent(element.html());
        break;
      }
    }

    // If no specific content found, try to get all paragraphs
    if (!content) {
      const paragraphs = $("p")
        .map((i, el) => $(el).text())
        .get();
      content = paragraphs.join(" ");
    }

    // Clean and limit content
    content = content.replace(/\s+/g, " ").trim();
    if (content.length > 5000) {
      content = content.substring(0, 5000) + "...";
    }

    return {
      ...article,
      content: content || article.content,
    };
  } catch (error) {
    console.error(`Error fetching content for ${article.url}:`, error);
    return article; // Return original article if fetching fails
  }
};

// Process articles and create embeddings
const processArticles = async (articles) => {
  try {
    console.log(`Processing ${articles.length} articles...`);

    // Filter out articles with very short content
    const validArticles = articles.filter(
      (article) => article.title.length > 10 && article.content.length > 50
    );

    console.log(`Valid articles: ${validArticles.length}`);

    // Create embeddings for articles
    const articlesWithEmbeddings = await createArticleEmbeddings(validArticles);

    // Store in vector database
    await addDocuments(articlesWithEmbeddings);

    // Cache the articles for quick access
    await setCache("latest_articles", articlesWithEmbeddings, 3600); // 1 hour cache

    console.log(
      `Successfully processed and stored ${articlesWithEmbeddings.length} articles`
    );
    return articlesWithEmbeddings;
  } catch (error) {
    console.error("Error processing articles:", error);
    throw error;
  }
};

// Main ingestion function
const ingestNews = async (feedUrls = null) => {
  try {
    const feeds =
      feedUrls || process.env.NEWS_RSS_FEEDS?.split(",") || DEFAULT_FEEDS;

    console.log("Starting news ingestion...");
    console.log(`Using feeds: ${feeds.join(", ")}`);

    // Fetch all RSS feeds
    const allArticles = [];
    for (const feedUrl of feeds) {
      const articles = await fetchRSSFeed(feedUrl);
      allArticles.push(...articles);

      // Small delay between feeds
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Total articles fetched: ${allArticles.length}`);

    // Remove duplicates based on URL
    const uniqueArticles = allArticles.filter(
      (article, index, self) =>
        index === self.findIndex((a) => a.url === article.url)
    );

    console.log(`Unique articles: ${uniqueArticles.length}`);

    // Fetch additional content for articles that need it
    const enrichedArticles = [];
    for (const article of uniqueArticles.slice(0, 50)) {
      // Limit to 50 articles
      const enrichedArticle = await fetchArticleContent(article);
      enrichedArticles.push(enrichedArticle);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Process and store articles
    await processArticles(enrichedArticles);

    return enrichedArticles;
  } catch (error) {
    console.error("Error in news ingestion:", error);
    throw error;
  }
};

// Initialize news ingestion (run on startup)
const initializeNewsIngestion = async () => {
  try {
    // Check if we already have recent articles
    const { getCache } = require("./redis");
    const cachedArticles = await getCache("latest_articles");

    if (cachedArticles && cachedArticles.length > 0) {
      console.log(`Using cached articles: ${cachedArticles.length}`);
      return cachedArticles;
    }

    // Run ingestion
    return await ingestNews();
  } catch (error) {
    console.error("Error initializing news ingestion:", error);
    // Don't throw error to prevent server startup failure
    return [];
  }
};

// Manual ingestion endpoint
const runIngestion = async () => {
  try {
    console.log("Running manual news ingestion...");
    const articles = await ingestNews();
    return {
      success: true,
      articlesCount: articles.length,
      message: `Successfully ingested ${articles.length} articles`,
    };
  } catch (error) {
    console.error("Manual ingestion failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  fetchRSSFeed,
  fetchArticleContent,
  processArticles,
  ingestNews,
  initializeNewsIngestion,
  runIngestion,
};
