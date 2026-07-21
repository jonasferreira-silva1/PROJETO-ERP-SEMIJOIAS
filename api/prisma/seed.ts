import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Função principal de sementeira (seed) que insere dados iniciais no banco
async function main() {
  // Configura a conexão direta usando o pool PostgreSQL da mesma forma que a API do NestJS
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/adorne_erp?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Iniciando o seeding...');

  // Limpando tabelas antigas (ordem reversa para respeitar chaves estrangeiras)
  await prisma.itemVenda.deleteMany({});
  await prisma.venda.deleteMany({});
  await prisma.produto.deleteMany({});
  await prisma.usuario.deleteMany({});
  await prisma.filial.deleteMany({});
  await prisma.loja.deleteMany({});

  // 1. Criar a Loja principal (Tenant)
  const loja = await prisma.loja.create({
    data: {
      nome: 'Semijoias Adorne',
      cnpj: '12345678000199',
      plano: 'PREMIUM',
    },
  });

  // 2. Criar a Filial física principal
  const filial = await prisma.filial.create({
    data: {
      lojaId: loja.id,
      nome: 'Matriz - Centro',
      endereco: 'Rua das Flores, 123 - Centro',
    },
  });

  // 3. Criptografar as senhas iniciais de teste com bcrypt
  const senhaDonoHash = await bcrypt.hash('AdorneDona123', 10);
  const senhaFuncHash = await bcrypt.hash('AdorneFunc123', 10);

  // 4. Criar usuário de teste com cargo DONO (acesso total)
  await prisma.usuario.create({
    data: {
      lojaId: loja.id,
      filialId: filial.id,
      nome: 'Jonas Ferreira (Dono)',
      email: 'dona@adorne.com',
      senhaHash: senhaDonoHash,
      role: 'DONO',
    },
  });

  // 5. Criar usuário de teste com cargo FUNCIONARIA (acesso restrito)
  await prisma.usuario.create({
    data: {
      lojaId: loja.id,
      filialId: filial.id,
      nome: 'Maria Silva (Funcionária)',
      email: 'func@adorne.com',
      senhaHash: senhaFuncHash,
      role: 'FUNCIONARIA',
    },
  });

  // 6. Cadastrar produtos iniciais para movimentar vendas
  const produtos = [
    { nome: 'Brinco Argola Banhado a Ouro', categoria: 'Brincos', preco: 89.90, estoque: 50 },
    { nome: 'Colar Ponto de Luz Prata 925', categoria: 'Colares', preco: 120.00, estoque: 30 },
    { nome: 'Anel Regulável Coração', categoria: 'Anéis', preco: 65.00, estoque: 20 },
    { nome: 'Pulseira Riviera Zircônia', categoria: 'Pulseiras', preco: 150.00, estoque: 15 },
  ];

  for (const prod of produtos) {
    await prisma.produto.create({
      data: {
        lojaId: loja.id,
        nome: prod.nome,
        categoria: prod.categoria,
        preco: prod.preco,
        estoque: prod.estoque,
      },
    });
  }

  console.log('Seeding concluído com sucesso!');
  
  // Encerra a conexão da piscina de banco de dados
  await pool.end();
}

main()
  .catch((e) => {
    console.error('Erro durante o seeding:', e);
    process.exit(1);
  });
