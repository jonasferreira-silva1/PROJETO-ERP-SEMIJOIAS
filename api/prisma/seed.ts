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
  await prisma.movimentacaoCaixa.deleteMany({});
  await prisma.caixa.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.pushToken.deleteMany({});
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

  const createdProdutos = [];
  for (const prod of produtos) {
    const p = await prisma.produto.create({
      data: {
        lojaId: loja.id,
        nome: prod.nome,
        categoria: prod.categoria,
        preco: prod.preco,
        estoque: prod.estoque,
      },
    });
    createdProdutos.push(p);
  }

  // Obter o ID da funcionária para as vendas
  const funcionaria = await prisma.usuario.findFirst({
    where: { role: 'FUNCIONARIA' }
  });

  if (funcionaria) {
    console.log('Criando vendas de teste para múltiplos meses...');
    
    // Vendas de Agosto de 2026 (Mês atual)
    // Venda 1: Colar (1) + Anel (1) = 185.00
    await prisma.venda.create({
      data: {
        uuid: 'seed-sale-aug-1',
        lojaId: loja.id,
        filialId: filial.id,
        usuarioId: funcionaria.id,
        dataHora: new Date('2026-08-05T14:00:00-03:00'),
        valorTotal: 185.00,
        formaPagamento: 'PIX',
        observacao: 'Venda de teste Agosto 1',
        itens: {
          create: [
            { produtoId: createdProdutos[1].id, quantidade: 1, valorUnitario: createdProdutos[1].preco },
            { produtoId: createdProdutos[2].id, quantidade: 1, valorUnitario: createdProdutos[2].preco },
          ]
        }
      }
    });

    // Venda 2: Pulseira (1) = 150.00
    await prisma.venda.create({
      data: {
        uuid: 'seed-sale-aug-2',
        lojaId: loja.id,
        filialId: filial.id,
        usuarioId: funcionaria.id,
        dataHora: new Date('2026-08-12T10:30:00-03:00'),
        valorTotal: 150.00,
        formaPagamento: 'CREDITO',
        observacao: 'Venda de teste Agosto 2',
        itens: {
          create: [
            { produtoId: createdProdutos[3].id, quantidade: 1, valorUnitario: createdProdutos[3].preco },
          ]
        }
      }
    });

    // Vendas de Julho de 2026 (Mês Anterior)
    // Venda 3: Colar (1) = 120.00
    await prisma.venda.create({
      data: {
        uuid: 'seed-sale-jul-1',
        lojaId: loja.id,
        filialId: filial.id,
        usuarioId: funcionaria.id,
        dataHora: new Date('2026-07-15T16:00:00-03:00'),
        valorTotal: 120.00,
        formaPagamento: 'DEBITO',
        observacao: 'Venda de teste Julho 1',
        itens: {
          create: [
            { produtoId: createdProdutos[1].id, quantidade: 1, valorUnitario: createdProdutos[1].preco }
          ]
        }
      }
    });

    // Venda 4: Brinco (1) = 89.90
    await prisma.venda.create({
      data: {
        uuid: 'seed-sale-jul-2',
        lojaId: loja.id,
        filialId: filial.id,
        usuarioId: funcionaria.id,
        dataHora: new Date('2026-07-28T11:00:00-03:00'),
        valorTotal: 89.90,
        formaPagamento: 'DINHEIRO',
        observacao: 'Venda de teste Julho 2',
        itens: {
          create: [
            { produtoId: createdProdutos[0].id, quantidade: 1, valorUnitario: createdProdutos[0].preco }
          ]
        }
      }
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
