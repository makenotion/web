import { isObject } from "./utils"
import { Assert } from "./type-utils"

/**
 * Error codes returned in responses from the API.
 */
export enum APIErrorCode {
  Unauthorized = "unauthorized",
  RestrictedResource = "restricted_resource",
  ObjectNotFound = "object_not_found",
  RateLimited = "rate_limited",
  InvalidJSON = "invalid_json",
  InvalidRequestURL = "invalid_request_url",
  InvalidRequest = "invalid_request",
  ValidationError = "validation_error",
  ConflictError = "conflict_error",
  InternalServerError = "internal_server_error",
  ServiceUnavailable = "service_unavailable",
}

/**
 * Error codes generated for client errors.
 */
export enum ClientErrorCode {
  RequestTimeout = "notionhq_client_request_timeout",
  ResponseError = "notionhq_client_response_error",
}

/**
 * Error codes on errors thrown by the `Client`.
 */
export type NotionErrorCode = APIErrorCode | ClientErrorCode

/**
 * Base error type.
 */
abstract class NotionClientErrorBase<
  Code extends NotionErrorCode
> extends Error {
  abstract code: Code
}

/**
 * Error type that encompasses all the kinds of errors that the Notion client will throw.
 */
export type NotionClientError =
  | RequestTimeoutError
  | UnknownHTTPResponseError
  | APIResponseError

// Assert that NotionClientError's `code` property is a narrow type.
// This prevents us from accidentally regressing to `string`-typed name field.
type _assertCodeIsNarrow = Assert<NotionErrorCode, NotionClientError["code"]>

// Assert that the type of `name` in NotionErrorCode is a narrow type.
// This prevents us from accidentally regressing to `string`-typed name field.
type _assertNameIsNarrow = Assert<
  "RequestTimeoutError" | "UnknownHTTPResponseError" | "APIResponseError",
  NotionClientError["name"]
>

/**
 * @param error any value, usually a caught error.
 * @returns `true` if error is a `NotionClientError`.
 */
export function isNotionClientError(
  error: unknown
): error is NotionClientError {
  return isObject(error) && error instanceof NotionClientErrorBase
}

/**
 * Narrows down the types of a NotionClientError.
 * @param error any value, usually a caught error.
 * @param codes an object mapping from possible error codes to `true`
 * @returns `true` if error is a `NotionClientError` with a code in `codes`.
 */
function isNotionClientErrorWithCode<Code extends NotionErrorCode>(
  error: unknown,
  codes: { [C in Code]: true }
): error is NotionClientError & { code: Code } {
  return isNotionClientError(error) && error.code in codes
}

/**
 * Error thrown by the client if a request times out.
 */
export class RequestTimeoutError extends NotionClientErrorBase<ClientErrorCode.RequestTimeout> {
  readonly code = ClientErrorCode.RequestTimeout
  readonly name = "RequestTimeoutError"

  constructor(message = "Request to Notion API has timed out") {
    super(message)
  }

  static isRequestTimeoutError(error: unknown): error is RequestTimeoutError {
    return isNotionClientErrorWithCode(error, {
      [ClientErrorCode.RequestTimeout]: true,
    })
  }

  static rejectAfterTimeout<T>(
    promise: Promise<T>,
    timeoutMS: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new RequestTimeoutError())
      }, timeoutMS)

      promise
        .then(resolve)
        .catch(reject)
        .then(() => clearTimeout(timeoutId))
    })
  }
}

type HTTPResponseErrorCode = ClientErrorCode.ResponseError | APIErrorCode

class HTTPResponseError<
  Code extends HTTPResponseErrorCode
> extends NotionClientErrorBase<Code> {
  readonly name: string = "HTTPResponseError"
  readonly code: Code
  readonly status: number
  readonly headers: Headers
  readonly body: string

  constructor(args: {
    code: Code
    status: number
    message: string
    headers: Headers
    rawBodyText: string
  }) {
    super(args.message)
    const { code, status, headers, rawBodyText } = args
    this.code = code
    this.status = status
    this.headers = headers
    this.body = rawBodyText
  }
}

const httpResponseErrorCodes: { [C in HTTPResponseErrorCode]: true } = {
  [ClientErrorCode.ResponseError]: true,
  [APIErrorCode.Unauthorized]: true,
  [APIErrorCode.RestrictedResource]: true,
  [APIErrorCode.ObjectNotFound]: true,
  [APIErrorCode.RateLimited]: true,
  [APIErrorCode.InvalidJSON]: true,
  [APIErrorCode.InvalidRequestURL]: true,
  [APIErrorCode.InvalidRequest]: true,
  [APIErrorCode.ValidationError]: true,
  [APIErrorCode.ConflictError]: true,
  [APIErrorCode.InternalServerError]: true,
  [APIErrorCode.ServiceUnavailable]: true,
}

export function isHTTPResponseError(
  error: unknown
): error is UnknownHTTPResponseError | APIResponseError {
  if (!isNotionClientErrorWithCode(error, httpResponseErrorCodes)) {
    return false
  }

  type _assert = Assert<
    UnknownHTTPResponseError | APIResponseError,
    typeof error
  >

  return true
}

/**
 * Error thrown if an API call responds with an unknown error code, or does not respond with
 * a property-formatted error.
 */
export class UnknownHTTPResponseError extends HTTPResponseError<ClientErrorCode.ResponseError> {
  readonly name = "UnknownHTTPResponseError"

  constructor(args: {
    status: number
    message: string | undefined
    headers: Headers
    rawBodyText: string
  }) {
    super({
      ...args,
      code: ClientErrorCode.ResponseError,
      message:
        args.message ??
        `Request to Notion API failed with status: ${args.status}`,
    })
  }

  static isUnknownHTTPResponseError(
    error: unknown
  ): error is UnknownHTTPResponseError {
    return isNotionClientErrorWithCode(error, {
      [ClientErrorCode.ResponseError]: true,
    })
  }
}

const apiErrorCodes: { [C in APIErrorCode]: true } = {
  [APIErrorCode.Unauthorized]: true,
  [APIErrorCode.RestrictedResource]: true,
  [APIErrorCode.ObjectNotFound]: true,
  [APIErrorCode.RateLimited]: true,
  [APIErrorCode.InvalidJSON]: true,
  [APIErrorCode.InvalidRequestURL]: true,
  [APIErrorCode.InvalidRequest]: true,
  [APIErrorCode.ValidationError]: true,
  [APIErrorCode.ConflictError]: true,
  [APIErrorCode.InternalServerError]: true,
  [APIErrorCode.ServiceUnavailable]: true,
}

/**
 * A response from the API indicating a problem.
 * Use the `code` property to handle various kinds of errors. All its possible values are in `APIErrorCode`.
 */
export class APIResponseError extends HTTPResponseError<APIErrorCode> {
  readonly name = "APIResponseError"

  static isAPIResponseError(error: unknown): error is APIResponseError {
    return isNotionClientErrorWithCode(error, apiErrorCodes)
  }
}

export function buildRequestError(
  response: Response,
  bodyText: string
): APIResponseError | UnknownHTTPResponseError {
  const apiErrorResponseBody = parseAPIErrorResponseBody(bodyText)
  if (apiErrorResponseBody !== undefined) {
    return new APIResponseError({
      code: apiErrorResponseBody.code,
      message: apiErrorResponseBody.message,
      headers: response.headers,
      status: response.status,
      rawBodyText: bodyText,
    })
  }
  return new UnknownHTTPResponseError({
    message: undefined,
    headers: response.headers,
    status: response.status,
    rawBodyText: bodyText,
  })
}

function parseAPIErrorResponseBody(
  body: string
): { code: APIErrorCode; message: string } | undefined {
  if (typeof body !== "string") {
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (parseError) {
    return
  }

  if (
    !isObject(parsed) ||
    typeof parsed["message"] !== "string" ||
    !isAPIErrorCode(parsed["code"])
  ) {
    return
  }

  return {
    ...parsed,
    code: parsed["code"],
    message: parsed["message"],
  }
}

function isAPIErrorCode(code: unknown): code is APIErrorCode {
  return typeof code === "string" && code in apiErrorCodes
}
