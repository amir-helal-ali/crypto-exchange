FROM golang:1.23-alpine AS builder
WORKDIR /app
ENV GONOSUMCHECK=*
ENV GONOSUMDB=*
ENV GOFLAGS=-mod=mod
ENV GOTOOLCHAIN=local
COPY . .
RUN go build -o main .

FROM alpine:latest
RUN apk add --no-cache ca-certificates wget
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 3000
CMD ["./main"]
