import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import'dayjs/locale/pt-br'

dayjs.locale('pt-br')
dayjs.extend(LocalizedFormat)

export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
    schema: {
      params: z.object({
        tripId: z.string().uuid(),
      })
    }
  }, async (req) => {
    console.log(req.params)
    return { tripId: req.params.tripId }
  })
}