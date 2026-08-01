import { Module } from '@nestjs/common';
import { CaixasService } from './caixas.service';
import { CaixasController } from './caixas.controller';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CaixasController],
  providers: [CaixasService],
  exports: [CaixasService], // Exporta o serviço para permitir que o VendasService valide e associe vendas ao caixa
})
export class CaixasModule {}
