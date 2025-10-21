import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { URL } from 'url';

/**
 * PathAwareChannel extends grpc.Channel to support path prefix for ALB routing
 * Based on solution from: https://github.com/grpc/grpc-node/issues/980
 */
class PathAwareChannel extends grpc.Channel {
  private pathPrefix: string;

  constructor(target: string, credentials: grpc.ChannelCredentials, options: grpc.ChannelOptions, pathPrefix: string = '') {
    super(target, credentials, options);
    this.pathPrefix = pathPrefix;
    if (pathPrefix) {
      console.log(`📍 PathAwareChannel initialized with prefix: ${pathPrefix}`);
    }
  }

  createCall(method: string, deadline: grpc.Deadline | null | undefined, host: string | null | undefined, parentCall: grpc.Call | null | undefined, propagateFlags: number | null | undefined): grpc.Call {
    const fullPath = this.pathPrefix ? `${this.pathPrefix}${method}` : method;
    if (this.pathPrefix) {
      console.log(`🔀 Channel.createCall: ${method} → ${fullPath}`);
    }
    return super.createCall(fullPath, deadline, host, parentCall, propagateFlags);
  }
}

export interface HealthResponse {
  ok: boolean;
  message: string;
  timestamp: number;
}

export interface ActionResult {
  success: boolean;
  result: string;
  error?: string;
  request_id: string;
  duration_ms: number;
  metadata?: Record<string, string>;
}

export interface GrpcConnectionConfig {
  host: string;
  port: number;
  useTLS: boolean;
}

/**
 * Parse PAF Core Agent URL to extract gRPC connection details
 * Examples:
 *   http://localhost:8000 → { host: 'localhost', port: 8000, useTLS: false }
 *   http://host.com → { host: 'host.com', port: 80, useTLS: false }
 *   https://host.com → { host: 'host.com', port: 443, useTLS: true }
 */
export function parseUrlForGrpc(url: string): GrpcConnectionConfig {
  const parsed = new URL(url);

  const host = parsed.hostname;
  const useTLS = parsed.protocol === 'https:';

  // Extract port or use default based on protocol
  let port: number;
  if (parsed.port) {
    port = parseInt(parsed.port, 10);
  } else {
    port = useTLS ? 443 : 80;
  }

  return { host, port, useTLS };
}

/**
 * gRPC client for PAF Core Agent A2A communication
 * Implements the AgentService proto definition
 */
export class PafCoreGrpcClient {
  private client: any;
  private serviceDefinition: any;

  constructor(pafCoreUrl: string, agentAppId?: string | null) {
    // Parse URL to get connection config
    const config = parseUrlForGrpc(pafCoreUrl);
    const target = `${config.host}:${config.port}`;

    console.log(`🔗 Initializing gRPC client: ${target} (TLS: ${config.useTLS})`);
    if (agentAppId) {
      console.log(`📍 Agent App ID for A2A routing: ${agentAppId}`);
    }

    // Load proto definition
    const PROTO_PATH = path.join(__dirname, '../../proto/agent.proto');
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
    this.serviceDefinition = protoDescriptor.pixell.agent.AgentService;

    // Create credentials
    const credentials = config.useTLS
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    // Create channel options
    const channelOptions: grpc.ChannelOptions = {
      // DNS resolver: use native for better compatibility
      'grpc.dns_resolver': 'native',
      // SSL target name override for proper TLS handshake
      'grpc.ssl_target_name_override': config.host,
      // Default authority for gRPC requests
      'grpc.default_authority': config.host
    };

    // Build path prefix for A2A routing
    const pathPrefix = agentAppId ? `/agents/${agentAppId}/a2a` : '';

    // Create custom channel with path prefix support
    const channel = new PathAwareChannel(target, credentials, channelOptions, pathPrefix);

    // Create client options with channel override
    const clientOptions = {
      channelOverride: channel
    };

    // Create client with custom channel via channelOverride
    this.client = new this.serviceDefinition(target, credentials, clientOptions);
  }

  /**
   * Health check - calls Health RPC
   */
  async health(): Promise<HealthResponse> {
    return new Promise((resolve, reject) => {
      this.client.Health({}, (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            ok: response.ok,
            message: response.message,
            timestamp: parseInt(response.timestamp, 10)
          });
        }
      });
    });
  }

  /**
   * Invoke action - calls Invoke RPC
   */
  async invoke(
    action: string,
    parameters: Record<string, any>
  ): Promise<ActionResult> {
    return new Promise((resolve, reject) => {
      // Convert parameters to string map (protobuf requirement)
      const stringParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(parameters)) {
        stringParams[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }

      const request = {
        action,
        parameters: stringParams,
        request_id: '' // Will be generated by agent if empty
      };

      this.client.Invoke(request, (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            success: response.success,
            result: response.result,
            error: response.error || undefined,
            request_id: response.request_id,
            duration_ms: parseInt(response.duration_ms, 10),
            metadata: response.metadata ? Object.fromEntries(
              Object.entries(response.metadata)
            ) : undefined
          });
        }
      });
    });
  }

  /**
   * Get capabilities - calls DescribeCapabilities RPC
   */
  async getCapabilities(): Promise<{ methods: string[]; metadata: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      this.client.DescribeCapabilities({}, (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            methods: response.methods || [],
            metadata: response.metadata ? Object.fromEntries(
              Object.entries(response.metadata)
            ) : {}
          });
        }
      });
    });
  }

  /**
   * Close the gRPC connection
   */
  close(): void {
    if (this.client) {
      grpc.closeClient(this.client);
    }
  }
}
