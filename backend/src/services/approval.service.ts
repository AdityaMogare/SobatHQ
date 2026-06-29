import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import type { ApprovalAction, ApprovalRequest, ApprovalStatus } from '../types/index.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';

const log = createChildLogger('services:approvals');

export class ApprovalService {
  constructor(private store: MemoryStore) {}

  private key(approvalId: string): string {
    return buildKey(MemoryNamespaces.APPROVAL, approvalId);
  }

  async create(params: {
    userId: string;
    taskId: string;
    action: ApprovalAction;
    title: string;
    description: string;
    preview: Record<string, unknown>;
  }): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = {
      id: uuidv4(),
      userId: params.userId,
      taskId: params.taskId,
      action: params.action,
      title: params.title,
      description: params.description,
      preview: params.preview,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.store.set(this.key(approval.id), approval);
    log.info({ approvalId: approval.id, action: params.action }, 'Approval request created');
    return approval;
  }

  async get(approvalId: string): Promise<ApprovalRequest | null> {
    return this.store.get<ApprovalRequest>(this.key(approvalId));
  }

  async resolve(
    approvalId: string,
    status: Extract<ApprovalStatus, 'approved' | 'rejected'>,
    resolvedBy: string,
  ): Promise<ApprovalRequest | null> {
    const approval = await this.get(approvalId);
    if (!approval || approval.status !== 'pending') return null;

    approval.status = status;
    approval.resolvedAt = new Date().toISOString();
    approval.resolvedBy = resolvedBy;

    await this.store.set(this.key(approvalId), approval);
    log.info({ approvalId, status }, 'Approval resolved');
    return approval;
  }

  async listPending(userId: string): Promise<ApprovalRequest[]> {
    const pattern = buildKey(MemoryNamespaces.APPROVAL, '*');
    const keys = await this.store.keys(pattern);
    const approvals = await this.store.mget<ApprovalRequest>(keys);

    return approvals
      .filter((a): a is ApprovalRequest => a !== null && a.userId === userId && a.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
