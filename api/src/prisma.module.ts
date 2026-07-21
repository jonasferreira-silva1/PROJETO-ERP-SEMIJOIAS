import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Torna o módulo do Prisma global, permitindo que a conexão de banco 
// seja injetada em qualquer parte da API sem precisar reimportar o módulo
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Exporta o serviço para uso global
})
export class PrismaModule {}
