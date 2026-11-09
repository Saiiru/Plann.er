import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";

export async function confirmParticipant(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().get(
        "/participants/:participantId/confirm",
        {
            schema: {
                params: z.object({
                    participantId: z.string().uuid()
                })
            }
        },
        async (req, reply) => {
            const { participantId } = req.params;

            const participant = await prisma.participant.findUnique({
                where: {
                    id: participantId
                },
                include: { trip: true }
            });

            if (!participant) {
                throw new ClientError("Participant not found", 404, "NOT_FOUND");
            }

            if (!participant.trip.is_confirmed)
                throw new ClientError("Trip is not confirmed", 409, "TRIP_NOT_CONFIRMED");

            if (participant.is_confirmed) {
                return reply.redirect(`${env.WEB_BASE_URL}/trips/${participant.trip_id}`);
            }

            await prisma.participant.update({
                where: { id: participantId },
                data: { is_confirmed: true }
            });

            return reply.redirect(`${env.WEB_BASE_URL}/trips/${participant.trip_id}`);
        }
    );
}
