# Diseñador de Políticas - Guía de Despliegue en la Nube (Azure)

Este documento explica cómo desplegar la plataforma en una Máquina Virtual de Azure usando Docker, Nginx y Let's Encrypt (HTTPS).

## Requisitos Previos

1. **Máquina Virtual (Azure VM)**: Una VM con Linux (recomendado Ubuntu 22.04 LTS).
2. **Puertos Abiertos**: Asegurate de abrir los puertos **80 (HTTP)**, **443 (HTTPS)** y **22 (SSH)** en el panel de red de Azure (NSG - Network Security Group).
3. **Dominio Propio**: Necesitás comprar un dominio en un proveedor (ej: Hostinger, GoDaddy, Cloudflare, Namecheap).

## Paso 1: Configurar los DNS (En tu proveedor de Dominio)

En el panel de tu proveedor de dominio (donde compraste el dominio), tenés que crear dos **Registros Tipo A** que apunten a la **IP Pública** de tu máquina virtual en Azure:

* Tipo **A** | Nombre: `app` | Valor: `IP_DE_TU_AZURE_VM`  *(Esto será app.tudominio.com)*
* Tipo **A** | Nombre: `api` | Valor: `IP_DE_TU_AZURE_VM`  *(Esto será api.tudominio.com)*

> **Nota:** La propagación de los DNS puede tardar desde unos minutos hasta unas horas.

## Paso 2: Preparar la Máquina Virtual

Conectate por SSH a tu máquina virtual en Azure:
```bash
ssh usuario@IP_DE_TU_AZURE_VM
```

Instalá Docker y Docker Compose:
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 git -y
sudo usermod -aG docker $USER
# (Cerrá sesión y volvé a entrar para que apliquen los permisos de docker)
```

## Paso 3: Clonar el Repositorio y Configurar Entorno

Cloná tu código en el servidor:
```bash
git clone <URL_DE_TU_REPO> proyecto
cd proyecto
```

Creá y editá el archivo `.env`:
```bash
nano .env
```

Pegá la siguiente configuración, reemplazando `tudominio.com` por el dominio real que compraste:

```env
# 1. APP_ENV: Indicamos que estamos en producción. Esto le dice a Nginx que exija HTTPS y pida certificados.
APP_ENV=prod

# 2. Dominios: Los subdominios que configuraste en tu proveedor DNS en el Paso 1.
FRONTEND_DOMAIN=app.tudominio.com
API_DOMAIN=api.tudominio.com

# Email para que Let's Encrypt (Certbot) te avise si el certificado está por expirar.
CERTBOT_EMAIL=tu_correo@gmail.com 

# 3. URLs Internas: Se construyen uniendo https:// o wss:// con los dominios que elegiste arriba. 
# El frontend inyectará esto dinámicamente en el navegador.
API_URL=https://api.tudominio.com/api
AI_URL=https://api.tudominio.com/ai
WS_URL=wss://api.tudominio.com/ws

# 4. CORS: Autorizamos al backend para que reciba peticiones exclusivamente desde nuestro dominio frontend.
ALLOWED_ORIGINS=https://app.tudominio.com
```

## Paso 4: Desplegar

Levantá todos los contenedores con Docker Compose:
```bash
docker compose up -d --build
```

**¿Qué sucede automáticamente al ejecutar esto?**
1. Nginx lee que `APP_ENV=prod`.
2. El contenedor de `certbot` pide los certificados SSL a Let's Encrypt para `app.tudominio.com` y `api.tudominio.com`.
3. Nginx habilita el tráfico HTTPS seguro.
4. El script de Angular reemplaza al vuelo `env.template.js` para que tu app sepa dónde hacer las peticiones sin necesidad de reconstruir Node/Angular.

## Paso 5: Validar

Ingresá a `https://app.tudominio.com` en tu navegador. El candado de seguridad debería estar activo y la plataforma funcionando. 
Si vas a conectarte desde la App Móvil Flutter, el `api_service.dart` utilizará automáticamente `https://api.tudominio.com/api` cuando buildees el APK en modo Release.