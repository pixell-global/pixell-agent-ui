import * as grpc from '@grpc/grpc-js';

/**
 * PathPrefixInterceptor prepends a path prefix to all gRPC method calls.
 * This is used for A2A (Agent-to-Agent) routing through an ALB.
 *
 * Example transformation:
 *   Original:  /pixell.agent.AgentService/Health
 *   Rewritten: /agents/4906eeb7-9959-414e-84c6-f2445822ebe4/a2a/pixell.agent.AgentService/Health
 *
 * Based on the Python implementation in talk_to_agent.py
 */
export function createPathPrefixInterceptor(pathPrefix: string): grpc.Interceptor {
  // Remove trailing slash if present
  const prefix = pathPrefix.replace(/\/$/, '');
  console.log(`🔧 PathPrefixInterceptor initialized with prefix: ${prefix}`);

  return (options: grpc.InterceptorOptions, nextCall: any) => {
    // Get the original method path
    const originalPath = options.method_definition.path;

    // Create new path with prefix
    const newPath = `${prefix}${originalPath}`;

    console.log(`🔀 gRPC path rewrite: ${originalPath} → ${newPath}`);

    // Create new options with modified path
    const newOptions: grpc.InterceptorOptions = {
      ...options,
      method_definition: {
        ...options.method_definition,
        path: newPath
      }
    };

    // Pass modified options to next call
    return new grpc.InterceptingCall(nextCall(newOptions), new grpc.RequesterBuilder().build());
  };
}
