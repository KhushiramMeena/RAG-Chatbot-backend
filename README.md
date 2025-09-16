# RAG-Powered News Chatbot - Backend

A Node.js Express backend that powers a RAG (Retrieval-Augmented Generation) chatbot for news websites. This backend ingests news articles, creates embeddings, stores them in a vector database, and provides intelligent responses using Google Gemini API.

## 🚀 Features

- **RAG Pipeline**: Ingests ~50 news articles from RSS feeds
- **Embeddings**: Uses Jina Embeddings for text vectorization
- **Vector Storage**: Qdrant for efficient similarity search
- **LLM Integration**: Google Gemini API for response generation
- **Session Management**: Redis-based session storage
- **Real-time Chat**: Socket.io for real-time communication
- **REST API**: Comprehensive API endpoints
- **Caching**: Redis caching for performance optimization
- **Database**: Optional MySQL persistence

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Embeddings**: Jina Embeddings API
- **Vector DB**: Qdrant
- **LLM**: Google Gemini API
- **Cache**: Redis
- **Database**: MySQL (optional)
- **News Sources**: RSS feeds, HTML scraping

## 📋 Prerequisites

- Node.js 18 or higher
- Redis server
- Qdrant instance (local or cloud)
- Google Gemini API key
- Jina API key
- MySQL (optional)

## 🔧 Installation

1. **Clone and navigate to backend directory**

   ```bash
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Redis Configuration
   REDIS_URL=redis://localhost:6379

   # API Keys
   GEMINI_API_KEY=your_gemini_api_key_here
   JINA_API_KEY=your_jina_api_key_here

   # Qdrant Configuration
   QDRANT_URL=http://localhost:6333

   # News Sources
   NEWS_RSS_FEEDS=https://feeds.reuters.com/reuters/topNews,https://feeds.bbci.co.uk/news/rss.xml
   ```

4. **Start Redis server**

   ```bash
   redis-server
   ```

5. **Start Qdrant server**
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### News Ingestion

```bash
npm run ingest
```

## 📡 API Endpoints

### Health Check

- `GET /health` - Server health status

### Chat Endpoints

- `POST /api/chat/session` - Create new chat session
- `POST /api/chat/message` - Send message to chat
- `GET /api/chat/history/:sessionId` - Get chat history
- `DELETE /api/chat/history/:sessionId` - Clear chat history
- `GET /api/chat/session/:sessionId` - Get session info

### Session Endpoints

- `POST /api/session` - Create session
- `GET /api/session/:sessionId` - Get session
- `GET /api/session` - Get all sessions
- `PUT /api/session/:sessionId` - Update session
- `DELETE /api/session/:sessionId` - Delete session
- `GET /api/session/stats/overview` - Get session statistics

## 🔌 Socket.io Events

### Client to Server

- `join_session` - Join a chat session
- `leave_session` - Leave a chat session

### Server to Client

- `new_message` - New message received
- `session_cleared` - Session cleared notification

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   News Sources  │───▶│  News Ingestion │───▶│   Embeddings    │
│   (RSS/HTML)    │    │     Service     │    │   (Jina API)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chat Client   │◀───│   REST API      │◀───│   Vector Store  │
│   (Frontend)    │    │   (Express)     │    │   (Qdrant)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   LLM Service   │
                       │  (Gemini API)   │
                       └─────────────────┘
```

## 🔄 RAG Pipeline Flow

1. **News Ingestion**: Fetch articles from RSS feeds
2. **Content Processing**: Clean and extract text content
3. **Embedding Creation**: Generate vectors using Jina API
4. **Vector Storage**: Store embeddings in Qdrant
5. **Query Processing**: Create query embeddings
6. **Similarity Search**: Find relevant articles
7. **Response Generation**: Use Gemini to generate answers
8. **Caching**: Cache results for performance

## 📊 Performance & Caching

- **Redis Caching**: Session data and query results
- **TTL Configuration**: Configurable cache expiration
- **Batch Processing**: Efficient bulk operations
- **Connection Pooling**: Optimized database connections

## 🔒 Security Features

- **Rate Limiting**: API request throttling
- **CORS Configuration**: Cross-origin resource sharing
- **Helmet**: Security headers
- **Input Validation**: Request sanitization
- **Error Handling**: Secure error responses

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📈 Monitoring

- **Health Checks**: Service status monitoring
- **Logging**: Comprehensive logging with Morgan
- **Error Tracking**: Detailed error reporting
- **Performance Metrics**: Response time tracking

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
REDIS_URL=redis://your-redis-host:6379
QDRANT_URL=https://your-qdrant-host:6333
GEMINI_API_KEY=your_production_gemini_key
JINA_API_KEY=your_production_jina_key
```

### Docker Deployment

```bash
# Build image
docker build -t rag-news-chatbot-backend .

# Run container
docker run -p 5000:5000 --env-file .env rag-news-chatbot-backend
```

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/server.js --name "rag-chatbot-backend"

# Monitor
pm2 monit
```

## 🔧 Configuration

### Cache TTL Settings

```env
SESSION_TTL=3600      # 1 hour
CACHE_TTL=1800        # 30 minutes
```

### Rate Limiting

- 100 requests per 15 minutes per IP
- Configurable in server.js

### News Sources

Configure RSS feeds in environment variables:

```env
NEWS_RSS_FEEDS=https://feeds.reuters.com/reuters/topNews,https://feeds.bbci.co.uk/news/rss.xml
```

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**

   - Ensure Redis server is running
   - Check REDIS_URL configuration

2. **Qdrant Connection Failed**

   - Verify Qdrant server is accessible
   - Check QDRANT_URL configuration

3. **API Key Issues**

   - Verify GEMINI_API_KEY is valid
   - Verify JINA_API_KEY is valid

4. **News Ingestion Fails**
   - Check RSS feed URLs
   - Verify network connectivity
   - Check API rate limits

### Debug Mode

```bash
DEBUG=* npm run dev
```

## 📝 API Documentation

### Request/Response Examples

#### Create Session

```bash
curl -X POST http://localhost:5000/api/chat/session
```

Response:

```json
{
  "success": true,
  "sessionId": "uuid-here",
  "message": "New session created successfully"
}
```

#### Send Message

```bash
curl -X POST http://localhost:5000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "uuid-here", "message": "What is the latest news?"}'
```

Response:

```json
{
  "success": true,
  "response": "Based on the latest news...",
  "sources": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "source": "News Source"
    }
  ],
  "sessionId": "uuid-here",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for Voosh Assignment**
