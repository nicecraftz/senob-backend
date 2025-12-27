export type ApiResponse<T> = {
    data: T;
    meta?: ApiMeta
}

export type ApiMeta = {
    message: string
    description: string
    context: string
}

export type ApiError = {
    error: {
        code: string
        message: string
    }
}

export function createApiError(code: string = "Server Error", message: string) : ApiError {
    return {
        error: {
            code: code,
            message: message
        }
    }
}

export function createApiResponse<T>(data: T, meta?: ApiMeta) : ApiResponse<T> {
    return {
        data: data,
        meta: meta
    }
}