FROM node:22-alpine

RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@11.14.0 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lgx/backend prisma:generate

WORKDIR /app/packages/backend

EXPOSE 5001

CMD ["pnpm", "dev"]
