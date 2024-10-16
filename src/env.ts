import * as zod from "zod";

const envSchema = zod.z.object({
    DATABASE_URL: zod.z.string().url(),
    API_BASE_URL: zod.z.string().url(),
    WEB_BASE_URL: zod.z.string().url(),
    PORT: zod.z.coerce.number().default(3333)
});

export const env = envSchema.parse(process.env);
