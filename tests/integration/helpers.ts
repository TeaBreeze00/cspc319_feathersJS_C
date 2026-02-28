import { ToolResponse } from '../../src/routing/types';
import { MockTransport } from '../helpers/mockTransport';
import { getIntegrationServer } from './setup';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

let requestId = 1;

function mapToolErrorCode(code?: string): number {
  if (code === 'INVALID_PARAMS') return -32602;
  if (code === 'TIMEOUT') return -32001;
  if (code === 'INTERNAL_ERROR') return -32000;
  return -32000;
}

async function routeCall(params: Record<string, unknown> | undefined): Promise<ToolResponse> {
  const { router } = getIntegrationServer();
  const name = params?.name;
  const args = params?.arguments;

  if (typeof name !== 'string' || name.length === 0) {
    return {
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'Missing tool name' },
    };
  }

  return router.route({
    toolName: name,
    params: args,
  });
}

async function dispatch(transport: MockTransport, rawRequest: string): Promise<void> {
  let request: JsonRpcRequest;

  try {
    request = JSON.parse(rawRequest) as JsonRpcRequest;
  } catch (error) {
    transport.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      } satisfies JsonRpcResponse)
    );
    return;
  }

  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    transport.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request?.id ?? null,
        error: { code: -32600, message: 'Invalid Request' },
      } satisfies JsonRpcResponse)
    );
    return;
  }

  if (request.method === 'tools/list') {
    const { protocolRegistry } = getIntegrationServer();
    transport.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: protocolRegistry.getTools() },
      } satisfies JsonRpcResponse)
    );
    return;
  }

  if (request.method === 'tools/call') {
    const routed = await routeCall(request.params);
    if (routed.success) {
      transport.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: routed.data,
        } satisfies JsonRpcResponse)
      );
      return;
    }

    const toolError = routed.error;
    const baseCode = mapToolErrorCode(toolError?.code);
    const code = toolError?.message?.startsWith('Unknown tool: ') ? -32601 : baseCode;
    transport.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code,
          message: toolError?.message ?? 'Tool execution failed',
          data: toolError,
        },
      } satisfies JsonRpcResponse)
    );
    return;
  }

  transport.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: `Method not found: ${request.method}` },
    } satisfies JsonRpcResponse)
  );
}

export async function sendRawMcpRequest(rawRequest: string): Promise<JsonRpcResponse> {
  const { transport } = getIntegrationServer();

  transport.send(rawRequest);
  const received = await transport.receive();
  await dispatch(transport, received);
  const rawResponse = await transport.receive();
  return JSON.parse(rawResponse) as JsonRpcResponse;
}

export async function sendMcpRequest(
  method: string,
  params: Record<string, unknown> = {}
): Promise<JsonRpcResponse> {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params,
  };

  return sendRawMcpRequest(JSON.stringify(request));
}

export function expectMcpResponse(response: JsonRpcResponse, matcher: Record<string, unknown>): void {
  expect(response).toMatchObject({
    jsonrpc: '2.0',
    ...matcher,
  });
}
