# syntax=docker/dockerfile:1

FROM golang:1.25-alpine AS builder

ENV GOTOOLCHAIN=local

RUN apk add --no-cache git ca-certificates

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.21

# git: clone repos; access host nginx/certbot via chroot when HOST_ROOT=/host
RUN apk add --no-cache ca-certificates git openssh-client util-linux

WORKDIR /app

COPY --from=builder /out/server /app/server

# Root required for Docker socket and writing nginx configs on mounted host paths.
USER root

EXPOSE 8080

ENTRYPOINT ["/app/server"]
