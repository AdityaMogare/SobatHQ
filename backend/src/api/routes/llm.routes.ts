import { Router } from 'express';
import { getAppContext } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';

export const llmRouter = Router();

const requireAuth = (req: Parameters<ReturnType<typeof createAuthMiddleware>>[0], res: Parameters<ReturnType<typeof createAuthMiddleware>>[1], next: Parameters<ReturnType<typeof createAuthMiddleware>>[2]) => {
  const { sessions, apiKeys } = getAppContext();
  return createAuthMiddleware(sessions, apiKeys)(req, res, next);
};

llmRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const { qwen } = getAppContext();
    successResponse(res, {
      provider: 'qwen',
      configured: qwen.isConfigured(),
      model: process.env.QWEN_MODEL ?? 'qwen-plus',
      reasoningEnabled: process.env.QWEN_ENABLE_REASONING !== 'false',
    });
  }),
);

llmRouter.post(
  '/chat',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { qwen } = getAppContext();
    const { messages, systemPrompt, enableThinking } = req.body as {
      messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      prompt?: string;
      systemPrompt?: string;
      enableThinking?: boolean;
    };

    if (!qwen.isConfigured()) {
      res.status(503).json({ success: false, error: 'Qwen API not configured. Set QWEN_API_KEY.' });
      return;
    }

    let result;
    if (messages?.length) {
      const allMessages = systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
        : messages;
      result = await qwen.chat(allMessages, { enable_thinking: enableThinking });
    } else if (req.body.prompt) {
      result = await qwen.reason(req.body.prompt, systemPrompt);
    } else {
      res.status(400).json({ success: false, error: 'messages or prompt is required' });
      return;
    }

    successResponse(res, result);
  }),
);

llmRouter.post(
  '/reason',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { qwen } = getAppContext();
    const { prompt, systemPrompt } = req.body as { prompt: string; systemPrompt?: string };

    if (!prompt) {
      res.status(400).json({ success: false, error: 'prompt is required' });
      return;
    }

    if (!qwen.isConfigured()) {
      res.status(503).json({ success: false, error: 'Qwen API not configured. Set QWEN_API_KEY.' });
      return;
    }

    const result = await qwen.reason(prompt, systemPrompt);
    successResponse(res, result);
  }),
);
