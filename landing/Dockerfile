FROM nginx:1.27-alpine

# Custom server config (static site + /api & /socket.io proxy to the backend)
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/sudoku.conf

# Static site (then drop the build-only files that slipped into the context)
COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/nginx.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=4s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
