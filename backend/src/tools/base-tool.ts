import type {
  ToolContext,
  ToolDefinition,
  ToolName,
  ToolResult,
} from '../types/index.js';

export abstract class BaseTool {
  abstract readonly definition: ToolDefinition;

  abstract execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult>;

  get name(): ToolName {
    return this.definition.name;
  }

  supportsAction(action: string): boolean {
    return this.definition.actions.includes(action);
  }

  protected notConfigured(): ToolResult {
    return {
      success: false,
      error: `${this.definition.displayName} is not connected. Please authorize via OAuth.`,
    };
  }
}

export interface ToolActionParams {
  [action: string]: Record<string, unknown>;
}
