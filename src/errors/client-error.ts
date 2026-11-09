export class ClientError extends Error {
    constructor(
        message: string,
        public readonly statusCode = 400,
        public readonly code = "CLIENT_ERROR"
    ) {
        super(message);
    }
}
