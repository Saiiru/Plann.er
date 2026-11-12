import { FastifyInstance } from "fastify";

/** Readiness endpoint checks schema migrations without leaking database details. */
export async function health(app: FastifyInstance) {
    app.get("/health", async (_request, reply) => {
        try {
            await app.prisma.trip.count();
            return reply.send({ status: "ok", service: "travel-planner-api" });
        } catch {
            return reply.status(503).send({ status: "unavailable", service: "travel-planner-api" });
        }
    });
}
