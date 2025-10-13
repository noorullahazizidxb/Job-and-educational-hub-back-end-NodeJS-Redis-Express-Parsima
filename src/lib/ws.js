import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';

let io = null;

export function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET','POST','PATCH','DELETE'] },
  });

  io.use((socket, next) => {
    // Support auth via: query.token or auth.token header
    const token = socket.handshake?.auth?.token || socket.handshake?.query?.token || socket.handshake?.headers?.authorization?.split(' ').pop();
    if (!token) return next(); // allow anonymous, but they won't join user rooms
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
      // Join personal and company rooms
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

export function notifyUserInbox(userId, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('inbox:update', payload);
}

export function notifyCompanyInbox(companyId, payload) {
  if (!io) return;
  io.to(`company:${companyId}`).emit('inbox:update', payload);
}
