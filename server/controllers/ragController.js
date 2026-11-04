const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const RagDocument = require('../models/RagDocument');
const RagChunk = require('../models/RagChunk');
const AISession = require('../models/AISession');
const logger = require('../utils/logger');
const { geminiBreaker } = require('../services/circuitBreaker');
const {
  generateEmbedding,
  getQueryEmbedding,
  cosineSimilarity,
  genAI
} = require('../services/embeddingService');
const { addDocumentJob } = require('../config/queue');

// High-speed runtime cache for verified chat model
let verifiedChatModel = 'gemini-3.5-flash-lite';

// High-speed candidate generation models
const getGenerationCandidates = (clientModel) => {
  const fastModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash'];
  if (clientModel && fastModels.includes(clientModel)) {
    return [clientModel, ...fastModels.filter(m => m !== clientModel)];
  }
  if (verifiedChatModel && fastModels.includes(verifiedChatModel)) {
    return [verifiedChatModel, ...fastModels.filter(m => m !== verifiedChatModel)];
  }
  return fastModels;
};

// Clean answer text: strictly removes preambles, filler, and source references
const cleanAnswerText = (text) => {
  if (!text) return '';
  let cleaned = text;
  // Strip conversational preambles
  cleaned = cleaned.replace(/^(?:Based on (?:the )?(?:provided |uploaded )?(?:document|file|excerpts?|context)[,\.\:\s]*|According to (?:the )?(?:provided |uploaded )?(?:document|file|excerpts?|context)[,\.\:\s]*)/i, '');
  // Strip "the candidate's name is ...", "the candidate's DOB is ...", etc.
  cleaned = cleaned.replace(/^(?:the |a )?(?:candidate's |applicant's |person's )?(?:full )?(?:name|dob|date of birth|email|phone|contact|address) (?:is|was)[\s\:\-]+/i, '');
  // Strip Source Reference / Excerpt Reference lines
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:[-•*]\s*)?(?:Source|Excerpt|Document) Reference:[^\n]*/gi, '');
  return cleaned.trim();
};

/**
 * 1. Upload & Queue Document for Asynchronous Ingestion [B-06]
 * Returns HTTP 202 Accepted immediately. Offloads text extraction,
 * chunking, embedding generation, and bulk indexing to the background worker.
 */
exports.uploadDocument = async (req, res) => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file uploaded.' });
    }

    const { originalname, size, mimetype } = req.file;
    const ext = path.extname(originalname).toLowerCase().replace('.', '');
    const allowed = ['pdf', 'docx', 'txt', 'md'];

    if (!allowed.includes(ext)) {
      if (tempFilePath) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      return res.status(400).json({
        message: `Unsupported file format '.${ext}'. Allowed formats: .pdf, .docx, .txt, .md`
      });
    }

    const title = req.body.title?.trim() || originalname.replace(/\.[^/.]+$/, '');

    // Step A: Create lightweight RagDocument record in MongoDB with status: "queued"
    const document = await RagDocument.create({
      user: req.user._id,
      title,
      originalName: originalname,
      fileType: ext,
      fileSize: size,
      totalChunks: 0,
      status: 'queued'
    });

    // Step B: Dispatch job to BullMQ queue (or resilient async fallback)
    const queueDispatch = await addDocumentJob({
      documentId: document._id.toString(),
      filePath: tempFilePath,
      fileType: mimetype || ext,
      originalName: originalname,
      userId: req.user._id.toString()
    });

    logger.info('RAG_JOB_QUEUED', `Document ${document._id} queued for processing via ${queueDispatch.mode} (job: ${queueDispatch.jobId})`);

    // Step C: Return HTTP 202 Accepted immediately [B-06]
    return res.status(202).json({
      success: true,
      message: 'Document uploaded and queued for processing.',
      document: {
        id: document._id,
        _id: document._id,
        title: document.title,
        originalName: document.originalName,
        status: 'queued',
        jobId: queueDispatch.jobId
      }
    });
  } catch (error) {
    logger.error('RAG_UPLOAD_ERROR', error.message || error);
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }
    const statusCode = error.name === 'QueueServiceUnavailable' || error.statusCode === 503 ? 503 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Document upload processing failed',
      error: error.name || 'QueueServiceUnavailable'
    });
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
 * 6. Document Grounded Q&A Streaming Endpoint (SSE) [B-07]
 * Decoupled Online Inference & Retrieval:
 * 1. Generate query vector using cached Gemini embeddings.
 * 2. Execute native MongoDB Atlas Vector Search ($vectorSearch aggregation stage)
 *    to guarantee zero event-loop blocking during similarity scoring.
 * 3. Graceful fallback to indexed cosine similarity if $vectorSearch is not configured.
 * 4. Construct prompt and stream generation via SSE.
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
    // Step A: Generate query embedding (with memory cache & circuit breaker)
    const [queryEmbedding, docRecord] = await Promise.all([
      getQueryEmbedding(question),
      (documentId && documentId !== 'all')
        ? RagDocument.findById(documentId).select('title originalName').lean()
        : null
    ]);

    const defaultDocTitle = docRecord?.title || docRecord?.originalName || 'Document';

    let topChunks = [];
    let searchModeUsed = 'fallback';

    // Step B: Native MongoDB Atlas Vector Search ($vectorSearch aggregation) [B-07]
    try {
      const vectorSearchFilter = {
        user: new mongoose.Types.ObjectId(req.user._id)
      };
      if (documentId && documentId !== 'all') {
        vectorSearchFilter.document = new mongoose.Types.ObjectId(documentId);
      }

      const vectorPipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 10,
            filter: vectorSearchFilter
          }
        },
        {
          $project: {
            chunkIndex: 1,
            content: 1,
            pageNumber: 1,
            document: 1,
            score: { $meta: "vectorSearchScore" }
          }
        }
      ];

      const atlasResults = await RagChunk.aggregate(vectorPipeline);
      if (atlasResults && atlasResults.length > 0) {
        searchModeUsed = 'atlas_vector_search';
        topChunks = atlasResults.slice(0, 3).map(c => ({
          chunkIndex: c.chunkIndex,
          documentTitle: defaultDocTitle,
          documentId: c.document,
          content: c.content,
          pageNumber: c.pageNumber || 1,
          similarity: c.score || 0.95
        }));
      }
    } catch (atlasErr) {
      // Graceful fallback: If $vectorSearch is not configured in Atlas UI or running on local dev
      logger.info('VECTOR_SEARCH_FALLBACK', `Atlas $vectorSearch bypassed (${atlasErr.message}). Using indexed cosine similarity.`);
      searchModeUsed = 'cosine_fallback';
    }

    // Step C: Fallback to fast indexed lookup + cosine similarity if Atlas search was bypassed or empty
    if (searchModeUsed !== 'atlas_vector_search' || topChunks.length === 0) {
      const chunkFilter = { user: req.user._id };
      if (documentId && documentId !== 'all') {
        chunkFilter.document = documentId;
      }

      const candidateChunks = await RagChunk.find(chunkFilter)
        .select('chunkIndex content embedding pageNumber document')
        .lean();

      if (!candidateChunks || candidateChunks.length === 0) {
        res.write(`data: ${JSON.stringify({
          chunk: "⚠️ No documents found. Please upload a document (.pdf, .docx, .txt, or .md) to ask questions."
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const queryTerms = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

      const scoredChunks = candidateChunks.map(c => {
        const cosSim = cosineSimilarity(queryEmbedding, c.embedding);
        let keywordBoost = 0;
        if (queryTerms.length > 0 && c.content) {
          const lower = c.content.toLowerCase();
          let matches = 0;
          for (const term of queryTerms) {
            if (lower.includes(term)) matches++;
          }
          keywordBoost = (matches / queryTerms.length) * 0.25;
        }
        return {
          chunkIndex: c.chunkIndex,
          documentTitle: defaultDocTitle,
          documentId: c.document,
          content: c.content,
          pageNumber: c.pageNumber || 1,
          similarity: cosSim + keywordBoost
        };
      });

      scoredChunks.sort((a, b) => b.similarity - a.similarity);
      topChunks = scoredChunks.slice(0, 3);
    }

    // Filter relevant sources
    const relevantSources = topChunks.map(c => ({
      chunkIndex: c.chunkIndex,
      documentTitle: c.documentTitle,
      snippet: c.content.slice(0, 200) + (c.content.length > 200 ? '...' : ''),
      similarity: Math.round(c.similarity * 100),
      pageNumber: c.pageNumber
    }));

    // Emit sources metadata to client first
    res.write(`data: ${JSON.stringify({ type: 'sources', sources: relevantSources, retrievalMode: searchModeUsed })}\n\n`);

    // Step D: Construct Augmented Prompt with Grounded Context
    const contextBlock = topChunks.map((c, idx) =>
      `[Excerpt #${idx + 1} (Chunk ${c.chunkIndex})]:\n${c.content}`
    ).join('\n\n---\n\n');

    const systemPrompt = `You are the Talk-Sphere Direct Document Q&A Engine.
Your task is to give strictly direct, to-the-point, exact answers based ONLY on the provided document context.

ABSOLUTE RULES:
1. GIVE ONLY THE DIRECT ANSWER. ZERO CONVERSATIONAL FILLER.
   - NEVER start with: "Based on the provided document", "According to the document", "Based on excerpt", "The document states", "Here is the...", "The answer is...", etc.
   - NEVER include citation bullets, "Source Reference:", or footnote citations in your response text. Citations are handled separately by the system UI.
2. For specific data fields (e.g. candidate name, DOB / date of birth, roll number, email, phone, marks, date, college name, skills):
   - Output ONLY the exact value.
   - Examples:
     User: "please give me candidate name" -> Response: "Mr. Alex Morgan"
     User: "DOB of candidate" -> Response: "12/04/2002"
     User: "email id" -> Response: "alex.morgan@domain.com"
3. For explanations or list questions:
   - Provide only crisp, direct bullet points or 1-2 concise sentences without introduction or conclusion.
4. If the information is NOT present in the document:
   - Output ONLY: "Not found in document."`;

    const userAugmentedMessage = `DOCUMENT CONTEXT:
${contextBlock}

----------------------
USER QUESTION:
${question}`;

    // Step E: Stream generation using Gemini with verified fast model
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
            temperature: 0.0,
            maxOutputTokens: 250
          }
        });

        // Stream execution wrapped with Gemini Circuit Breaker & 8,000 ms timeout [B-16]
        const resultStream = await geminiBreaker.execute(async () => {
          return await chat.sendMessageStream(userAugmentedMessage);
        }, (err) => { throw err; });

        let preambleBuffer = '';
        let isFlushingPreamble = false;

        for await (const chunk of resultStream.stream) {
          const chunkText = chunk.text();
          if (!chunkText) continue;
          accumulatedText += chunkText;

          if (!isFlushingPreamble) {
            preambleBuffer += chunkText;
            if (
              preambleBuffer.length > 45 ||
              preambleBuffer.includes('\n') ||
              !/^(?:based|according|the\s+candidate)/i.test(preambleBuffer.trim())
            ) {
              isFlushingPreamble = true;
              const cleaned = cleanAnswerText(preambleBuffer);
              if (cleaned) {
                res.write(`data: ${JSON.stringify({ chunk: cleaned })}\n\n`);
              }
            }
          } else {
            if (!chunkText.toLowerCase().includes('source reference:')) {
              res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
            }
          }
        }

        if (!isFlushingPreamble && preambleBuffer) {
          const cleaned = cleanAnswerText(preambleBuffer);
          if (cleaned) {
            res.write(`data: ${JSON.stringify({ chunk: cleaned })}\n\n`);
          }
        }

        streamSuccess = true;
        verifiedChatModel = modelName;
        break;
      } catch (genErr) {
        lastError = genErr;
        logger.warn('RAG_STREAM_MODEL_FALLBACK', `Model ${modelName} failed: ${genErr.message}`);
        if (accumulatedText) break;
      }
    }

    if (!streamSuccess && !accumulatedText) {
      res.write(`data: ${JSON.stringify({
        chunk: `⚠️ *Generation Warning:* Could not complete generation. Error: ${lastError?.message || 'Gemini service busy'}`
      })}\n\n`);
    }

    // Step F: Persist Q&A turn with sources in AISession
    accumulatedText = cleanAnswerText(accumulatedText) || accumulatedText.trim();
    if (sessionId) {
      try {
        const sessionUpdate = {
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
        };

        await AISession.findByIdAndUpdate(sessionId, sessionUpdate, { new: true });
      } catch (sessionErr) {
        logger.warn('RAG_SESSION_UPDATE_ERROR', sessionErr.message || sessionErr);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error('RAG_STREAM_ERROR', error.message || error);
    res.write(`data: ${JSON.stringify({ error: `Internal query error: ${error.message}` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};
