# Adorne ERP/CRM — Do Caderno de Papel ao Tempo Real 💍📱

> **Uma solução real para dores reais.** Como transformamos a gestão manual da loja *Semijoias Adorne* em um ecossistema mobile reativo, robusto e preparado para virar SaaS.

---

## 📖 A História por Trás do Projeto

### O Cenário
Imagine uma loja física de semijoias fina e elegante, com clientes exigentes e peças exclusivas. No entanto, por trás das vitrines brilhantes, a operação diária dependia de um velho conhecido de muitos pequenos negócios: **o caderno de papel**. 
Todas as vendas eram anotadas manualmente. O estoque era conferido visualmente e a comunicação de fechamento de caixa dependia de mensagens de WhatsApp ao fim do dia.

### As Dores
1. **Para a Dona da Loja:** "Quanto vendemos hoje?" dependia de enviar uma mensagem para a funcionária e aguardar a resposta. Sem dados consolidados de faturamento, ticket médio ou desempenho em tempo real.
2. **Para a Funcionária:** Registrar vendas de forma rápida sem travar o atendimento presencial era um desafio.
3. **Para o Negócio:** Dados dispersos, falta de histórico confiável de clientes e nenhuma inteligência comercial sobre sazonalidades ou estoque.

### O Nascimento do Adorne ERP/CRM
Para resolver este abismo de visibilidade, idealizamos este **mini ERP/CRM Mobile**. O app atua com dois perfis integrados que se comunicam instantaneamente:
- A **Funcionária** registra a venda no balcão da loja física em menos de 10 segundos.
- A **Dona** recebe uma notificação push no celular imediatamente e vê o gráfico de faturamento e ticket médio do dia se atualizando no dashboard sem precisar de nenhum refresh.

---

## 🛠️ Decisões de Arquitetura que Importam (Foco do Recrutador 🚀)

Para desenvolver um software de nível profissional, nos preocupamos com a escalabilidade, resiliência e segurança desde a primeira linha de código:

### 1. Multi-Tenant por Design (Preparado para SaaS)
Embora o MVP atenda apenas à *Semijoias Adorne*, o banco de dados e as queries da API foram estruturados com isolamento de dados por `lojaId` e `filialId` desde o início. Isso significa que podemos transformar o app em um SaaS multi-empresa no futuro sem precisar reescrever a arquitetura.

### 2. Sincronização em Tempo Real Reativa
Utilizamos **WebSockets (Socket.io)** para conectar as ações da funcionária ao painel de controle da dona. Se o app da dona estiver fechado, a API NestJS despacha uma **Notificação Push** via Expo. E se a dona estiver ativa no app, o dashboard atualiza dinamicamente.

### 3. Resiliência a Falhas de Conexão (Fila Local)
Conexões móveis oscilam. Por isso, projetamos o aplicativo mobile com uma **fila local de sincronização**. Se a funcionária registrar uma venda em um momento de instabilidade, a venda é armazenada localmente e transmitida à API assim que o sinal de internet retornar.

### 4. Segurança e Controle de Acesso (RBAC)
Com autenticação **JWT**, as credenciais decodificadas no token definem não apenas a interface mobile do usuário (`DonaStack` vs `FuncionariaStack`), mas também as permissões a nível de backend utilizando **NestJS Guards** para impedir que funcionários visualizem dados consolidados de faturamento.

### 5. Controle de Caixa e Conciliação Financeira
O fechamento de caixa possui trava transacional a nível de banco (`SELECT FOR UPDATE`), garantindo consistência matemática entre as vendas e movimentações físicas (sangrias/suprimentos) e detectando automaticamente eventuais quebras ou sobras de caixa.

---

## 🧳 A Stack Técnica

### **Backend (Core API)**
- **NestJS**: Framework modular Node.js com TypeScript voltado para escalabilidade.
- **Prisma ORM**: Modelagem de dados fluida com migrações automatizadas.
- **PostgreSQL**: Banco relacional robusto para consistência de dados financeiros.
- **Socket.io**: Comunicação bidirecional e eventos orientados em tempo real.

### **Frontend & Mobile**
- **React Native + Expo**: Desenvolvimento nativo multiplataforma moderno.
- **NativeWind (Tailwind CSS)**: Estilização utilitária rápida e consistente.
- **TanStack Query (React Query)**: Cache de dados, sincronização inteligente e fallback por polling.
- **Expo Notifications**: Gerenciamento integrado de notificações push nativas.

---

## 🗺️ Mapa de Desenvolvimento do MVP (Concluído 🎉)

O projeto seguiu entregáveis incrementais divididos em sprints:

- **Sprint 0 — Fundação (NestJS + Docker + Prisma)**: Setup de banco, tabelas fundamentais e controle RBAC de usuários.
- **Sprint 1 — Login e Navegação Mobile**: Login do app salvando JWT em SecureStore e direcionando dinamicamente por cargo.
- **Sprint 2 — Registro de Venda (lado Funcionária)**: Carrinho de compras reativo, catálogo de produtos, histórico local e envio de vendas.
- **Sprint 3 — Tempo Real**: WebSockets integrados para avisar a dona em tempo real de novas vendas, notificações push Expo e fila offline para conciliação.
- **Sprint 4 — Dashboard da Dona**: KPIs diários dinâmicos de faturamento, ticket médio e gráfico intradia atualizados automaticamente por sockets.
- **Sprint 5 — Caixa do Dia**: Fluxo completo de caixa por filial (abertura, sangria, suprimento e fechamento com conciliação física).
- **Sprint 6 — Relatório Mensal & Fechamento**: Comparativo percentual com o mês anterior (tratando fallback nulo para primeiro mês de uso) e gráfico diário com rolagem lateral responsiva.

---

## ⚙️ Como Executar o Projeto

A execução local de todos os serviços (Banco, API e App Mobile) está unificada em um único arquivo de orquestração Docker:

### Pré-requisitos
- Docker Desktop instalado e rodando.

### Passo a Passo

1. **Subir e construir todos os serviços:**
   Na pasta raiz do projeto, execute o seguinte comando no terminal:
   ```bash
   docker compose up --build
   ```

2. **Serviços Ativados:**
   - **Frontend (Expo Web)**: Disponível em [http://localhost:8081](http://localhost:8081)
   - **Backend API (NestJS)**: Disponível na porta [http://localhost:3000](http://localhost:3000)
   - **Banco (Postgres)**: Rodando internamente na porta local `5433` (com seeds e migrations aplicadas automaticamente).

3. **Contas de Teste Integradas no Seed:**
   - **Perfil Dona (Acesso Total):**
     - **E-mail:** `dona@adorne.com`
     - **Senha:** `AdorneDona123`
   - **Perfil Funcionária:**
     - **E-mail:** `func@adorne.com`
     - **Senha:** `AdorneFunc123`

---

## 👥 Autor

- **Jonas Ferreira Silva** - *Idealizador & Desenvolvedor Full Stack*
