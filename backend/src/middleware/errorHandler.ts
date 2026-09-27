import { Request, Response, NextFunction } from "express";

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 404 handler — catches unmatched routes.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

/**
 * Centralized error handler — all errors flow through here.
 */
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isSafeApplicationError = err instanceof AppError && err.isOperational;
  const statusCode = isSafeApplicationError ? err.statusCode : 500;
  const message = isSafeApplicationError ? err.message : "Internal Server Error";

  console.error(JSON.stringify({
    event: "http.request.failed",
    statusCode,
    error: isSafeApplicationError ? err.message : err.name,
  }));

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
  });
};
