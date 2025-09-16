# RAG Chatbot Backend

A Node.js backend service for a Retrieval-Augmented Generation (RAG) chatbot that provides intelligent responses based on real-time news articles.

## Live Demo

**Frontend**: [https://rag-chatbot-hglp.onrender.com/](https://rag-chatbot-hglp.onrender.com/)

## Features

- **RAG Pipeline**: Retrieves relevant news articles and generates contextual responses
- **Real-time Communication**: WebSocket support for live chat interactions
- **Vector Search**: Uses Qdrant for semantic search of news articles
- **AI Integration**: Powered by Gemini AI for response generation
- **Caching**: Redis-based caching for improved performance
- **Session Management**: Persistent chat sessions with PostgreSQL

## Tech Stack

- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL for persistence, Redis for caching
- **Vector Database**: Qdrant for embeddings storage
- **AI Services**: Gemini AI (LLM), Jina AI (embeddings)
- **Real-time**: Socket.io for WebSocket communication
- **Deployment**: Render.com

## API Endpoints

### Chat

- `POST /api/chat/session` - Create new chat session
- `POST /api/chat/message` - Send message and get response
- `GET /api/chat/history/:sessionId` - Get chat history

### Sessions

- `GET /api/session` - Get all sessions
- `GET /api/session/:sessionId` - Get specific session
- `DELETE /api/session/:sessionId` - Delete session

### Health

- `GET /health` - Health check endpoint
- `GET /api/health` - API health status

## Environment Variables

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port
QDRANT_URL=https://cluster.qdrant.tech:6333
QDRANT_API_KEY=your_qdrant_api_key
GEMINI_API_KEY=your_gemini_api_key
JINA_API_KEY=your_jina_api_key
FRONTEND_URL=https://your-frontend.onrender.com
NEWS_RSS_FEEDS=https://feeds.bbci.co.uk/news/rss.xml,https://rss.cnn.com/rss/edition.rss
SESSION_TTL=3600
CACHE_TTL=1800
```

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Start production server
npm start
```

## Architecture

The backend follows a microservices architecture with separate services for different concerns:

### Core Services

- **News Ingestion Service**: RSS feed processing and article indexing
- **RAG Service**: Query processing and response generation
- **Database Service**: Data persistence and retrieval
- **Cache Service**: Redis integration for performance
- **Vector Service**: Qdrant integration for semantic search

### Data Flow

1. **News Ingestion**: RSS feeds → Article processing → Embedding creation → Qdrant storage
2. **Query Processing**: User query → Embedding → Vector search → Context retrieval
3. **Response Generation**: Context + Query → Gemini AI → Formatted response
4. **Caching**: Responses cached in Redis for performance
5. **Session Management**: Chat sessions stored in PostgreSQL

### RAG Pipeline

```
User Query → Embedding → Vector Search → Context Retrieval → AI Generation → Response
     ↓              ↓           ↓              ↓              ↓
   Cache        Jina API    Qdrant DB      News Articles   Gemini AI
```

### Service Dependencies

- **Express.js**: Web framework and API routing
- **Socket.io**: Real-time communication
- **PostgreSQL**: Session and message persistence
- **Redis**: Caching and temporary storage
- **Qdrant**: Vector database for semantic search
- **Gemini AI**: Large language model for response generation
- **Jina AI**: Embedding generation service

## Project Structure

```
src/
├── routes/              # API route handlers
│   ├── chat.js         # Chat endpoints and WebSocket handling
│   └── session.js      # Session management endpoints
├── services/           # Core business logic
│   ├── ragService.js  # RAG pipeline implementation
│   ├── qdrant.js      # Vector database operations
│   ├── embeddings.js  # Embedding generation
│   ├── gemini.js      # AI response generation
│   ├── newsIngestion.js # RSS feed processing
│   ├── database.js    # PostgreSQL operations
│   └── redis.js       # Cache operations
├── scripts/           # Utility scripts
│   └── ingestNews.js  # Manual news ingestion
├── server.js          # Main application entry point
└── sql/              # Database initialization
    └── init.sql      # Database schema
```

## Key Features

### News Processing

- **RSS Feed Parsing**: Supports multiple news sources
- **Content Extraction**: Intelligent article content extraction
- **Embedding Generation**: Creates vector embeddings for semantic search
- **Vector Indexing**: Stores embeddings in Qdrant for fast retrieval

### RAG Implementation

- **Query Understanding**: Converts user queries to embeddings
- **Context Retrieval**: Finds relevant articles using vector similarity
- **Response Generation**: Uses Gemini AI with retrieved context
- **Source Citation**: Provides article sources with responses

### Performance Optimizations

- **Multi-level Caching**: Redis caching for queries, sessions, and articles
- **Connection Pooling**: Efficient database connection management
- **Batch Processing**: Optimized embedding and indexing operations
- **Error Handling**: Graceful degradation and fallback mechanisms

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Deployment

The application is deployed on Render.com with the following services:

- **Backend**: Web service with auto-scaling
- **PostgreSQL**: Managed database
- **Redis**: Managed cache service

