import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
export interface Confirmation {
    to: string;
    destination: string;
    startsAt: Date;
    endsAt: Date;
    link: string;
    kind: "trip" | "participant";
}
export interface MailClient {
    sendConfirmation(message: Confirmation): Promise<void>;
}
export function escapeHtml(value: string) {
    return value.replace(
        /[&<>"']/g,
        (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
    );
}
// Local previews only: this module never contacts an SMTP service.
export function createPreviewMailClient(directory: string): MailClient {
    return {
        async sendConfirmation(message) {
            await mkdir(directory, { recursive: true });
            const html = `<p>Confirme ${message.kind === "trip" ? "sua viagem" : "sua participação"} para <strong>${escapeHtml(message.destination)}</strong>, de ${message.startsAt.toISOString()} até ${message.endsAt.toISOString()}.</p><a href="${escapeHtml(message.link)}">Confirmar</a>`;
            await writeFile(join(directory, `${randomUUID()}.json`), JSON.stringify({ ...message, html }, null, 2), {
                encoding: "utf8",
                mode: 0o600,
                flag: "wx"
            });
        }
    };
}
