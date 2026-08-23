const { GoogleGenerativeAI } = require('@google/generative-ai');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const AISession = require('../models/AISession');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper to normalize Gemini model names
const getGeminiModelName = (selectedModel) => {
  switch (selectedModel) {
    case 'gemini-3.1-pro-preview':
      return 'gemini-3.1-pro-preview';
    case 'gemini-3.5-flash':
      return 'gemini-3.5-flash';
    case 'gemini-3.6-flash':
    default:
      return 'gemini-3.6-flash';
  }
};

/**
 * Health check ping endpoint to test latency and wake up cold server instances
 */
exports.pingAI = async (req, res) => {
  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  const groqConfigured = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here');

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    apiKeyConfigured,
    groqConfigured,
    availableModels: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'Google', default: true },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'Google' },
      { id: 'groq-llama3', name: 'Groq Llama 3.3', provider: 'Groq', requiresKey: true, active: groqConfigured }
    ]
  });
};

/**
 * Get all AI sessions for authenticated user
 */
exports.getAISessions = async (req, res) => {
  try {
    const sessions = await AISession.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (error) {
    logger.error('GET_AI_SESSIONS_ERROR', error.message || error);
    res.status(500).json({ message: 'Error fetching AI chat sessions' });
  }
};

/**
 * Create a new AI chat session in MongoDB
 */
exports.createAISession = async (req, res) => {
  try {
    const { title, modelPreference, messages } = req.body;
    const session = await AISession.create({
      user: req.user._id,
      title: title || 'New Chat',
      modelPreference: modelPreference || 'gemini-3.6-flash',
      messages: messages || []
    });
    res.status(201).json(session);
  } catch (error) {
    logger.error('CREATE_AI_SESSION_ERROR', error.message || error);
    res.status(500).json({ message: 'Error creating AI chat session' });
  }
};

/**
 * Update an existing AI chat session in MongoDB
 */
exports.updateAISession = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, modelPreference, messages } = req.body;

    const session = await AISession.findOne({ _id: id, user: req.user._id });
    if (!session) {
      return res.status(404).json({ message: 'AI Chat session not found' });
    }

    if (title !== undefined) session.title = title;
    if (modelPreference !== undefined) session.modelPreference = modelPreference;
    if (messages !== undefined) session.messages = messages;

    await session.save();
    res.json(session);
  } catch (error) {
    logger.error('UPDATE_AI_SESSION_ERROR', error.message || error);
    res.status(500).json({ message: 'Error updating AI chat session' });
  }
};

/**
 * Delete an AI chat session from MongoDB
 */
exports.deleteAISession = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AISession.deleteOne({ _id: id, user: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'AI Chat session not found' });
    }
    res.json({ message: 'AI Chat session deleted successfully' });
  } catch (error) {
    logger.error('DELETE_AI_SESSION_ERROR', error.message || error);
    res.status(500).json({ message: 'Error deleting AI chat session' });
  }
};

/**
 * Real-Time SSE Token-by-Token Streaming Controller
 */
exports.streamAIChat = async (req, res) => {
  const { message, history, sessionId, model: requestedModel } = req.body;
  const userId = req.user._id.toString();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!message || message.trim() === '') {
    res.write(`data: ${JSON.stringify({ error: 'A message transmission is required.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const selectedModel = requestedModel || 'gemini-3.6-flash';

  // Handle Groq streaming if requested and key is present
  if (selectedModel === 'groq-llama3' && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    try {
      logger.info('AI_CONTROLLER', `Streaming Groq transmission for User: ${userId}`);
      const groqMessages = [
        {
          role: 'system',
          content: 'You are the Talk-Sphere Neural Assistant powered by Groq LPUs. Provide sharp, fact-based, modern, and well-formatted markdown responses.'
        },
        ...(history || []).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: message }
      ];

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: groqMessages,
          stream: true,
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!groqResponse.ok) {
        throw new Error(`Groq API returned HTTP status ${groqResponse.status}`);
      }

      const reader = groqResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              return res.end();
            }
            try {
              const parsed = JSON.parse(dataStr);
              const chunkText = parsed.choices?.[0]?.delta?.content || '';
              if (chunkText) {
                res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
              }
            } catch (e) {
              // Ignore line parse errors
            }
          }
        }
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (groqErr) {
      logger.error('GROQ_AI_ERROR', groqErr.message || groqErr);
      res.write(`data: ${JSON.stringify({ chunk: `⚠️ *Groq Fallback Notice:* ${groqErr.message}. Falling back to Gemini 3.6 Flash...\n\n` })}\n\n`);
      // Fallthrough to Gemini
    }
  }

  // Gemini AI Stream Implementation
  try {
    logger.info('AI_CONTROLLER', `Streaming Gemini transmission for User: ${userId} (${selectedModel})`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      res.write(`data: ${JSON.stringify({ error: 'Gemini API key is not configured on the server. Please update GEMINI_API_KEY in .env.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const geminiModelName = getGeminiModelName(selectedModel);
    
    const model = genAI.getGenerativeModel({
      model: geminiModelName,
      systemInstruction: "You are the Talk-Sphere Neural Assistant, a highly intelligent, factual, and modern AI assistant integrated into the Talk-Sphere ecosystem. Provide clean, well-formatted responses in Markdown with syntax-highlighted code blocks where appropriate."
    });

    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const resultStream = await chat.sendMessageStream(message);

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error('GEMINI_AI_STREAM_ERROR', error.message || error);

    let fallbackText = '';
    const isApiKeyError =
      error.message?.includes('API key') ||
      error.message?.includes('API_KEY') ||
      error.message?.includes('403') ||
      error.message?.includes('Forbidden');

    if (isApiKeyError) {
      fallbackText = `⚠️ **System Message:** The server's configured Gemini API key is invalid, expired, or flagged. Please check \`GEMINI_API_KEY\` in your server \`.env\`.`;
    } else if (error.message?.includes('503') || error.message?.includes('Service Unavailable') || error.message?.includes('overloaded')) {
      fallbackText = `⚠️ **System Message:** Google's Gemini AI service is currently experiencing high demand (503). Please try sending your transmission again in a few moments.`;
    } else {
      fallbackText = `⚠️ **System Message:** An error occurred during AI token generation: \`${error.message || 'Unknown Error'}\`.`;
    }

    res.write(`data: ${JSON.stringify({ error: fallbackText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};

/**
 * Standard non-streaming fallback endpoint
 */
exports.chatWithAI = async (req, res) => {
  const { message, history, sessionId, model: requestedModel } = req.body;
  const io = req.app.get('io');
  const userId = req.user._id.toString();

  try {
    logger.info('AI_CONTROLLER', `Transmission incoming from User: ${userId} (Session: ${sessionId})`);

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'A message transmission is required.' });
    }

    if (io && sessionId) {
      io.to(userId).emit('ai_generating', { sessionId });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(500).json({ message: 'Gemini API key is not configured on the server.' });
    }

    const geminiModelName = getGeminiModelName(requestedModel);
    const model = genAI.getGenerativeModel({
      model: geminiModelName,
      systemInstruction: "You are the Talk-Sphere Neural Assistant, a highly intelligent and factual AI integrated into the Talk-Sphere ecosystem."
    });

    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    if (io && sessionId) {
      io.to(userId).emit('ai_response_received', {
        sessionId,
        userMessage: { role: 'user', content: message, createdAt: new Date() },
        aiMessage: { role: 'assistant', content: text, createdAt: new Date() }
      });
    }

    res.json({
      content: text,
      role: 'assistant'
    });
  } catch (error) {
    logger.error('Gemini AI Error:', error.message || error);
    let fallbackText = `⚠️ **System Message:** An error occurred: \`${error.message || 'Unknown Error'}\`.`;

    return res.json({
      content: fallbackText,
      role: 'assistant'
    });
  }
};


