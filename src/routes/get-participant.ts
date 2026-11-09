import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { ClientError } from "../errors/client-error";

export async function getParticipant(app: FastifyInstance) {
    const prisma = app.prisma;
    app.withTypeProvider<ZodTypeProvider>().get(
        "/participants/:participantId",
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
                select: {
                    id: true,
                    name: true,
                    email: true,
                    is_confirmed: true
                },
                where: {
                    id: participantId
                }
            });

            if (!participant) {
                throw new ClientError("Participant not found", 404, "NOT_FOUND");
            }

            return reply.send({ participant });
        }
    );
}
