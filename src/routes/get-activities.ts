import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ClientError } from "../errors/client-error";

export async function getActivities(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().get(
        "/trips/:tripId/activities",
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
                    activities: {
                        orderBy: {
                            occurs_at: "asc"
                        }
                    }
                }
            });

            if (!trip) {
                throw new ClientError("Trip not found", 404, "NOT_FOUND");
            }

            // Calendar buckets are UTC and include the final day even for partial-day trips.
            const firstDay = new Date(trip.starts_at);
            firstDay.setUTCHours(0, 0, 0, 0);
            const lastDay = new Date(trip.ends_at);
            lastDay.setUTCHours(0, 0, 0, 0);
            const count = Math.floor((lastDay.getTime() - firstDay.getTime()) / 86400000) + 1;
            const byDay = new Map<string, typeof trip.activities>();
            for (const activity of trip.activities) {
                const key = activity.occurs_at.toISOString().slice(0, 10);
                const bucket = byDay.get(key) ?? [];
                bucket.push(activity);
                byDay.set(key, bucket);
            }
            const activities = Array.from({ length: count }, (_, index) => {
                const date = new Date(firstDay.getTime() + index * 86400000);
                return { date, activities: byDay.get(date.toISOString().slice(0, 10)) ?? [] };
            });

            return reply.send({ activities });
        }
    );
}
