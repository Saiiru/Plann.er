import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";

export async function createTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips",
        {
            schema: {
                body: z.object({
                    destination: z.string().min(4),
                    starts_at: z.coerce.date(),
                    ends_at: z.coerce.date(),
                    owner_email: z.string().email(),
                    owner_name: z.string()
                })
            }
        },
        async (req, rep) => {
            const { destination, starts_at, ends_at, owner_email, owner_name } = req.body;

            if (dayjs().isAfter(dayjs(starts_at))) {
                return rep.status(400).send({ error: "starts_at must be in the future" });
            }

            if (dayjs(ends_at).isBefore(starts_at)) {
                return rep.status(400).send({ error: "starts_at must be before ends_at" });
            }

            const trip = await prisma.trip.create({
                data: {
                    destination,
                    starts_at,
                    ends_at,
                    participants: { create: { email: owner_email, name: owner_name } }
                }
            });

            const mail = await getMailClient();

            const message = await mail.sendMail({
                from: { name: "Trip Planner", address: "tripplanner@mail.er" },
                to: { name: owner_name, address: owner_email }
            });

            console.log(nodemailer.getTestMessageUrl(message));

            return { tripIP: trip.id, tripDestination: trip.destination };
        }
    );
}
