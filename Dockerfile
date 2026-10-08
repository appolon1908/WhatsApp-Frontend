FROM nginxinc/nginx-unprivileged:1.31.5-alpine3.24
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js styles.css /usr/share/nginx/html/
EXPOSE 8080
