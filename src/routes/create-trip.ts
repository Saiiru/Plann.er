import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../env";
import { email, tripBody, validateTripDates } from "../lib/validation";
export async function createTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips",
        {
            schema: {
                body: tripBody.extend({
                    owner_name: z.string().trim().min(1).max(200),
                    owner_email: email,
                    emails_to_invite: z.array(email).max(100)
                })
            }
        },
        async (req, reply) => {
            const { destination, starts_at, ends_at, owner_name, owner_email, emails_to_invite } = req.body;
            validateTripDates(starts_at, ends_at);
            const guests = [...new Set(emails_to_invite)].filter((value) => value !== owner_email);
            const trip = await app.prisma.$transaction(async (tx) => {
                const created = await tx.trip.create({
                    data: {
                        destination,
                        starts_at,
                        ends_at,
                        participants: {
                            create: [
                                { name: owner_name, email: owner_email, is_owner: true, is_confirmed: true },
                                ...guests.map((email) => ({ email }))
                            ]
                        }
                    }
                });
                await app.mail.sendConfirmation({
                    to: owner_email,
                    destination,
                    startsAt: starts_at,
                    endsAt: ends_at,
                    link: `${env.API_BASE_URL}/trips/${created.id}/confirm`,
                    kind: "trip"
                });
                return created;
            });
            return reply.send({ tripId: trip.id });
        }
    );
}
