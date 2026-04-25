FROM node:20-alpine

WORKDIR /app

# Instalamos las dependencias primero para aprovechar la caché de Docker
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

EXPOSE 4200

# Usamos poll para asegurar que Docker en Windows detecte los cambios de archivos
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
