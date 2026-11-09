import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { ClientError } from "../errors/client-error";
import { tripBody, validateTripDates } from "../lib/validation";

export async function updateTrip(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().put(
        "/trips/:tripId",
        {
            schema: {
                params: z.object({
                    tripId: z.string().uuid()
                }),
                body: tripBody
            }
        },
        async (req, reply) => {
            const { tripId } = req.params;
            const { destination, starts_at, ends_at } = req.body;

            validateTripDates(starts_at, ends_at);
            const trip = await prisma.$transaction(async (tx) => {
                const existing = await tx.trip.findUnique({ where: { id: tripId } });
                if (!existing) throw new ClientError("Trip not found", 404, "NOT_FOUND");
                const outside = await tx.activity.count({
                    where: { trip_id: tripId, OR: [{ occurs_at: { lt: starts_at } }, { occurs_at: { gt: ends_at } }] }
                });
                if (outside)
                    throw new ClientError("New dates would exclude existing activities", 409, "ACTIVITY_OUTSIDE_TRIP");
                return tx.trip.update({ where: { id: tripId }, data: { destination, starts_at, ends_at } });
            });

            return reply.send({ tripId: trip.id });
        }
    );
}
