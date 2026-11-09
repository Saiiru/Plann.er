import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { ClientError } from "../errors/client-error";

export async function getLinks(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().get(
        "/trips/:tripId/links",
        {
            schema: {
                params: z.object({
                    tripId: z.string().uuid()
                })
            }
        },
        async (req, reply) => {
            const { tripId } = req.params;

            const trip = await prisma.trip.findUnique({
                where: {
                    id: tripId
                },
                include: {
                    links: true
                }
            });

            if (!trip) {
                throw new ClientError("Trip not found", 404, "NOT_FOUND");
            }

            return reply.send({ links: trip.links });
        }
    );
}
