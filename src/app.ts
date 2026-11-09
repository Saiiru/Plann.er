import cors from "@fastify/cors";
import fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { env } from "./env";
import { PrismaClient } from "@prisma/client";
import { createPreviewMailClient, MailClient } from "./lib/mail";
import { errorHandler } from "./error-handler";
import { confirmTrip } from "./routes/confirm-trip";
import { confirmParticipant } from "./routes/confirm-participant";
import { createActivity } from "./routes/create-activity";
import { createInvite } from "./routes/create-invite";
import { createLink } from "./routes/create-link";
import { createTrip } from "./routes/create-trip";
import { getActivities } from "./routes/get-activities";
import { getLinks } from "./routes/get-links";
import { getParticipant } from "./routes/get-participant";
import { getParticipants } from "./routes/get-participants";
import { getTripDetails } from "./routes/get-trip-details";
import { updateTrip } from "./routes/update-trip";

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
        mail: MailClient;
    }
}
export function buildApp(options: { prisma?: PrismaClient; mail?: MailClient; logger?: boolean } = {}) {
    const app = fastify({ logger: options.logger ?? false });
    const prisma = options.prisma ?? new PrismaClient();
    app.decorate("prisma", prisma);
    app.decorate("mail", options.mail ?? createPreviewMailClient(env.MAIL_PREVIEW_DIR));
    if (!options.prisma)
        app.addHook("onClose", async () => {
            await prisma.$disconnect();
        });
    app.register(cors, {
        origin: env.CORS_ORIGIN,
        methods: ["GET", "HEAD", "POST", "PUT", "OPTIONS"]
    });

    // Add schema validator and serializer
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.setErrorHandler(errorHandler);

    app.register(createTrip);
    app.register(confirmTrip);
    app.register(confirmParticipant);
    app.register(createActivity);
    app.register(getActivities);
    app.register(createLink);
    app.register(getLinks);
    app.register(getParticipants);
    app.register(createInvite);
    app.register(updateTrip);
    app.register(getTripDetails);
    app.register(getParticipant);

    return app;
}
