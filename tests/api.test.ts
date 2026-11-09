import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { Confirmation } from "../src/lib/mail";

process.env.NODE_ENV = "test";
const directory = mkdtempSync(join(tmpdir(), "planner-api-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
process.env.API_BASE_URL = "http://localhost:3333";
process.env.WEB_BASE_URL = "http://localhost:3000";
process.env.CORS_ORIGIN = "http://localhost:3000";
const prisma = new PrismaClient();
let app: FastifyInstance;
let buildApp: typeof import("../src/app").buildApp;
let messages: Confirmation[] = [];
const future = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
};
const body = () => ({
    destination: "São Paulo",
    starts_at: future(5),
    ends_at: future(7),
    owner_name: "Test Owner",
    owner_email: "owner@example.test",
    emails_to_invite: ["guest@example.test"]
});
const post = (url: string, payload: object, target = app) => target.inject({ method: "POST", url, payload });
async function create(payload = body()) {
    const response = await post("/trips", payload);
    assert.equal(response.statusCode, 200, response.body);
    return response.json<{ tripId: string }>().tripId;
}
async function confirm(id: string) {
    const response = await app.inject(`/trips/${id}/confirm`);
    assert.equal(response.statusCode, 302, response.body);
}
before(async () => {
    execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
        env: process.env,
        stdio: "pipe"
    });
    ({ buildApp } = await import("../src/app.js"));
    app = buildApp({
        prisma,
        mail: {
            async sendConfirmation(message) {
                messages.push(message);
            }
        }
    });
    await app.ready();
});
beforeEach(async () => {
    await prisma.link.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.participant.deleteMany();
    await prisma.trip.deleteMany();
    messages = [];
});
after(async () => {
    await app?.close();
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
});

test("complete trip, participant, activity, link, invitation and update flow", async () => {
    const tripId = await create();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].link, `http://localhost:3333/trips/${tripId}/confirm`);
    let detail = await app.inject(`/trips/${tripId}`);
    assert.equal(detail.json().trip.is_confirmed, false);
    await confirm(tripId);
    assert.equal(messages.length, 2);
    await confirm(tripId);
    assert.equal(messages.length, 2, "confirming again must not duplicate invitations");
    const participants = (await app.inject(`/trips/${tripId}/participants`)).json().participants;
    assert.equal(participants.length, 2);
    const guest = participants.find((p: { email: string }) => p.email === "guest@example.test");
    const confirmation = await app.inject(`/participants/${guest.id}/confirm`);
    assert.equal(confirmation.statusCode, 302);
    assert.equal(confirmation.headers.location, `http://localhost:3000/trips/${tripId}`);
    assert.equal((await app.inject(`/participants/${guest.id}`)).json().participant.is_confirmed, true);
    assert.equal((await app.inject(`/participants/${guest.id}/confirm`)).statusCode, 302);
    const activity = await post(`/trips/${tripId}/activities`, { title: "City tour", occurs_at: future(6) });
    assert.equal(activity.statusCode, 201, activity.body);
    const days = (await app.inject(`/trips/${tripId}/activities`)).json().activities;
    assert.equal(days.length, 3);
    assert.equal(days.flatMap((day: { activities: object[] }) => day.activities).length, 1);
    assert.equal(
        (await post(`/trips/${tripId}/links`, { title: "Hotel booking", url: "https://example.test/booking" }))
            .statusCode,
        201
    );
    assert.equal((await app.inject(`/trips/${tripId}/links`)).json().links.length, 1);
    const invite = await post(`/trips/${tripId}/invites`, { email: "new@example.test" });
    assert.equal(invite.statusCode, 201, invite.body);
    assert.equal((await app.inject(`/participants/${invite.json().participantId}/confirm`)).statusCode, 302);
    const update = await app.inject({
        method: "PUT",
        url: `/trips/${tripId}`,
        payload: { destination: "Rio de Janeiro", starts_at: future(5), ends_at: future(8) }
    });
    assert.equal(update.statusCode, 200, update.body);
    detail = await app.inject(`/trips/${tripId}`);
    assert.equal(detail.json().trip.destination, "Rio de Janeiro");
    assert.equal(detail.json().trip.is_confirmed, true);
});

test("partial-day trips include final calendar day in UTC regardless of process timezone", async () => {
    const starts = future(5).replace("00:00:00", "18:00:00");
    const ends = future(6).replace("00:00:00", "08:00:00");
    const id = await create({ ...body(), starts_at: starts, ends_at: ends });
    assert.equal((await post(`/trips/${id}/activities`, { title: "Final day", occurs_at: ends })).statusCode, 201);
    const days = (await app.inject(`/trips/${id}/activities`)).json().activities;
    assert.equal(days.length, 2);
    assert.equal(days[1].activities.length, 1);
    assert.equal(days[0].date, future(5));
});

for (const [name, changes] of Object.entries({
    "invalid date": { starts_at: "invalid" },
    "null date": { starts_at: null },
    "numeric date": { starts_at: 123 },
    "date without timezone": { starts_at: "2099-01-01 12:00:00" },
    "past date": { starts_at: "2000-01-01T00:00:00Z" },
    "reversed dates": { starts_at: future(8), ends_at: future(7) },
    "blank owner": { owner_name: "  " },
    "blank destination": { destination: "    " },
    "excessive date span": { ends_at: future(400) }
}))
    test(`create rejects ${name} without persisting a trip`, async () => {
        const response = await post("/trips", { ...body(), ...changes });
        assert.equal(response.statusCode, 400, response.body);
        assert.equal(await prisma.trip.count(), 0);
    });

test("activities accept exact boundaries and reject dates outside trip", async () => {
    const id = await create();
    for (const occurs_at of [future(5), future(7)])
        assert.equal((await post(`/trips/${id}/activities`, { title: "Boundary", occurs_at })).statusCode, 201);
    for (const occurs_at of [future(4), future(8), "invalid", null])
        assert.equal((await post(`/trips/${id}/activities`, { title: "Outside", occurs_at })).statusCode, 400);
    assert.equal(await prisma.activity.count(), 2);
});

test("update refuses dates which would exclude existing activities", async () => {
    const id = await create();
    await post(`/trips/${id}/activities`, { title: "Final activity", occurs_at: future(7) });
    const response = await app.inject({
        method: "PUT",
        url: `/trips/${id}`,
        payload: { destination: "Changed", starts_at: future(5), ends_at: future(6) }
    });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id } })).destination, "São Paulo");
    for (const payload of [
        { destination: "Changed", starts_at: future(8), ends_at: future(7) },
        { destination: "Changed", starts_at: null, ends_at: future(7) }
    ]) {
        assert.equal((await app.inject({ method: "PUT", url: `/trips/${id}`, payload })).statusCode, 400);
    }
});

test("all resource routes return 404 for absent UUIDs and 400 for invalid UUIDs", async () => {
    for (const id of [randomUUID(), "invalid"]) {
        const expected = id === "invalid" ? 400 : 404;
        for (const url of [
            `/trips/${id}`,
            `/trips/${id}/confirm`,
            `/trips/${id}/activities`,
            `/trips/${id}/participants`,
            `/trips/${id}/links`,
            `/participants/${id}`,
            `/participants/${id}/confirm`
        ]) {
            const result = await app.inject(url);
            assert.equal(result.statusCode, expected, `${url}: ${result.body}`);
        }
        for (const [url, payload] of [
            [`/trips/${id}/activities`, { title: "Activity", occurs_at: future(6) }],
            [`/trips/${id}/links`, { title: "Link title", url: "https://example.test" }],
            [`/trips/${id}/invites`, { email: "guest@example.test" }]
        ] as const)
            assert.equal((await post(url, payload)).statusCode, expected);
        assert.equal(
            (
                await app.inject({
                    method: "PUT",
                    url: `/trips/${id}`,
                    payload: { destination: "Changed", starts_at: future(5), ends_at: future(7) }
                })
            ).statusCode,
            expected
        );
    }
});

test("normalizes and deduplicates invitations; confirmed trip is required", async () => {
    const id = await create({
        ...body(),
        owner_email: "OWNER@example.test",
        emails_to_invite: ["OWNER@example.test", "Guest@example.test", "guest@example.test"]
    });
    assert.equal(await prisma.participant.count(), 2);
    const guest = await prisma.participant.findFirstOrThrow({ where: { email: "guest@example.test" } });
    assert.equal((await app.inject(`/participants/${guest.id}/confirm`)).statusCode, 409);
    assert.equal((await post(`/trips/${id}/invites`, { email: "new@example.test" })).statusCode, 409);
    await confirm(id);
    const count = messages.length;
    assert.equal((await post(`/trips/${id}/invites`, { email: "GUEST@example.test" })).statusCode, 409);
    assert.equal(await prisma.participant.count(), 2);
    assert.equal(messages.length, count);
});

test("trip-related collections and date validation stay within the requested trip", async () => {
    const first = await create();
    const second = await create({ ...body(), starts_at: future(10), ends_at: future(12) });
    await post(`/trips/${first}/activities`, { title: "First activity", occurs_at: future(6) });
    await post(`/trips/${first}/links`, { title: "First link", url: "https://example.test" });
    assert.equal(
        (await post(`/trips/${second}/activities`, { title: "Wrong dates", occurs_at: future(6) })).statusCode,
        400
    );
    assert.equal((await app.inject(`/trips/${second}/links`)).json().links.length, 0);
    assert.equal(
        (await app.inject(`/trips/${second}/activities`))
            .json()
            .activities.flatMap((day: { activities: object[] }) => day.activities).length,
        0
    );
    const ids1 = (await app.inject(`/trips/${first}/participants`))
        .json()
        .participants.map((p: { id: string }) => p.id);
    const ids2 = (await app.inject(`/trips/${second}/participants`))
        .json()
        .participants.map((p: { id: string }) => p.id);
    assert.equal(
        ids1.some((id: string) => ids2.includes(id)),
        false
    );
});

test("preview failure rolls back trip, confirmation and invitation writes", async () => {
    const failingApp = buildApp({
        prisma,
        mail: {
            async sendConfirmation() {
                throw new Error("Private filesystem failure");
            }
        }
    });
    try {
        const failed = await post("/trips", body(), failingApp);
        assert.equal(failed.statusCode, 500);
        assert.deepEqual(failed.json(), { message: "Internal server error" });
        assert.equal(await prisma.trip.count(), 0);
        const id = await create();
        assert.equal((await failingApp.inject(`/trips/${id}/confirm`)).statusCode, 500);
        assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id } })).is_confirmed, false);
        await confirm(id);
        assert.equal(
            (await post(`/trips/${id}/invites`, { email: "failed@example.test" }, failingApp)).statusCode,
            500
        );
        assert.equal(await prisma.participant.count(), 2);
    } finally {
        await failingApp.close();
    }
});

test("local email previews escape HTML and contain working local confirmation URLs", async () => {
    const { createPreviewMailClient } = await import("../src/lib/mail.js");
    const previewDir = join(directory, "previews");
    const previewApp = buildApp({ prisma, mail: createPreviewMailClient(previewDir) });
    try {
        const response = await post("/trips", { ...body(), destination: '<img src=x onerror="bad()">' }, previewApp);
        assert.equal(response.statusCode, 200, response.body);
        const preview = JSON.parse(readFileSync(join(previewDir, readdirSync(previewDir)[0]), "utf8"));
        assert.equal(preview.html.includes("<img"), false);
        assert.match(preview.html, /&lt;img/);
        assert.equal((await previewApp.inject(new URL(preview.link).pathname)).statusCode, 302);
    } finally {
        await previewApp.close();
    }
});

test("only HTTP(S) links, valid JSON and explicit CORS origin are accepted", async () => {
    const id = await create();
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "ftp://example.test/file"])
        assert.equal((await post(`/trips/${id}/links`, { title: "Unsafe link", url })).statusCode, 400);
    const malformed = await app.inject({
        method: "POST",
        url: "/trips",
        headers: { "content-type": "application/json" },
        payload: "{"
    });
    assert.equal(malformed.statusCode, 400, malformed.body);
    const allowed = await app.inject({
        method: "OPTIONS",
        url: "/trips",
        headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" }
    });
    assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:3000");
    const foreign = await app.inject({
        method: "OPTIONS",
        url: "/trips",
        headers: { origin: "https://evil.example", "access-control-request-method": "POST" }
    });
    assert.notEqual(foreign.headers["access-control-allow-origin"], "https://evil.example");
});

test("upgrade migration merges legacy duplicate emails while preserving owner and confirmed IDs", async () => {
    const schemaDir = join(directory, "legacy");
    const migrationsDir = join(schemaDir, "migrations");
    const initial = "20240815172712_create_project_tables";
    const upgrade = "20261109000000_unique_trip_participant";
    mkdirSync(join(migrationsDir, initial), { recursive: true });
    copyFileSync("prisma/schema.prisma", join(schemaDir, "schema.prisma"));
    copyFileSync("prisma/migrations/migration_lock.toml", join(migrationsDir, "migration_lock.toml"));
    copyFileSync(`prisma/migrations/${initial}/migration.sql`, join(migrationsDir, initial, "migration.sql"));
    const databaseUrl = `file:${join(schemaDir, "legacy.db")}`;
    const migrate = () =>
        execFileSync(
            process.execPath,
            [
                resolve("node_modules/prisma/build/index.js"),
                "migrate",
                "deploy",
                "--schema",
                join(schemaDir, "schema.prisma")
            ],
            { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" }
        );
    migrate();
    const legacy = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
        const trip = await legacy.trip.create({
            data: {
                destination: "Legacy trip",
                starts_at: new Date(future(5)),
                ends_at: new Date(future(7)),
                participants: {
                    create: [
                        { id: "owner-id", email: "Owner@EXAMPLE.test", is_owner: true, is_confirmed: true },
                        { id: "duplicate-owner-id", email: "owner@example.test" },
                        { id: "confirmed-id", email: "GUEST@example.test", is_confirmed: true },
                        { id: "duplicate-guest-id", email: "guest@example.test" }
                    ]
                }
            }
        });
        mkdirSync(join(migrationsDir, upgrade));
        copyFileSync(`prisma/migrations/${upgrade}/migration.sql`, join(migrationsDir, upgrade, "migration.sql"));
        migrate();
        const participants = await legacy.participant.findMany({
            where: { trip_id: trip.id },
            orderBy: { email: "asc" }
        });
        assert.deepEqual(
            participants.map((p) => [p.id, p.email]),
            [
                ["confirmed-id", "guest@example.test"],
                ["owner-id", "owner@example.test"]
            ]
        );
        await assert.rejects(legacy.participant.create({ data: { email: "guest@example.test", trip_id: trip.id } }), {
            code: "P2002"
        });
    } finally {
        await legacy.$disconnect();
    }
});


test("browser preflight permits PUT updates from the configured frontend origin", async () => {
    const response = await app.inject({
        method: "OPTIONS",
        url: "/trips/" + randomUUID(),
        headers: {
            origin: "http://localhost:3000",
            "access-control-request-method": "PUT",
            "access-control-request-headers": "content-type"
        }
    });
    assert.equal(response.statusCode, 204);
    assert.ok(String(response.headers["access-control-allow-methods"]).split(",").map(x => x.trim()).includes("PUT"));
    assert.equal(response.headers["access-control-allow-origin"], "http://localhost:3000");
});

test("malformed link URLs are client errors, never unhandled server errors", async () => {
    const tripId = await create();
    await confirm(tripId);
    for (const url of ["not a url", "://", "https://"]) {
        const response = await post("/trips/" + tripId + "/links", { title: "Invalid link", url });
        assert.equal(response.statusCode, 400, response.body);
    }
});
