/**
 * Farroway Intelligence Module — Role-Based Access Guards
 *
 * Express middleware that restricts routes to users with specific roles.
 * Must run after the `authenticate` middleware which sets `req.user`.
 */
import type { Request, Response, NextFunction } from 'express';
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireStaff(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=roles.guard.d.ts.map