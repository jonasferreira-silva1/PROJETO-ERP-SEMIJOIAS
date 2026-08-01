import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Este serviço gerencia a conexão com o banco de dados PostgreSQL usando o Prisma 7
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    // Pega a URL de conexão do arquivo .env
    const connectionString = process.env.DATABASE_URL;
    
    // Cria um pool (piscina) de conexões usando o driver pg do Node
    const pool = new Pool({ connectionString });
    
    // Cria o adaptador exigido pelo Prisma 7 para conexões locais
    const adapter = new PrismaPg(pool);
    
    // Inicializa o PrismaClient passando o adaptador configurado
    super({ adapter });
    this.pool = pool;
  }

  // Executa automaticamente ao iniciar o módulo: abre a conexão com o banco
  async onModuleInit() {
    await this.$connect();
    // Garante que apenas um caixa fique ABERTO por vez por filial (índice único parcial)
    try {
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_caixa_aberto_filial" 
        ON "Caixa" ("filialId") 
        WHERE status = 'ABERTO';
      `);
    } catch (err: any) {
      console.error('[Prisma] Erro ao criar índice único parcial de Caixa:', err.message);
    }
  }

  // Executa automaticamente ao encerrar o módulo: fecha a conexão e limpa o pool
  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
