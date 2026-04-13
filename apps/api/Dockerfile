FROM node:20-alpine
WORKDIR /workspace
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY apps/simulator/package*.json ./apps/simulator/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/domain/package*.json ./packages/domain/
COPY packages/config/package*.json ./packages/config/
COPY packages/ui/package*.json ./packages/ui/
RUN npm install --no-package-lock --workspaces --include-workspace-root
COPY . .
RUN npm run build --workspace packages/contracts && npm run build --workspace packages/domain && npm run build --workspace apps/api
WORKDIR /workspace/apps/api
EXPOSE 4000
CMD ["npm", "run", "dev"]
