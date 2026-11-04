import type { Request, Response, NextFunction } from "express";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();

  console.log(
    `[API REQUEST] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  res.on("finish", () => {
    const duration = Date.now() - startTime;

    const log = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    };

    if (res.statusCode >= 500) {
      console.error("[API RESPONSE ERROR]", log);
    } else if (res.statusCode >= 400) {
      console.warn("[API RESPONSE WARNING]", log);
    } else {
      console.log("[API RESPONSE SUCCESS]", log);
    }
  });

  next();
}