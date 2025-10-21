import { PafCoreGrpcClient, HealthResponse } from './grpc-client';

export type ConnectionStrategy = 'grpc' | 'http' | 'auto';
export type ConnectionType = 'grpc' | 'http';

export interface ConnectionResult {
  type: ConnectionType;
  grpcClient?: PafCoreGrpcClient;
  httpUrl?: string;
  error?: string;
}

/**
 * Connection manager for PAF Core Agent
 * Implements connection strategy: try gRPC first, fallback to HTTP
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private grpcClient: PafCoreGrpcClient | null = null;
  private lastHealthCheck: { type: ConnectionType; timestamp: number; ok: boolean } | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
    this.startHealthCheckMonitoring();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Get PAF Core connection strategy from environment
   */
  private getStrategy(): ConnectionStrategy {
    const strategy = process.env.PAF_CORE_CONNECTION_STRATEGY?.toLowerCase();
    if (strategy === 'grpc' || strategy === 'http' || strategy === 'auto') {
      return strategy as ConnectionStrategy;
    }
    return 'auto'; // default
  }

  /**
   * Get or create gRPC client
   */
  private getGrpcClient(pafCoreUrl: string): PafCoreGrpcClient {
    if (!this.grpcClient) {
      this.grpcClient = new PafCoreGrpcClient(pafCoreUrl);
    }
    return this.grpcClient;
  }

  /**
   * Test gRPC connection health
   */
  private async testGrpcConnection(pafCoreUrl: string): Promise<boolean> {
    try {
      const client = this.getGrpcClient(pafCoreUrl);
      const health = await client.health();
      console.log(`✅ gRPC health check passed: ${health.message}`);
      return health.ok;
    } catch (error: any) {
      console.warn(`⚠️ gRPC health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get connection based on strategy
   * Returns connection type and client/URL
   */
  async getConnection(pafCoreUrl: string): Promise<ConnectionResult> {
    const strategy = this.getStrategy();

    console.log(`🔍 Connection strategy: ${strategy}`);

    // Strategy: Force HTTP only
    if (strategy === 'http') {
      console.log('📡 Using HTTP connection (forced by strategy)');
      return {
        type: 'http',
        httpUrl: pafCoreUrl
      };
    }

    // Strategy: Force gRPC only
    if (strategy === 'grpc') {
      console.log('📡 Using gRPC connection (forced by strategy)');
      try {
        const client = this.getGrpcClient(pafCoreUrl);
        return {
          type: 'grpc',
          grpcClient: client
        };
      } catch (error: any) {
        return {
          type: 'grpc',
          error: `gRPC connection failed: ${error.message}`
        };
      }
    }

    // Strategy: Auto (try gRPC first, fallback to HTTP)
    console.log('🔄 Auto mode: Trying gRPC first...');

    try {
      const grpcHealthy = await this.testGrpcConnection(pafCoreUrl);

      if (grpcHealthy) {
        console.log('✅ gRPC connection successful');
        this.lastHealthCheck = {
          type: 'grpc',
          timestamp: Date.now(),
          ok: true
        };
        return {
          type: 'grpc',
          grpcClient: this.grpcClient!
        };
      } else {
        throw new Error('gRPC health check failed');
      }
    } catch (error: any) {
      console.warn(`⚠️ gRPC connection failed: ${error.message}`);
      console.log('🔄 Falling back to HTTP connection');

      this.lastHealthCheck = {
        type: 'http',
        timestamp: Date.now(),
        ok: true
      };

      return {
        type: 'http',
        httpUrl: pafCoreUrl,
        error: `gRPC failed, using HTTP fallback: ${error.message}`
      };
    }
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck() {
    return this.lastHealthCheck;
  }

  /**
   * Start periodic health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      if (this.lastHealthCheck && Date.now() - this.lastHealthCheck.timestamp > 60000) {
        console.log('ℹ️ Health check data is stale (>60s old)');
      }
    }, 30000);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.grpcClient) {
      this.grpcClient.close();
      this.grpcClient = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();
