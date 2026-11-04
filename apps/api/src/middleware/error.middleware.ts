import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const err = error instanceof Error
    ? error
    : new Error(String(error));

  console.error("\n========== API ERROR ==========");
  console.error("Time:", new Date().toISOString());
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);
  console.error("================================\n");

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}