import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";
import type { Trip } from "@prisma/client";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");
dayjs.extend(LocalizedFormat);

export async function createTrip(app: FastifyInstance) {
    const createTrip = async (
        destination: string,
        startsAt: Date,
        endsAt: Date,
        ownerEmail: string,
        ownerName: string,
        emailsToInvite: string[]
    ) => {
        // Create a new trip in the database
        return prisma.trip.create({
            data: {
                destination,
                starts_at: startsAt,
                ends_at: endsAt,
                participants: {
                    createMany: {
                        data: [
                            {
                                email: ownerEmail,
                                name: ownerName,
                                is_owner: true,
                                is_confirmed: true
                            },
                            ...emailsToInvite.map((email) => ({
                                email
                            }))
                        ]
                    }
                }
            }
        });
    };

    const sendTripCreationEmail = async (trip: Trip, ownerEmail: string, ownerName: string, destination: string) => {
        // Send an email notification to the trip owner and invited guests
        const mail = await getMailClient();
        dayjs.locale("pt-br");
        dayjs.extend(LocalizedFormat);
        const formattedStartDate = dayjs(trip.starts_at).format("LL");
        const formattedEndDate = dayjs(trip.ends_at).format("LL");
        console.log(trip.starts_at, "formatação: ", dayjs(trip.starts_at).format());
        const confirmationLink = `http://localhost:3001/trips/${trip.id}/confirm`;
        const html = `
            <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
            <p>Você solicitou a criação de uma viagem para <strong>${destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.</p>
            <p></p>
            <p>Para confirmar sua viagem, clique no link abaixo:</p>
            <p></p>
            <p>
              <a href="${confirmationLink}">Confirmar viagem</a>
            </p>
            <p></p>
            <p>Caso você não saiba do que se trata esse email, apenas ignore.</p>
          </div>
        `;
        const message = await mail.sendMail({
            from: { name: "Trip Planner", address: "tripplanner@mail.er" },
            to: { name: ownerName, address: ownerEmail },
            subject: `Confirm your trip to ${destination} in ${formattedStartDate}`,
            html
        });
        console.log(nodemailer.getTestMessageUrl(message));
    };

    app.withTypeProvider<ZodTypeProvider>().post(
        "/trips",
        {
            schema: {
                body: z.object({
                    destination: z.string().min(4),
                    starts_at: z.coerce.date(),
                    ends_at: z.coerce.date(),
                    owner_email: z.string().email(),
                    owner_name: z.string(),
                    emails_to_invite: z.array(z.string().email())
                })
            }
        },
        async (req, rep) => {
            try {
                const { destination, starts_at, ends_at, owner_email, owner_name, emails_to_invite } = req.body;

                if (dayjs().isAfter(dayjs(starts_at))) {
                    throw new Error("starts_at must be in the future");
                }

                if (dayjs(ends_at).isBefore(starts_at)) {
                    throw new Error("starts_at must be before ends_at");
                }

                const trip = await createTrip(
                    destination,
                    starts_at,
                    ends_at,
                    owner_email,
                    owner_name,
                    emails_to_invite
                );
                await sendTripCreationEmail(trip, owner_email, owner_name, destination);

                return { tripIP: trip.id, tripDestination: trip.destination };
            } catch (error) {
                console.error(error);
                return rep.status(400).send({ error: (error as Error).toString() });
            }
        }
    );
}
