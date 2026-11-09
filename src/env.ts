import { z } from "zod";
import { isHttpUrl } from "./lib/validation";
const httpUrl = z
    .string()
    .url()
    .refine(isHttpUrl, "Use an HTTP(S) URL");
const envSchema = z.object({
    DATABASE_URL: z.string().startsWith("file:"),
    API_BASE_URL: httpUrl.transform((value) => value.replace(/\/$/, "")),
    WEB_BASE_URL: httpUrl.transform((value) => value.replace(/\/$/, "")),
    CORS_ORIGIN: httpUrl
        .default("http://localhost:3000")
        .refine((value) => new URL(value).origin === value, "Use an origin without a path or trailing slash"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    MAIL_PREVIEW_DIR: z.string().min(1).default(".mail-preview")
});
export const env = envSchema.parse(process.env);
