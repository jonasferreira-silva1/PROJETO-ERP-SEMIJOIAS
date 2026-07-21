import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';

// Módulo principal do NestJS que une todas as partes da API (Banco de dados e Autenticação)
@Module({
  imports: [PrismaModule, AuthModule], // Importa os submódulos da API
  controllers: [AppController],        // Define os controllers HTTP gerais
  providers: [AppService],             // Define os serviços gerais da aplicação
})
export class AppModule {}
