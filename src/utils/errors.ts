export class HTTPError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public errorCode: string = 'Server Error'
    ) {
        super(message);
        this.name = 'HTTPError';
    }
}

