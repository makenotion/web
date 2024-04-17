import {
  BlockObjectResponse,
  CommentObjectResponse,
  DatabaseObjectResponse,
  EquationRichTextItemResponse,
  MentionRichTtextItemResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  PartialCommentObjectResponse,
  PartialDatabaseObjectResponse,
  PartialPageObjectResponse,
  PartialUserObjectResponse,
  RichTextItemResponse,
  TextRichTextItemResponse,
  UserObjectResponse,
} from "./api-endpoints"

interface PaginatedArgs {
  start_cursor?: string
}

interface PaginatedList<T> {
  object: "list"
  results: T[]
  next_cursor: string | null
  has_more: boolean
}

/**
 * Returns an async iterator over the results of any paginated Notion API.
 *
 * Example (given a notion Client called `notion`):
 *
 * ```
 * for await (const block of iteratePaginatedAPI(notion.blocks.children.list, {
 *   block_id: parentBlockId,
 * })) {
 *   // Do something with block.
 * }
 * ```
 *
 * @param listFn A bound function on the Notion client that represents a conforming paginated
 *   API. Example: `notion.blocks.children.list`.
 * @param firstPageArgs Arguments that should be passed to the API on the first and subsequent
 *   calls to the API. Any necessary `next_cursor` will be automatically populated by
 *   this function. Example: `{ block_id: "<my block id>" }`
 */
export async function* iteratePaginatedAPI<Args extends PaginatedArgs, Item>(
  listFn: (args: Args) => Promise<PaginatedList<Item>>,
  firstPageArgs: Args
): AsyncIterableIterator<Item> {
  let nextCursor: string | null | undefined = firstPageArgs.start_cursor
  do {
    const response: PaginatedList<Item> = await listFn({
      ...firstPageArgs,
      start_cursor: nextCursor,
    })
    yield* response.results
    nextCursor = response.next_cursor
  } while (nextCursor)
}

/**
 * Collect all of the results of paginating an API into an in-memory array.
 *
 * Example (given a notion Client called `notion`):
 *
 * ```
 * const blocks = await collectPaginatedAPI(notion.blocks.children.list, {
 *   block_id: parentBlockId,
 * })
 * // Do something with blocks.
 * ```
 *
 * @param listFn A bound function on the Notion client that represents a conforming paginated
 *   API. Example: `notion.blocks.children.list`.
 * @param firstPageArgs Arguments that should be passed to the API on the first and subsequent
 *   calls to the API. Any necessary `next_cursor` will be automatically populated by
 *   this function. Example: `{ block_id: "<my block id>" }`
 */
export async function collectPaginatedAPI<Args extends PaginatedArgs, Item>(
  listFn: (args: Args) => Promise<PaginatedList<Item>>,
  firstPageArgs: Args
): Promise<Item[]> {
  const results: Item[] = []
  for await (const item of iteratePaginatedAPI(listFn, firstPageArgs)) {
    results.push(item)
  }
  return results
}

/**
 * @returns `true` if `response` is a full `BlockObjectResponse`.
 */
export function isFullBlock(
  response:
    | PageObjectResponse
    | PartialPageObjectResponse
    | DatabaseObjectResponse
    | PartialDatabaseObjectResponse
    | BlockObjectResponse
    | PartialBlockObjectResponse
): response is BlockObjectResponse {
  return response.object === "block" && "type" in response
}

/**
 * @returns `true` if `response` is a full `PageObjectResponse`.
 */
export function isFullPage(
  response:
    | PageObjectResponse
    | PartialPageObjectResponse
    | DatabaseObjectResponse
    | PartialDatabaseObjectResponse
    | BlockObjectResponse
    | PartialBlockObjectResponse
): response is PageObjectResponse {
  return response.object === "page" && "url" in response
}

/**
 * @returns `true` if `response` is a full `DatabaseObjectResponse`.
 */
export function isFullDatabase(
  response:
    | PageObjectResponse
    | PartialPageObjectResponse
    | DatabaseObjectResponse
    | PartialDatabaseObjectResponse
    | BlockObjectResponse
    | PartialBlockObjectResponse
): response is DatabaseObjectResponse {
  return response.object === "database" && "title" in response
}

/**
 * @returns `true` if `response` is a full `DatabaseObjectResponse` or a full
 * `PageObjectResponse`.
 */
export function isFullPageOrDatabase(
  response:
    | PageObjectResponse
    | PartialPageObjectResponse
    | DatabaseObjectResponse
    | PartialDatabaseObjectResponse
    | BlockObjectResponse
    | PartialBlockObjectResponse
): response is DatabaseObjectResponse | PageObjectResponse {
  if (response.object === "database") {
    return isFullDatabase(response)
  } else {
    return isFullPage(response)
  }
}

/**
 * @returns `true` if `response` is a full `UserObjectResponse`.
 */
export function isFullUser(
  response: UserObjectResponse | PartialUserObjectResponse
): response is UserObjectResponse {
  return "type" in response
}

/**
 * @returns `true` if `response` is a full `CommentObjectResponse`.
 */
export function isFullComment(
  response: CommentObjectResponse | PartialCommentObjectResponse
): response is CommentObjectResponse {
  return "created_by" in response
}

/**
 * @returns `true` if `richText` is a `TextRichTextItemResponse`.
 */
export function isTextRichTextItemResponse(
  richText: RichTextItemResponse
): richText is TextRichTextItemResponse {
  return richText.type === "text"
}

/**
 * @returns `true` if `richText` is an `EquationRichTextItemResponse`.
 */
export function isEquationRichTextItemResponse(
  richText: RichTextItemResponse
): richText is EquationRichTextItemResponse {
  return richText.type === "equation"
}

/**
 * @returns `true` if `richText` is an `MentionRichTextItemResponse`.
 */
export function isMentionRichTextItemResponse(
  richText: RichTextItemResponse
): richText is MentionRichTtextItemResponse {
  return richText.type === "mention"
}
