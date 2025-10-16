"use client";

import { useMutation } from "@tanstack/react-query";
import { AuthClientService } from "@/lib/auth/client-service";

export type AuthProvider = "google" | "email" | "signup";

interface AuthMutationResult {
  success: boolean;
  error?: string;
}

interface AuthData {
  email?: string;
  password?: string;
  name?: string;
  // Add other fields for other providers as needed
}

/**
 * Unified Firebase Auth hook supporting multiple providers
 */
export const useFirebaseAuth = () => {
  return useMutation<
    AuthMutationResult,
    Error,
    { provider: AuthProvider; data?: AuthData }
  >({
    mutationFn: async ({ provider, data }): Promise<AuthMutationResult> => {
      try {
        switch (provider) {
          case "google":
            return await AuthClientService.signInWithGoogle();
          case "email":
            // Email/password authentication
            if (!data?.email || !data?.password) {
              return { success: false, error: "Email and password required" };
            }
            return await AuthClientService.signInWithEmail(
              data.email,
              data.password,
            );
          case "signup":
            // Email/password signup
            if (!data?.email || !data?.password) {
              return { success: false, error: "Email and password required" };
            }
            if (!data?.name) {
              return { success: false, error: "Name is required for signup" };
            }
            return await AuthClientService.signUpWithEmail(
              data.email,
              data.password,
              data.name,
            );
          default:
            return {
              success: false,
              error: `Provider '${provider}' not supported`,
            };
        }
      } catch (error) {
        console.error(`Authentication error for provider ${provider}:`, error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Authentication failed",
        };
      }
    },
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors
      if (failureCount < 2 && error.message.includes("network")) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    onError: (error, variables) => {
      console.error(`${variables.provider} authentication failed:`, error);
      // You can add toast notifications here if needed
    },
  });
};
