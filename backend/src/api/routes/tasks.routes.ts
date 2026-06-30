import { Router } from 'express';
import { getAppContext, emitWsEvent } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import type { TaskStatus } from '../../types/index.js';

export const tasksRouter = Router();

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.query.userId as string;
    const status = req.query.status as TaskStatus | undefined;

    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const { taskService } = getAppContext();
    const tasks = await taskService.listByUser(userId, status);
    successResponse(res, tasks);
  }),
);

tasksRouter.get(
  '/:taskId',
  asyncHandler(async (req, res) => {
    const { taskService } = getAppContext();
    const task = await taskService.get(String(req.params.taskId));

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    successResponse(res, task);
  }),
);

tasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { taskService } = getAppContext();
    const task = await taskService.create(req.body);
    emitWsEvent('task:updated', task);
    successResponse(res, task, 201);
  }),
);

tasksRouter.patch(
  '/:taskId/status',
  asyncHandler(async (req, res) => {
    const { status, result, error } = req.body;
    const { taskService } = getAppContext();
    const task = await taskService.updateStatus(String(req.params.taskId), status, result, error);

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    emitWsEvent('task:updated', task);
    successResponse(res, task);
  }),
);
