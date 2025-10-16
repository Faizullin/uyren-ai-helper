import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";

function getTRPCCode(statusCode: number): TRPCError["code"] {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 429:
      return "TOO_MANY_REQUESTS";
    case 500:
      return "INTERNAL_SERVER_ERROR";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

// Base exception class for API errors
export class APIException extends TRPCError {
  constructor(
    message: string,
    code: string = "INTERNAL_SERVER_ERROR",
    statusCode: number = 500,
    details?: Record<string, any>,
  ) {
    super({
      message,
      code: getTRPCCode(statusCode),
      cause: details,
    });
    // this.code = code;
    // this.statusCode = statusCode;
    // this.details = details;
  }

  // toTRPCError(): TRPCError {
  //   return new TRPCError({
  //     code: this.getTRPCCode(),
  //     message: this.message,
  //     cause: this,
  //   });
  // }
}

// Specific exception types
export class ValidationException extends APIException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationException";
  }

  // Helper to create field-specific validation errors
  static withFields(errors: Array<{ field: string; message: string }>) {
    return new ValidationException("Validation failed", { errors });
  }
}

export class AuthenticationException extends APIException {
  constructor(message: string = "Authentication required") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationException";
  }
}

export class AuthorizationException extends APIException {
  constructor(message: string = "Insufficient permissions") {
    super(message, "AUTHORIZATION_ERROR", 403);
    this.name = "AuthorizationException";
  }
}

export class NotFoundException extends APIException {
  constructor(resource: string, id?: string | number | mongoose.Types.ObjectId) {
    if (id instanceof mongoose.Types.ObjectId) {
      id = id.toString();
    }
    const message = id
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, "NOT_FOUND_ERROR", 404);
    this.name = "NotFoundException";
  }
}

export class ConflictException extends APIException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "CONFLICT_ERROR", 409, details);
    this.name = "ConflictException";
  }
}

export class ResourceExistsException extends ConflictException {
  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`);
    this.name = "ResourceExistsException";
  }
}

export class DatabaseException extends APIException {
  constructor(
    message: string = "Database operation failed",
    details?: Record<string, any>,
  ) {
    super(message, "DATABASE_ERROR", 500, details);
    this.name = "DatabaseException";
  }
}

export class ExternalServiceException extends APIException {
  constructor(service: string, message: string, details?: Record<string, any>) {
    super(
      `External service error (${service}): ${message}`,
      "EXTERNAL_SERVICE_ERROR",
      502,
      details,
    );
    this.name = "ExternalServiceException";
  }
}
