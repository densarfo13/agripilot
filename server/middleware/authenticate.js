import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';

export function authenticate(req, res, next) {
  try {
    const token = req.cookies?.access_token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email,
      emailVerified: !!payload.emailVerified,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
}
