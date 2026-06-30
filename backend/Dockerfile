FROM golang:1.25-alpine AS builder
WORKDIR /app
ENV GONOSUMCHECK=*
ENV GONOSUMDB=*
ENV GOFLAGS=-mod=mod
COPY . .
RUN go build -o main .

FROM alpine:latest

# Install runtime dependencies:
# - ca-certificates: TLS root certs for outgoing HTTPS (Let's Encrypt API, etc.)
# - wget: healthcheck
# - openssl: SSL certificate generation (self-signed + CSR for Let's Encrypt)
# - certbot: Let's Encrypt ACME client (real production certs)
# - mkcert: locally-trusted dev certs (sets up local CA so browsers trust the cert)
RUN apk add --no-cache ca-certificates wget openssl certbot \
    && update-ca-certificates

WORKDIR /root/
COPY --from=builder /app/main .

# Directories for SSL certs and ACME challenges (mounted from host)
RUN mkdir -p /etc/nginx/certs /var/www/certbot

EXPOSE 3000
CMD ["./main"]
