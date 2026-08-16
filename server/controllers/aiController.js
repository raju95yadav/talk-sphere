const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.chatWithAI = async (req, res) => {
  const { message, history, sessionId } = req.body;
  const io = req.app.get('io');
  const userId = req.user._id.toString();

  try {
    console.log('--- AI TRANSMISSION INCOMING ---');
    console.log('User Message:', message);
    console.log('Session ID:', sessionId);
    console.log('Context History Size:', history?.length || 0);

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'A message transmission is required.' });
    }

    // Broadcast AI is generating
    if (io && sessionId) {
      io.to(userId).emit('ai_generating', { sessionId });
    }

    // Check if API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(500).json({ message: 'Gemini API key is not configured on the server.' });
    }

    // Prepare the model with a system persona for accuracy
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: "You are the Talk-Sphere Neural Assistant, a highly intelligent and factual AI integrated into the Talk-Sphere ecosystem. Your goal is to provide accurate, helpful, and professional responses. If a user asks for health, technical, or factual data, ensure it is based on reliable sources. Keep your tone professional yet modern. Use markdown for clear formatting."
    });

    // Format history for Gemini (if provided)
    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    // Broadcast AI response received
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
    console.error('Gemini AI Error:', error.message || error);
    
    let fallbackText = '';

    // Check if error is related to an invalid/blocked/leaked API key
    const isApiKeyError = 
      error.message?.includes('API key') || 
      error.message?.includes('API_KEY') || 
      error.message?.includes('403') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('API key leaks');

    if (isApiKeyError) {
      fallbackText = `⚠️ **System Message:** The server's configured Gemini API key is invalid, expired, or has been flagged as leaked. \n\nTo restore full AI Assistant functionality, please update the \`GEMINI_API_KEY\` variable in your server's \`.env\` file with a valid key from Google AI Studio.`;
    } else if (error.message?.includes('503') || error.message?.includes('Service Unavailable') || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
      fallbackText = `⚠️ **System Message:** Google's Gemini AI service is currently experiencing high demand or is temporarily unavailable (503 Service Unavailable). \n\nPlease wait a few moments and try sending your transmission again.`;
    } else {
      fallbackText = `⚠️ **System Message:** An error occurred while communicating with Google's Gemini AI service.\n\n*Error details:* \`${error.message || 'Unknown Error'}\`\n\nPlease try again.`;
    }

    if (io && sessionId) {
      io.to(userId).emit('ai_response_received', {
        sessionId,
        userMessage: { role: 'user', content: message, createdAt: new Date() },
        aiMessage: { role: 'assistant', content: fallbackText, createdAt: new Date() }
      });
    }

    return res.json({ 
      content: fallbackText,
      role: 'assistant'
    });
  }
};
