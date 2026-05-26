import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import prisma from "./db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import vpsRoutes from "./routes/vps.js";
import financeRoutes from "./routes/finance.js";
import taskRoutes from "./routes/tasks.js";
import dashboardRoutes from "./routes/dashboard.js";
import activityRoutes from "./routes/activity.js";
import chatRoutes from "./routes/chat.js";
import settingsRoutes from "./routes/settings.js";
import { bootstrapApplication } from "./services/bootstrap.js";
import { scheduleElToqueRates } from "./services/exchangeRates.js";

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
});

const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret === "devfast-secret-key-change-in-production")) {
  throw new Error("JWT_SECRET deve ser definido com um valor seguro em produção");
}

await fastify.register(jwt, {
  secret: jwtSecret || "devfast-secret-key-change-in-production",
});

await fastify.register(websocket);

fastify.decorate("prisma", prisma);

fastify.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Não autorizado" });
  }
});

await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(projectRoutes, { prefix: "/api/projects" });
await fastify.register(vpsRoutes, { prefix: "/api/vps" });
await fastify.register(financeRoutes, { prefix: "/api/finance" });
await fastify.register(taskRoutes, { prefix: "/api/tasks" });
await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
await fastify.register(activityRoutes, { prefix: "/api/activity" });
await fastify.register(chatRoutes, { prefix: "/api/chat" });
await fastify.register(settingsRoutes, { prefix: "/api/settings" });

fastify.get("/api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await bootstrapApplication(prisma);
    const port = parseInt(process.env.PORT || "3001");
    await fastify.listen({ port, host: process.env.HOST || "0.0.0.0" });
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    scheduleElToqueRates(prisma, fastify.log);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
