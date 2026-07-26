# Etapa 1: Construção (Build)
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de definição de dependências
COPY package*.json ./

# Instala as dependências de compilação
RUN npm install

# Copia a pasta de modelagem do Prisma para gerar os tipos locais
COPY prisma ./prisma
RUN npx prisma generate

# Copia o restante do código-fonte e compila o projeto
COPY . .
RUN npm run build

# Etapa 2: Execução (Runner)
FROM node:20-alpine

WORKDIR /app

# Copia os arquivos gerados e dependências instaladas da etapa de compilação
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expõe a porta interna da API do NestJS
EXPOSE 3000

# Comando padrão para iniciar a API compilada
CMD ["node", "dist/src/main"]
