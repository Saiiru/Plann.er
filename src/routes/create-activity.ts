import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { ClientError } from "../errors/client-error";
import { dayjs } from "../lib/dayjs";
import { dateTime } from "../lib/validation";

export async function createActivity(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips/:tripId/activities",
        {
            schema: {
                params: z.object({
                    tripId: z.string().uuid()
                }),
                body: z.object({
                    title: z.string().trim().min(4).max(200),
                    occurs_at: dateTime
                })
            }
        },
        async (req, reply) => {
            const { tripId } = req.params;
            const { title, occurs_at } = req.body;

            const activity = await prisma.$transaction(async (tx) => {
                const trip = await tx.trip.findUnique({
                    where: {
                        id: tripId
                    }
                });

                if (!trip) {
                    throw new ClientError("Trip not found", 404, "NOT_FOUND");
                }

                if (dayjs(occurs_at).isBefore(trip.starts_at)) {
                    throw new ClientError("Invalid activity date");
                }

                if (dayjs(occurs_at).isAfter(trip.ends_at)) {
                    throw new ClientError("Invalid activity date");
                }

                return tx.activity.create({
                    data: {
                        title,
                        occurs_at,
                        trip_id: tripId
                    }
                });
            });

            return reply.status(201).send({ activityId: activity.id });
        }
    );
}
