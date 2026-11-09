import { buildApp } from "./app";
import { env } from "./env";
const app = buildApp({ logger: true });
async function start() {
    try {
        await app.prisma.$connect();
        await app.prisma.trip.count(); // Fail early when migrations were not applied.
        await app.listen({ port: env.PORT, host: env.HOST });
    } catch (error) {
        app.log.error(error);
        await app.close();
        process.exitCode = 1;
    }
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
        void app.close().catch((error) => {
            app.log.error(error);
            process.exitCode = 1;
        });
    });
}
void start();
