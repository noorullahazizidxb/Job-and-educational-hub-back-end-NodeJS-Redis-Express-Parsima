import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { socketEnabled, corsOrigins } from './runtime.js';

let io = null;

export function initWebSocket(httpServer) {
  if (!socketEnabled) return null;

  const origin = corsOrigins();
  io = new Server(httpServer, {
    cors: { origin: origin === true ? '*' : origin, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
    path: process.env.SOCKET_IO_PATH || '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token || socket.handshake?.query?.token || socket.handshake?.headers?.authorization?.split(' ').pop();
    if (!token) return next();
    try {
      const decoded = verifyToken(String(token));
      socket.user = { ...decoded, id: decoded.sub ?? decoded.id, sub: decoded.sub ?? decoded.id };
    } catch {
      // ignore invalid tokens; proceed as anonymous
    }
    return next();
  });

  io.on('connection', (socket) => {
    const u = socket.user;
    if (u?.id) {
      socket.join(`user:${u.id}`);
      if (u.companyId) socket.join(`company:${u.companyId}`);
    }
    socket.on('subscribe:inbox', () => {
      if (u?.id) {
        socket.join(`user:${u.id}`);
        if (u.companyId) socket.join(`company:${u.companyId}`);
      }
    });
  });

  return io;
}

export function getIO() { return io; }

/** Disconnect all sockets and close the Socket.IO server (and its HTTP server). */
export function closeWebSocket() {
  if (!io) return Promise.resolve();
  return new Promise((resolve) => io.close(() => resolve()));
}

export function notifyUserInbox(userId, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('inbox:update', payload);
}

export function notifyCompanyInbox(companyId, payload) {
  if (!io) return;
  io.to(`company:${companyId}`).emit('inbox:update', payload);
}
