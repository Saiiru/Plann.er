import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";
export async function confirmTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/trips/:tripId/confirm",
        { schema: { params: z.object({ tripId: z.string().uuid() }) } },
        async (req, reply) => {
            const { tripId } = req.params;
            await app.prisma.$transaction(async (tx) => {
                const trip = await tx.trip.findUnique({
                    where: { id: tripId },
                    include: { participants: { where: { is_owner: false } } }
                });
                if (!trip) throw new ClientError("Trip not found", 404, "NOT_FOUND");
                if (trip.is_confirmed) return;
                for (const participant of trip.participants) {
                    await app.mail.sendConfirmation({
                        to: participant.email,
                        destination: trip.destination,
                        startsAt: trip.starts_at,
                        endsAt: trip.ends_at,
                        link: `${env.API_BASE_URL}/participants/${participant.id}/confirm`,
                        kind: "participant"
                    });
                }
                await tx.trip.update({ where: { id: tripId }, data: { is_confirmed: true } });
            });
            return reply.redirect(`${env.WEB_BASE_URL}/trips/${tripId}`);
        }
    );
}
