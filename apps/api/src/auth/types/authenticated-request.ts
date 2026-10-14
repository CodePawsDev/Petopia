import type { Request } from 'express';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthenticatedRequest extends Request {
  currentUser?: SessionUser;
}
