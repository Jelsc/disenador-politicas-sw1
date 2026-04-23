FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY . .
# Asegurarse de que el script mvnw sea ejecutable
RUN chmod +x ./mvnw
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
