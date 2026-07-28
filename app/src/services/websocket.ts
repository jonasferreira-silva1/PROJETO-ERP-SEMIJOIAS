import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

// Instância única (Singleton) do socket para evitar conexões duplicadas
let socket: Socket | null = null;

// Inicializa ou atualiza a conexão Socket.io enviando o token JWT via handshake auth
export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io(API_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,            // Habilita reconexão automática
      reconnectionAttempts: Infinity, // Tenta reconectar indefinidamente
      reconnectionDelay: 1000,        // Intervalo entre as tentativas
    });
  } else {
    // Se o token mudar (ex: relogin), atualiza os dados de autenticação
    socket.auth = { token };
  }
  return socket;
};

// Encerra a conexão e zera a instância do socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
