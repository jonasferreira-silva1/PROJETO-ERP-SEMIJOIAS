# Como Rodar o Projeto 🚀💍

Este documento explica como executar o ecossistema completo do **ERP Semijoias Adorne** (Banco de dados, Backend e Frontend Mobile Web) de forma simplificada e automatizada utilizando Docker.

---

## 📋 Pré-requisitos

Certifique-se de ter instalado em sua máquina:
1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) (com suporte a Docker Compose).

---

## 🛠️ Inicialização Automática via Docker (Recomendado)

Criamos uma orquestração centralizada que inicia todos os serviços necessários com um único comando na raiz do projeto:

1. **Subir e Buildar todos os Containers:**
   Execute o seguinte comando no terminal (na pasta raiz `Erp-semijoias`):
   ```bash
   docker compose up --build
   ```

2. **O que acontece por debaixo dos panos?**
   O Docker iniciará três containers identificados da seguinte forma:
   - **`adorne-postgres`** (Banco de Dados): Banco de dados PostgreSQL 15 rodando internamente e exposto localmente na porta **`5433`** (para evitar conflitos com instalações locais de PostgreSQL).
   - **`adorne-backend`** (API NestJS): Roda a API Rest. Antes de expor o serviço na porta **`3000`**, ele roda automaticamente:
     - `npx prisma migrate deploy` (aplica todas as atualizações de tabelas).
     - `npx prisma db seed` (insere a loja Matriz, usuários de teste e produtos padrão).
   - **`adorne-frontend`** (App Mobile Web): Roda o servidor Metro do Expo em modo Web de forma não-interativa e expõe o aplicativo móvel no navegador através da porta **`8081`**.

3. **Verificar os status no terminal:**
   Você verá os logs unificados das migrações Prisma rodando no banco e o Expo subindo o aplicativo web na porta `8081`.

---

## 🖥️ Acesso aos Serviços

Após os containers sinalizarem inicialização bem-sucedida:

- **Frontend Mobile Web**: Acesse pelo navegador em [http://localhost:8081](http://localhost:8081)
- **API Backend**: Acesse a raiz da API em [http://localhost:3000](http://localhost:3000)
- **Banco de Dados local**: Pode se conectar por qualquer gerenciador (DBeaver, pgAdmin) usando:
  - **Host**: `localhost`
  - **Porta**: `5433`
  - **Usuário**: `postgres`
  - **Senha**: `postgres`
  - **Database**: `adorne_erp`

---

## 🔑 Credenciais para Testes de Login

Ao carregar o app em [http://localhost:8081](http://localhost:8081), você poderá validar o fluxo com os usuários padrão do banco de dados (inseridos pelo script de seed):

### 1. Perfil Dona (Acesso Total)
- **E-mail**: `dona@adorne.com`
- **Senha**: `AdorneDona123`

### 2. Perfil Funcionária (Acesso a Vendas)
- **E-mail**: `func@adorne.com`
- **Senha**: `AdorneFunc123`

---

## 🛑 Como parar os serviços

Para desligar todos os containers limpando os volumes locais de cache de rede, basta rodar na raiz:
```bash
docker compose down -v
```
