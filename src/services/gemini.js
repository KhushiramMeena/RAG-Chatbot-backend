const axios = require("axios");

let geminiClient = null;

const initializeGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.warn(
      "⚠️  GEMINI_API_KEY not configured. Using fallback responses for testing."
    );
    return null; // Return null to indicate fallback mode
  }

  geminiClient = axios.create({
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    headers: {
      "Content-Type": "application/json",
    },
    params: {
      key: apiKey,
    },
  });

  return geminiClient;
};

const getGeminiClient = () => {
  if (!geminiClient) {
    geminiClient = initializeGemini();
  }
  return geminiClient;
};

// Fallback response for testing without API keys
const generateFallbackResponse = (query, context) => {
  const responses = [
    "I'm currently running in demo mode. To get AI-powered responses, please configure your Gemini API key in the .env file.",
    "This is a test response. The chatbot is working, but you need to add your Gemini API key for full functionality.",
    "Demo mode active! Add your API keys to enable AI-powered news analysis and responses.",
    "The system is running successfully. Configure your Gemini API key to unlock AI capabilities.",
  ];

  const randomResponse =
    responses[Math.floor(Math.random() * responses.length)];

  return {
    response: randomResponse,
    sources: context.map((doc) => ({
      title: doc.title,
      url: doc.url,
      source: doc.source,
    })),
  };
};

// Generate response using Gemini
const generateResponse = async (query, context, sessionHistory = []) => {
  const client = getGeminiClient();

  // Use fallback if no API key is configured
  if (!client) {
    return generateFallbackResponse(query, context);
  }

  try {
    // Prepare context from retrieved documents
    const contextText = context
      .map(
        (doc) =>
          `Title: ${doc.title}\nContent: ${doc.content}\nSource: ${doc.source}\nURL: ${doc.url}\n`
      )
      .join("\n---\n");

    // Prepare conversation history
    const historyText = sessionHistory
      .slice(-5)
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n");

    // Create the prompt
    const prompt = `You are a helpful news assistant. Based on the following news articles and conversation history, answer the user's question accurately and concisely.

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}

Relevant news articles:
${contextText}

User question: ${query}

Please provide a helpful answer based on the news articles above. If the information is not available in the provided articles, please say so. Include relevant details and cite sources when possible.`;

    const response = await client.post(
      "/models/gemini-1.5-flash:generateContent",
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      }
    );

    const generatedText = response.data.candidates[0].content.parts[0].text;

    return {
      response: generatedText,
      sources: context.map((doc) => ({
        title: doc.title,
        url: doc.url,
        source: doc.source,
      })),
    };
  } catch (error) {
    console.error("Error generating response:", error);

    // Handle specific Gemini API errors
    if (error.response) {
      const errorData = error.response.data;
      if (errorData.error) {
        throw new Error(`Gemini API Error: ${errorData.error.message}`);
      }
    }

    throw new Error("Failed to generate response from Gemini");
  }
};

// Generate streaming response (if supported)
const generateStreamingResponse = async (
  query,
  context,
  sessionHistory = [],
  onChunk
) => {
  const client = getGeminiClient();

  // Use fallback if no API key is configured
  if (!client) {
    const fallbackResponse = generateFallbackResponse(query, context);
    // Simulate streaming by sending the response in chunks
    const words = fallbackResponse.response.split(" ");
    for (let i = 0; i < words.length; i++) {
      onChunk(words[i] + " ");
      await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
    }
    return fallbackResponse;
  }

  try {
    // Prepare context from retrieved documents
    const contextText = context
      .map(
        (doc) =>
          `Title: ${doc.title}\nContent: ${doc.content}\nSource: ${doc.source}\nURL: ${doc.url}\n`
      )
      .join("\n---\n");

    // Prepare conversation history
    const historyText = sessionHistory
      .slice(-5)
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n");

    // Create the prompt
    const prompt = `You are a helpful news assistant. Based on the following news articles and conversation history, answer the user's question accurately and concisely.

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}

Relevant news articles:
${contextText}

User question: ${query}

Please provide a helpful answer based on the news articles above. If the information is not available in the provided articles, please say so. Include relevant details and cite sources when possible.`;

    const response = await client.post(
      "/models/gemini-1.5-flash:streamGenerateContent",
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      },
      {
        responseType: "stream",
      }
    );

    let fullResponse = "";

    response.data.on("data", (chunk) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (
              data.candidates &&
              data.candidates[0] &&
              data.candidates[0].content
            ) {
              const text = data.candidates[0].content.parts[0].text;
              fullResponse += text;
              onChunk(text);
            }
          } catch (e) {
            // Ignore parsing errors for streaming
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      response.data.on("end", () => {
        resolve({
          response: fullResponse,
          sources: context.map((doc) => ({
            title: doc.title,
            url: doc.url,
            source: doc.source,
          })),
        });
      });

      response.data.on("error", reject);
    });
  } catch (error) {
    console.error("Error generating streaming response:", error);
    throw new Error("Failed to generate streaming response from Gemini");
  }
};

// Test Gemini connection
const testConnection = async () => {
  try {
    const client = getGeminiClient();
    const response = await client.post(
      "/models/gemini-1.5-flash:generateContent",
      {
        contents: [
          {
            parts: [
              {
                text: "Hello, this is a test.",
              },
            ],
          },
        ],
      }
    );

    return response.status === 200;
  } catch (error) {
    console.error("Gemini connection test failed:", error);
    return false;
  }
};

module.exports = {
  initializeGemini,
  getGeminiClient,
  generateResponse,
  generateStreamingResponse,
  testConnection,
};
