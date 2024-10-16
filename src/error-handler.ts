import { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import * as clientError from "./errors/client-error";
import * as fastifyError from "fastify-error";

type FastifyErrorHandler = FastifyInstance["errorHandler"];

const logError = (error: Error, req: FastifyInstance["Request"]) => {
    req.log.error({
        message: error.message,
        stack: error.stack
    });
};

const handleZodError = (error: ZodError, reply: FastifyInstance["Reply"]) => {
    reply.status(400).send({
        message: "Invalid input",
        errors: error.flatten().fieldErrors
    });
};

const handleClientError = (error: clientError.ClientError, reply: FastifyInstance["Reply"]) => {
    reply.status(400).send({
        message: error.message,
        code: error.code || "CLIENT_ERROR"
    });
};

export const errorHandler: FastifyErrorHandler = (error, req, reply) => {
    if (error instanceof ZodError) {
        return handleZodError(error, reply);
    }

    if (error instanceof clientError.ClientError) {
        return handleClientError(error, reply);
    }

    if (error instanceof fastifyError.FastifyError) {
        logError(error, req);
        return reply.status(error.statusCode || 500).send({
            message: error.message || "Internal server error"
        });
    }

    logError(error, req);
    return reply.status(500).send({
        message: "Internal server error"
    });
};
