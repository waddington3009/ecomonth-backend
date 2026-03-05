# =========================================
# ECO MONTH — Backend Dockerfile
# =========================================

FROM node:20-alpine

WORKDIR /app

# Copiar package.json e package-lock.json primeiro (para cache de dependências)
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o restante do código
COPY . .

# Gerar o Prisma Client
RUN npx prisma generate

# Compilar TypeScript
RUN npx tsc

# Expor a porta
EXPOSE 3001

# Iniciar o servidor
CMD ["node", "dist/index.js"]
