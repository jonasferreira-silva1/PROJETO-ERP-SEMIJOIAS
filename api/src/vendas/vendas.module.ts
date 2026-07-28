import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VendasService } from './vendas.service';
import { VendasController } from './vendas.controller';
import { VendasGateway } from './vendas.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key-adorne-semijoias',
    }),
  ],
  controllers: [VendasController],
  providers: [VendasService, VendasGateway],
  exports: [VendasService, VendasGateway],
})
export class VendasModule {}
