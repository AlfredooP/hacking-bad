import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";

const env = loadEnv();
const app = createApp(env);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "BIN API listening");
});
