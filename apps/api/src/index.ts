import { buildServer } from "./app";
import { env } from "./lib/env";

const app = buildServer();

app
  .listen({
    host: "0.0.0.0",
    port: env.PORT
  })
  .then(() => {
    app.log.info(`API listening on ${env.PORT}`);
  })
  .catch((error) => {
    app.log.error(error, "Failed to start API server");
    process.exit(1);
  });