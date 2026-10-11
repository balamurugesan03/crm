import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/token.js';
import User from '../models/User.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    path: '/api/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      const payload = verifyAccessToken(socket.handshake.auth?.token);
      const user = await User.findById(payload.sub).select('organization isActive');
      if (!user || !user.isActive) return next(new Error('Not authenticated'));
      socket.data.userId = String(user._id);
      socket.data.orgId = String(user.organization);
      return next();
    } catch {
      return next(new Error('Not authenticated'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.join(`org:${socket.data.orgId}`);
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToOrg(orgId, event, payload) {
  io?.to(`org:${orgId}`).emit(event, payload);
}
