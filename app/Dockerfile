FROM node:20-alpine

WORKDIR /app

# Copia arquivos de dependência do projeto
COPY package*.json ./

# Instala as dependências necessárias ignorando incompatibilidades de peer (React 19)
RUN npm install --legacy-peer-deps

# Copia o restante dos arquivos do projeto
COPY . .

# Expõe a porta padrão do Expo Metro Bundler para conexões Web
EXPOSE 8081

# Inicia o Expo no modo Web com suporte CI para desativar prompts interativos
ENV CI=1
CMD ["npx", "expo", "start", "--web"]
