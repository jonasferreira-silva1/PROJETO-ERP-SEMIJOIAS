// Carrega as variáveis de ambiente do arquivo .env
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Cria a aplicação NestJS com base no módulo principal (AppModule)
  const app = await NestFactory.create(AppModule);
  
  // Habilita CORS para permitir requisições do frontend rodando em outra origem/porta
  app.enableCors();

  // Inicia o servidor HTTP na porta 3000
  await app.listen(3000);
}
bootstrap();
