import { Router } from 'express';
import { getAppContext, emitWsEvent } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';

export const approvalsRouter = Router();

approvalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const { approvalService } = getAppContext();
    const approvals = await approvalService.listPending(userId);
    successResponse(res, approvals);
  }),
);

approvalsRouter.get(
  '/:approvalId',
  asyncHandler(async (req, res) => {
    const { approvalService } = getAppContext();
    const approval = await approvalService.get(String(req.params.approvalId));

    if (!approval) {
      res.status(404).json({ success: false, error: 'Approval not found' });
      return;
    }

    successResponse(res, approval);
  }),
);

approvalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { approvalService } = getAppContext();
    const approval = await approvalService.create(req.body);
    emitWsEvent('approval:new', approval);
    successResponse(res, approval, 201);
  }),
);

approvalsRouter.post(
  '/:approvalId/approve',
  asyncHandler(async (req, res) => {
    const { resolvedBy = 'user' } = req.body;
    const { approvalService } = getAppContext();
    const approval = await approvalService.resolve(String(req.params.approvalId), 'approved', resolvedBy);

    if (!approval) {
      res.status(404).json({ success: false, error: 'Approval not found or already resolved' });
      return;
    }

    emitWsEvent('approval:resolved', approval);
    successResponse(res, approval);
  }),
);

approvalsRouter.post(
  '/:approvalId/reject',
  asyncHandler(async (req, res) => {
    const { resolvedBy = 'user' } = req.body;
    const { approvalService } = getAppContext();
    const approval = await approvalService.resolve(String(req.params.approvalId), 'rejected', resolvedBy);

    if (!approval) {
      res.status(404).json({ success: false, error: 'Approval not found or already resolved' });
      return;
    }

    emitWsEvent('approval:resolved', approval);
    successResponse(res, approval);
  }),
);
