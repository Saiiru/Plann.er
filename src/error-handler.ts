import { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { ClientError } from "./errors/client-error";
import { Prisma } from "@prisma/client";
export function errorHandler(error: unknown, req: FastifyRequest, reply: FastifyReply) {
    if (error instanceof ZodError)
        return reply.code(400).send({ message: "Invalid input", errors: error.flatten().fieldErrors });
    if (error instanceof ClientError)
        return reply.code(error.statusCode).send({ message: error.message, code: error.code });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return reply.code(409).send({ message: "Participant already invited", code: "CONFLICT" });
    const httpError = error instanceof Error ? (error as Partial<FastifyError>) : undefined;
    if (httpError?.statusCode && httpError.statusCode >= 400 && httpError.statusCode < 500)
        return reply.code(httpError.statusCode).send({ message: httpError.message });
    req.log.error({ err: error });
    return reply.code(500).send({ message: "Internal server error" });
}
