export interface AuthError {
  code: string;
  message: string;
  userMessage: string;
}

/**
 * Maps Firebase authentication error codes to user-friendly messages
 * with i18next translation keys
 */
export const getFirebaseErrorMessage = (errorCode: string): AuthError => {
  const errorMap: Record<string, AuthError> = {
    // Essential Firebase Auth Errors only
    "auth/invalid-email": {
      code: "auth/invalid-email",
      message: "The email address is badly formatted.",
      userMessage: "validation:auth.error.invalid_email",
    },
    "auth/user-not-found": {
      code: "auth/user-not-found",
      message: "There is no user record corresponding to this identifier.",
      userMessage: "validation:auth.error.user_not_found",
    },
    "auth/wrong-password": {
      code: "auth/wrong-password",
      message: "The password is invalid or the user does not have a password.",
      userMessage: "validation:auth.error.wrong_password",
    },
    "auth/invalid-credential": {
      code: "auth/invalid-credential",
      message: "The credential is invalid or has expired.",
      userMessage: "validation:auth.error.invalid_credential",
    },
    "auth/email-already-in-use": {
      code: "auth/email-already-in-use",
      message: "The email address is already in use by another account.",
      userMessage: "validation:auth.error.email_already_in_use",
    },
    "auth/weak-password": {
      code: "auth/weak-password",
      message: "The password is too weak.",
      userMessage: "validation:auth.error.weak_password",
    },
    "auth/too-many-requests": {
      code: "auth/too-many-requests",
      message: "Too many requests. Try again later.",
      userMessage: "validation:auth.error.too_many_requests",
    },
    "auth/network-request-failed": {
      code: "auth/network-request-failed",
      message: "Network error. Please check your connection.",
      userMessage: "validation:auth.error.network_error",
    },
    "auth/popup-blocked": {
      code: "auth/popup-blocked",
      message: "Sign-in popup was blocked by the browser.",
      userMessage: "validation:auth.error.popup_blocked",
    },
  };

  // Return the mapped error or a default error
  return (
    errorMap[errorCode] || {
      code: errorCode,
      message: "An unknown error occurred.",
      userMessage: "auth.error.unknown",
    }
  );
};

/**
 * Extracts Firebase error code from error message or error object
 */
export const extractFirebaseErrorCode = (error: any): string => {
  if (typeof error === "string") {
    // Check if it's a Firebase error code
    if (error.startsWith("auth/")) {
      return error;
    }
    // Try to extract error code from message
    const match = error.match(/auth\/[a-z-]+/);
    return match ? match[0] : "auth/unknown";
  }

  if (error?.code && typeof error.code === "string") {
    return error.code;
  }

  if (error?.message && typeof error.message === "string") {
    const match = error.message.match(/auth\/[a-z-]+/);
    return match ? match[0] : "auth/unknown";
  }

  return "auth/unknown";
};

/**
 * Gets user-friendly error message for display
 */
export const getUserFriendlyErrorMessage = (error: any): string => {
  const errorCode = extractFirebaseErrorCode(error);
  const authError = getFirebaseErrorMessage(errorCode);
  return authError.userMessage;
};
