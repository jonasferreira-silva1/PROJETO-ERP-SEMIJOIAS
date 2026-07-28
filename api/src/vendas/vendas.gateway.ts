import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VendasGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  // Executado sempre que um cliente tenta conectar ou reconectar
  async handleConnection(client: Socket) {
    try {
      // Recupera o token JWT do objeto 'auth' do handshake (seguro, fora da query string)
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        console.log('[Socket] Conexão rejeitada: Nenhum token fornecido');
        client.disconnect();
        return;
      }

      // Valida o token recebido
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'super-secret-key-adorne-semijoias',
      });

      // Vincula os metadados do inquilino ao socket do cliente
      client.data = {
        userId: payload.sub,
        lojaId: payload.lojaId,
        role: payload.role,
      };

      // Associa a conexão à sala exclusiva da loja (Multi-Tenant)
      // Garante reconexão automática e reinserção na sala correspondente
      const roomName = `loja_${payload.lojaId}`;
      await client.join(roomName);

      console.log(`[Socket] Usuário ${payload.sub} conectado e associado à sala ${roomName} (Socket ID: ${client.id})`);
    } catch (error) {
      console.log('[Socket] Conexão rejeitada: Token inválido ou expirado -', error.message);
      client.disconnect();
    }
  }

  // Executado ao desconectar o socket
  handleDisconnect(client: Socket) {
    console.log(`[Socket] Conexão encerrada: ${client.id}`);
  }

  // Dispara o evento de nova venda apenas para os membros conectados na sala daquela loja
  emitNewVenda(lojaId: number, venda: any) {
    const roomName = `loja_${lojaId}`;
    this.server.to(roomName).emit('nova_venda', venda);
    console.log(`[Socket] Evento 'nova_venda' emitido para a sala ${roomName}`);
  }
}
