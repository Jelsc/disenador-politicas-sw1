FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

# Copiar solo archivos de configuración de Maven primero
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Hacer el script ejecutable
RUN chmod +x ./mvnw

# Descargar dependencias (esto crea una capa de cache)
# Si hay un error de red, Docker reintentará desde aquí sin perder lo anterior
RUN ./mvnw dependency:go-offline -B

# Copiar el código fuente y construir
COPY src src
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
