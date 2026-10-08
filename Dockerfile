FROM node:22-alpine AS build
WORKDIR /app

ARG PUBLIC_ORIGIN=https://whatsapp.codestra.co
ARG API_BASE=https://api.codestra.co
ARG IDP_URL=https://auth.codestra.co
ARG IDP_REALM=codestra
ARG IDP_CLIENT_ID=codestra-whatsapp-frontend
ARG REDIRECT_URL=https://whatsapp.codestra.co/
ARG DEV_MODE=false

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN VITE_WHATSAPP_PUBLIC_ORIGIN="$PUBLIC_ORIGIN" \
    VITE_WHATSAPP_API_BASE_URL="$API_BASE" \
    VITE_KEYCLOAK_URL="$IDP_URL" \
    VITE_KEYCLOAK_REALM="$IDP_REALM" \
    VITE_KEYCLOAK_CLIENT_ID="$IDP_CLIENT_ID" \
    VITE_AUTH_REDIRECT_URI="$REDIRECT_URL" \
    VITE_DEV_BYPASS_AUTH="$DEV_MODE" \
    npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["wget","-q","-O","-","http://127.0.0.1:8080/healthz"]
