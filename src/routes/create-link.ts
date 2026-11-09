import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { ClientError } from "../errors/client-error";
import { isHttpUrl } from "../lib/validation";

export async function createLink(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips/:tripId/links",
        {
            schema: {
                params: z.object({
                    tripId: z.string().uuid()
                }),
                body: z.object({
                    title: z.string().trim().min(4).max(200),
                    url: z
                        .string()
                        .url()
                        .max(2048)
                        .refine(isHttpUrl, "Use an HTTP(S) URL")
                })
            }
        },
        async (req, reply) => {
            const { tripId } = req.params;
            const { title, url } = req.body;

            const trip = await prisma.trip.findUnique({
                where: { id: tripId }
            });

            if (!trip) {
                throw new ClientError("Trip not found", 404, "NOT_FOUND");
            }

            const link = await prisma.link.create({
                data: {
                    title,
                    url,
                    trip_id: tripId
                }
            });

            return reply.status(201).send({ linkId: link.id });
        }
    );
}
