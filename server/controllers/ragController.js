const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const RagDocument = require('../models/RagDocument');
const RagChunk = require('../models/RagChunk');
const AISession = require('../models/AISession');
const logger = require('../utils/logger');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Generate 768-dimensional embeddings using Gemini text-embedding-004 with fallback
const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return new Array(768).fill(0);
  }

  // Primary: text-embedding-004 with 768 dimensions
  try {
    const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const res = await embedModel.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 768
    });
    if (res?.embedding?.values && res.embedding.values.length === 768) {
      return res.embedding.values;
    }
  } catch (err) {
    logger.warn('RAG_EMBEDDING_RETRY', `text-embedding-004: ${err.message}. Falling back to gemini-embedding-001 (768-dim)...`);
  }

  // Fallback: gemini-embedding-001 with outputDimensionality: 768
  try {
    const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const res = await fallbackModel.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 768
    });
    if (res?.embedding?.values && res.embedding.values.length === 768) {
      return res.embedding.values;
    }
  } catch (fallbackErr) {
    logger.error('RAG_EMBEDDING_FAILED', fallbackErr.message || fallbackErr);
    throw new Error(`Embedding generation failed: ${fallbackErr.message}`);
  }

  throw new Error('Could not obtain 768-dimensional embedding from Gemini');
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Extract text from uploaded buffer by file format (.pdf, .docx, .txt, .md)
const extractTextFromBuffer = async (buffer, fileType) => {
  const normType = fileType.toLowerCase().replace(/^\./, '');
  switch (normType) {
    case 'pdf': {
      if (typeof pdfParse === 'function') {
        const data = await pdfParse(buffer);
        return data.text || '';
      }
      if (pdfParse && pdfParse.PDFParse) {
        const parser = new pdfParse.PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          return result.text || '';
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy();
          }
        }
      }
      throw new Error('PDF parsing library is unavailable');
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    case 'txt':
    case 'md': {
      return buffer.toString('utf-8');
    }
    default:
      throw new Error(`Unsupported document format: ${fileType}`);
  }
};

// Semantic chunking with overlap
const chunkText = (fullText, chunkSize = 800, overlap = 150) => {
  if (!fullText) return [];
  const clean = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n\s*\n/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((current + '\n\n' + trimmed).length <= chunkSize) {
      current = current ? current + '\n\n' + trimmed : trimmed;
    } else {
      if (current) {
        chunks.push(current.trim());
        const overlapStart = Math.max(0, current.length - overlap);
        current = current.substring(overlapStart).trim();
      }

      if (trimmed.length > chunkSize) {
        let start = 0;
        while (start < trimmed.length) {
          const end = Math.min(start + chunkSize, trimmed.length);
          const slice = trimmed.substring(start, end).trim();
          if (slice.length > 20) {
            chunks.push(slice);
          }
          start += (chunkSize - overlap);
        }
        current = '';
      } else {
        current = current ? current + '\n\n' + trimmed : trimmed;
      }
    }
  }

  if (current && current.trim().length > 20) {
    chunks.push(current.trim());
  }

  // Fallback to simple sliding window if no paragraphs were formed
  if (chunks.length === 0 && clean.length > 0) {
    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + chunkSize, clean.length);
      const slice = clean.substring(start, end).trim();
      if (slice.length > 0) chunks.push(slice);
      start += (chunkSize - overlap);
    }
  }

  return chunks;
};

// Candidate generation models starting with gemini-1.5-flash as specified
const getGenerationCandidates = () => {
  return ['gemini-1.5-flash', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
};

/**
 * 1. Upload & Process Document (PDF, DOCX, TXT, MD)
 */
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file uploaded.' });
    }

    const { originalname, size, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase().replace('.', '');
    const allowed = ['pdf', 'docx', 'txt', 'md'];

    if (!allowed.includes(ext)) {
      return res.status(400).json({ 
        message: `Unsupported file format '.${ext}'. Allowed formats: .pdf, .docx, .txt, .md` 
      });
    }

    const title = req.body.title?.trim() || originalname.replace(/\.[^/.]+$/, '');

    // Step A: Extract plain text
    const extractedText = await extractTextFromBuffer(buffer, ext);
    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({ message: 'The uploaded document contains no readable text.' });
    }

    // Step B: Chunk text
    const textChunks = chunkText(extractedText, 800, 150);
    if (textChunks.length === 0) {
      return res.status(400).json({ message: 'Failed to extract usable text chunks from document.' });
    }

    // Step C: Create Document in MongoDB
    const ragDoc = await RagDocument.create({
      user: req.user._id,
      title,
      originalName: originalname,
      fileType: ext,
      fileSize: size,
      totalChunks: textChunks.length
    });

    // Step D: Generate 768-dim embeddings in small batches to respect rate limits
    const chunkDocs = [];
    const BATCH_SIZE = 4;
    for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
      const batch = textChunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (chunkTextContent, idx) => {
        const chunkIndex = i + idx;
        const embedding = await generateEmbedding(chunkTextContent);
        return {
          user: req.user._id,
          document: ragDoc._id,
          chunkIndex,
          content: chunkTextContent,
          embedding,
          pageNumber: Math.floor(chunkIndex / 3) + 1,
          tokenCount: Math.round(chunkTextContent.length / 4)
        };
      });

      const batchResults = await Promise.all(batchPromises);
      chunkDocs.push(...batchResults);

      if (i + BATCH_SIZE < textChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // Step E: Persist all chunks permanently in MongoDB under user's ID
    await RagChunk.insertMany(chunkDocs);

    logger.info('RAG_DOC_UPLOADED', `User ${req.user._id} uploaded ${originalname} (${chunkDocs.length} chunks)`);

    res.status(201).json({
      message: 'Document successfully parsed, chunked, and embedded with 768-dim vectors.',
      document: ragDoc
    });
  } catch (error) {
    logger.error('RAG_UPLOAD_ERROR', error.message || error);
    res.status(500).json({ message: `Document upload processing failed: ${error.message}` });
  }
};

/**
 * 2. Get All Documents for Authenticated User
 */
exports.getDocuments = async (req, res) => {
  try {
    const documents = await RagDocument.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    logger.error('RAG_GET_DOCS_ERROR', error.message || error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
};

/**
 * 3. Get Single Document with chunk previews
 */
exports.getDocumentById = async (req, res) => {
  try {
    const document = await RagDocument.findOne({ _id: req.params.id, user: req.user._id });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const chunkSample = await RagChunk.find({ document: document._id, user: req.user._id })
      .select('chunkIndex content pageNumber tokenCount')
      .limit(5);

    res.json({ document, chunkSample });
  } catch (error) {
    logger.error('RAG_GET_DOC_ERROR', error.message || error);
    res.status(500).json({ message: 'Error fetching document details' });
  }
};

/**
 * 4. Delete Document with CASCADE DELETION
 * Removes:
 * - Document record
 * - All related chunks & 768-dim embeddings
 * - All chat messages/sessions linked to this document
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await RagDocument.findOne({ _id: id, user: req.user._id });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Cascade delete chunks & embeddings
    const deletedChunks = await RagChunk.deleteMany({ document: id, user: req.user._id });

    // Cascade delete chat sessions associated with this document
    const deletedSessions = await AISession.deleteMany({ ragDocument: id, user: req.user._id });

    // Delete the document entry
    await RagDocument.deleteOne({ _id: id, user: req.user._id });

    logger.info('RAG_CASCADE_DELETE', `Deleted doc ${id}, ${deletedChunks.deletedCount} chunks, ${deletedSessions.deletedCount} sessions`);

    res.json({
      message: 'Document and all associated embeddings, chunks, and chat messages deleted successfully.',
      deletedChunksCount: deletedChunks.deletedCount,
      deletedSessionsCount: deletedSessions.deletedCount
    });
  } catch (error) {
    logger.error('RAG_DELETE_DOC_ERROR', error.message || error);
    res.status(500).json({ message: 'Error deleting document' });
  }
};

/**
 * 5. Clear RAG Chat History / Cascade Delete RAG Sessions
 */
exports.clearRagHistory = async (req, res) => {
  try {
    const { documentId } = req.body;
    const query = { user: req.user._id, mode: 'rag' };
    if (documentId && documentId !== 'all') {
      query.ragDocument = documentId;
    }

    const result = await AISession.deleteMany(query);
    res.json({
      message: 'RAG conversation history cleared successfully.',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('RAG_CLEAR_HISTORY_ERROR', error.message || error);
    res.status(500).json({ message: 'Error clearing RAG history' });
  }
};

/**
 * 6. Document Grounded Q&A Streaming Endpoint (SSE)
 */
exports.streamRagQuery = async (req, res) => {
  const { question, documentId, sessionId, history } = req.body;
  const userId = req.user._id.toString();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!question || !question.trim()) {
    res.write(`data: ${JSON.stringify({ error: 'Question is required.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  try {
    // Step A: Generate 768-dim embedding for user question
    const queryEmbedding = await generateEmbedding(question);

    // Step B: Retrieve candidate chunks from MongoDB
    const chunkFilter = { user: req.user._id };
    if (documentId && documentId !== 'all') {
      chunkFilter.document = documentId;
    }

    const candidateChunks = await RagChunk.find(chunkFilter)
      .populate('document', 'title originalName fileType')
      .lean();

    if (!candidateChunks || candidateChunks.length === 0) {
      res.write(`data: ${JSON.stringify({
        chunk: "⚠️ No documents found. Please upload a document (.pdf, .docx, .txt, or .md) to ask questions."
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Step C: Calculate Cosine Similarity & Rank Top Chunks
    const scoredChunks = candidateChunks.map(c => ({
      chunkIndex: c.chunkIndex,
      documentTitle: c.document?.title || c.document?.originalName || 'Document',
      documentId: c.document?._id,
      content: c.content,
      pageNumber: c.pageNumber || 1,
      similarity: cosineSimilarity(queryEmbedding, c.embedding)
    }));

    // Sort descending by similarity
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    // Take top 4-5 most relevant chunks
    const topChunks = scoredChunks.slice(0, 5);

    // Filter relevant sources (similarity threshold e.g. > 0.25)
    const relevantSources = topChunks.map(c => ({
      chunkIndex: c.chunkIndex,
      documentTitle: c.documentTitle,
      snippet: c.content.slice(0, 220) + (c.content.length > 220 ? '...' : ''),
      similarity: Math.round(c.similarity * 100),
      pageNumber: c.pageNumber
    }));

    // Emit sources metadata to client first
    res.write(`data: ${JSON.stringify({ type: 'sources', sources: relevantSources })}\n\n`);

    // Step D: Construct Augmented Prompt with Grounded Context
    const contextBlock = topChunks.map((c, idx) => 
      `[Source #${idx + 1} from "${c.documentTitle}" (Chunk ${c.chunkIndex})]:\n${c.content}`
    ).join('\n\n---\n\n');

    const systemPrompt = `You are the Talk-Sphere Neural Document Q&A Engine. You answer questions strictly and factually based on the provided document excerpts.

CRITICAL INSTRUCTIONS:
1. Ground your entire answer in the provided document context.
2. If the excerpts do not contain the answer, explicitly state: "The uploaded document does not contain sufficient information to answer this question." Do not extrapolate or guess.
3. Reference specific parts or section concepts where relevant.
4. Format your answer using clean GitHub-flavored Markdown with bold headings, bullet lists, or code snippets when helpful.`;

    const userAugmentedMessage = `DOCUMENT CONTEXT:
${contextBlock}

----------------------
USER QUESTION:
${question}`;

    // Step E: Stream generation using Gemini (trying gemini-1.5-flash first with fallback)
    const candidateModels = getGenerationCandidates();
    let streamSuccess = false;
    let accumulatedText = '';
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt
        });

        const chatHistory = (history || []).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
          history: chatHistory,
          generationConfig: {
            temperature: 0.2, // Low temperature for high factual precision
            maxOutputTokens: 2500
          }
        });

        const resultStream = await chat.sendMessageStream(userAugmentedMessage);

        for await (const chunk of resultStream.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            accumulatedText += chunkText;
            res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
          }
        }

        streamSuccess = true;
        break;
      } catch (genErr) {
        lastError = genErr;
        logger.warn('RAG_STREAM_MODEL_FALLBACK', `Model ${modelName} failed: ${genErr.message}`);
        if (accumulatedText) break; // Don't garble output if partial chunks were sent
      }
    }

    if (!streamSuccess && !accumulatedText) {
      res.write(`data: ${JSON.stringify({ 
        chunk: `⚠️ *Generation Warning:* Could not complete generation. Error: ${lastError?.message || 'Gemini service busy'}` 
      })}\n\n`);
    }

    // Step F: Persist Q&A turn with sources in AISession
    if (sessionId) {
      try {
        await AISession.findOneAndUpdate(
          { _id: sessionId, user: req.user._id },
          {
            $push: {
              messages: [
                { role: 'user', content: question, createdAt: new Date() },
                { 
                  role: 'assistant', 
                  content: accumulatedText || 'No response generated.', 
                  sources: relevantSources,
                  createdAt: new Date() 
                }
              ]
            },
            mode: 'rag',
            ragDocument: documentId && documentId !== 'all' ? documentId : null
          }
        );
      } catch (saveErr) {
        logger.warn('RAG_SESSION_SAVE_ERROR', saveErr.message);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error('RAG_STREAM_ERROR', error.message || error);
    res.write(`data: ${JSON.stringify({ error: `RAG Q&A Error: ${error.message}` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};
