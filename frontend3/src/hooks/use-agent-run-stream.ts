import { useEffect, useRef, useState, useCallback } from 'react';
import { createSseClient } from '@/client/core/serverSentEvents.gen';

/**
 * Stream log entry received from the agent run stream
 */
interface StreamLogEntry {
  type: string;
  message?: string;
  status?: string;
  timestamp?: string;
  level?: string;
  [key: string]: any;
}

/**
 * Options for the agent run stream hook
 */
interface UseAgentRunStreamOptions {
  enabled?: boolean;
  onLog?: (log: StreamLogEntry) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

/**
 * Optimized hook for streaming agent run logs via Server-Sent Events (SSE)
 * 
 * This version uses the OpenAPI client's built-in SSE capabilities to reduce
 * code complexity and improve maintainability.
 * 
 * @param runId - The agent run ID to stream logs for
 * @param options - Configuration options for the stream
 * @returns Stream state and control functions
 */
export function useAgentRunStream(
  runId: string | null,
  options: UseAgentRunStreamOptions = {}
) {
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { enabled = true, onLog, onStatusChange, onError } = options;

  const connect = useCallback(async () => {
    if (!runId || !enabled) return;

    // Close existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create abort controller for this connection
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Use OpenAPI client's SSE functionality
      const sseClient = createSseClient<StreamLogEntry>({
        url: `/api/v1/agent-run/${runId}/stream`,
        signal: abortController.signal,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        onSseEvent: (event) => {
          const data = event.data as StreamLogEntry;
          
          // Add timestamp if not present
          if (!data.timestamp) {
            data.timestamp = new Date().toISOString();
          }

          // Add to logs
          setLogs(prev => [...prev, data]);

          // Call custom handlers
          onLog?.(data);

          // Handle status changes
          if (data.type === 'status' && data.status) {
            onStatusChange?.(data.status);
            
            // Auto-disconnect on completion
            if (['completed', 'failed', 'stopped', 'error'].includes(data.status)) {
              console.log(`Agent run ${runId} finished with status: ${data.status}`);
              abortController.abort();
              setIsConnected(false);
              return;
            }
          }

          // Handle log messages
          if (data.type === 'log' || data.message) {
            console.log(`Agent run ${runId} log:`, data.message || data);
          }
        },
        onSseError: (err) => {
          console.error(`SSE connection error for agent run ${runId}:`, err);
          const errorMsg = err instanceof Error ? err.message : 'Connection error';
          setError(errorMsg);
          setIsConnected(false);
          onError?.(errorMsg);
        },
        sseMaxRetryAttempts: 3,
        sseDefaultRetryDelay: 3000,
      });

      setIsConnected(true);
      setError(null);

      // Start consuming the stream
      const stream = sseClient.stream;
      for await (const data of stream) {
        // Stream is handled by onSseEvent callback
        // This loop just keeps the stream alive
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`SSE connection aborted for agent run ${runId}`);
      } else {
        console.error(`SSE connection error for agent run ${runId}:`, err);
        const errorMsg = err.message || 'Connection error';
        setError(errorMsg);
        setIsConnected(false);
        onError?.(errorMsg);
      }
    }
  }, [runId, enabled, onLog, onStatusChange, onError]);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Auto-connect when runId changes
  useEffect(() => {
    if (runId && enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [runId, enabled, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    logs,
    isConnected,
    error,
    connect,
    disconnect,
    clearLogs,
  };
}
