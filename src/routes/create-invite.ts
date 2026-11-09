import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";
import { email } from "../lib/validation";
export async function createInvite(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips/:tripId/invites",
        { schema: { params: z.object({ tripId: z.string().uuid() }), body: z.object({ email }) } },
        async (req, reply) => {
            const { tripId } = req.params;
            const participant = await app.prisma.$transaction(async (tx) => {
                const trip = await tx.trip.findUnique({ where: { id: tripId } });
                if (!trip) throw new ClientError("Trip not found", 404, "NOT_FOUND");
                if (!trip.is_confirmed)
                    throw new ClientError(
                        "Confirm the trip before inviting more participants",
                        409,
                        "TRIP_NOT_CONFIRMED"
                    );
                const created = await tx.participant.create({ data: { email: req.body.email, trip_id: tripId } });
                await app.mail.sendConfirmation({
                    to: created.email,
                    destination: trip.destination,
                    startsAt: trip.starts_at,
                    endsAt: trip.ends_at,
                    link: `${env.API_BASE_URL}/participants/${created.id}/confirm`,
                    kind: "participant"
                });
                return created;
            });
            return reply.code(201).send({ participantId: participant.id });
        }
    );
}
