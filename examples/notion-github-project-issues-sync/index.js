/* ================================================================================

	notion-github-project-issues-sync
  
  Find the official Notion API client @ https://github.com/makenotion/notion-sdk-js/

================================================================================ */

const { Client } = require("@notionhq/client")
const dotenv = require("dotenv")
const { Octokit } = require("@octokit/core");
const { paginateGraphql } = require("@octokit/plugin-paginate-graphql");
const _ = require("lodash")

dotenv.config()
const MyOctokit = Octokit.plugin(paginateGraphql);
const octokit = new MyOctokit({ auth: process.env.GITHUB_KEY })
const notion = new Client({ auth: process.env.NOTION_KEY })

const databaseId = process.env.NOTION_DATABASE_ID
const OPERATION_BATCH_SIZE = 10

/**
 * Local map to store  GitHub issue ID to its Notion pageId.
 * { [issueId: string]: string }
 */
const gitHubIssuesIdToNotionPageId = {}

/**
 * Initialize local data store.
 * Then sync with GitHub.
 */
setInitialGitHubToNotionIdMap().then(syncNotionDatabaseWithGitHub)

/**
 * Get and set the initial data store with issues currently in the database.
 */
async function setInitialGitHubToNotionIdMap() {
  const currentIssues = await getIssuesFromNotionDatabase()
  for (const { pageId, issueNumber } of currentIssues) {
    gitHubIssuesIdToNotionPageId[issueNumber] = pageId
  }
}

async function syncNotionDatabaseWithGitHub() {
  // Get the project id for the provided GitHub project number.
  console.log("\nFetching project id from GitHub...");
  const projectId = await getGitHubProjectId();
  console.log(`Project id: ${projectId}`);

  // Get all issues currently in the provided GitHub project.
  console.log("\nFetching issues from GitHub project...")
  const issues = await getGitHubIssuesForProject(projectId)
  console.log(`Fetched ${issues.length} issues from GitHub project.`)

  // Group issues into those that need to be created or updated in the Notion database.
  const { pagesToCreate, pagesToUpdate } = getNotionOperations(issues)

  // Create pages for new issues.
  console.log(`\n${pagesToCreate.length} new issues to add to Notion.`)
  await createPages(pagesToCreate)

  // Updates pages for existing issues.
  console.log(`\n${pagesToUpdate.length} issues to update in Notion.`)
  await updatePages(pagesToUpdate)

  // Success!
  console.log("\n✅ Notion database is synced with GitHub.")
}

/**
 * Gets pages from the Notion database.
 *
 * @returns {Promise<Array<{ pageId: string, issueNumber: number }>>}
 */
async function getIssuesFromNotionDatabase() {
  const pages = []
  let cursor = undefined
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    })
    pages.push(...results)
    if (!next_cursor) {
      break
    }
    cursor = next_cursor
  }
  console.log(`${pages.length} issues successfully fetched from Notion.`)

  const issues = []
  for (const page of pages) {
    const issueNumberPropertyId = page.properties["Issue Number"].id
    const propertyResult = await notion.pages.properties.retrieve({
      page_id: page.id,
      property_id: issueNumberPropertyId,
    })
    issues.push({
      pageId: page.id,
      issueNumber: propertyResult.number,
    })
  }

  return issues
}

/**
 * Gets project id given the project number and owner.
 *
 * https://docs.github.com/en/graphql/reference/objects#organization
 *
 * @returns organizationId
 */
async function getGitHubProjectId() {
  const { organization } = await octokit.graphql(`
  {
    organization(login: "${process.env.GITHUB_ORGANIZATION_NAME}") {
      projectV2(number: ${process.env.GITHUB_PROJECT_NUMBER}) {
        id
      }
    }
  }`);

  return organization?.projectV2?.id;
}

/**
 * Gets issues from a GitHub project.
 *
 * https://docs.github.com/en/graphql/reference/objects#projectv2
 * https://docs.github.com/en/graphql/reference/objects#projectv2item 
 * https://docs.github.com/en/graphql/reference/enums#projectv2itemtype
 * https://docs.github.com/en/graphql/reference/objects#projectv2itemconnection
 * https://docs.github.com/en/graphql/reference/objects#pageinfo
 * https://docs.github.com/en/graphql/reference/objects#issue
 *
 * @returns {Promise<Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>>}
 */
async function getGitHubIssuesForProject(projectId) {
  const issues = []

  const pageIterator = octokit.graphql.paginate.iterator(
    `query paginate($cursor: String) {
      node(id: "${projectId}") {
        ... on ProjectV2 {
          items(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              type
              fieldValues(first: 10) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                }
              }
              content {
                ...on Issue {
                  title
                  number
                  state
                  url
                  comments(first: 1) {
                    totalCount
                  }
                }
              }
            }
          }
        }
      }
    }`
  );

  for await (const response of pageIterator) {
    for (const issue of response?.node?.items?.nodes) {
      // Consider only issues, e.g ignore draft issues and PR's
      if (issue.type !== 'ISSUE') continue;

      let status = null;
      for (const field of issue?.fieldValues?.nodes) {
        if (field?.field?.name === 'Status') {
          status = field?.name;
        }
      }
      issues.push({
        number: issue.content?.number,
        title: issue.content?.title,
        state: status,
        comment_count: issue.content?.comments?.totalCount,
        url: issue.content.url,
      });
    }
  }

  return issues
}

/**
 * Determines which issues already exist in the Notion database.
 *
 * @param {Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>} issues
 * @returns {{
 *   pagesToCreate: Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>;
 *   pagesToUpdate: Array<{ pageId: string, number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>
 * }}
 */
function getNotionOperations(issues) {
  const pagesToCreate = []
  const pagesToUpdate = []
  for (const issue of issues) {
    const pageId = gitHubIssuesIdToNotionPageId[issue.number]
    if (pageId) {
      pagesToUpdate.push({
        ...issue,
        pageId,
      })
    } else {
      pagesToCreate.push(issue)
    }
  }
  return { pagesToCreate, pagesToUpdate }
}

/**
 * Creates new pages in Notion.
 *
 * https://developers.notion.com/reference/post-page
 *
 * @param {Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>} pagesToCreate
 */
async function createPages(pagesToCreate) {
  const pagesToCreateChunks = _.chunk(pagesToCreate, OPERATION_BATCH_SIZE)
  for (const pagesToCreateBatch of pagesToCreateChunks) {
    await Promise.all(
      pagesToCreateBatch.map(issue =>
        notion.pages.create({
          parent: { database_id: databaseId },
          properties: getPropertiesFromIssue(issue),
        })
      )
    )
    console.log(`Completed batch size: ${pagesToCreateBatch.length}`)
  }
}

/**
 * Updates provided pages in Notion.
 *
 * https://developers.notion.com/reference/patch-page
 *
 * @param {Array<{ pageId: string, number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>} pagesToUpdate
 */
async function updatePages(pagesToUpdate) {
  const pagesToUpdateChunks = _.chunk(pagesToUpdate, OPERATION_BATCH_SIZE)
  for (const pagesToUpdateBatch of pagesToUpdateChunks) {
    await Promise.all(
      pagesToUpdateBatch.map(({ pageId, ...issue }) =>
        notion.pages.update({
          page_id: pageId,
          properties: getPropertiesFromIssue(issue),
        })
      )
    )
    console.log(`Completed batch size: ${pagesToUpdateBatch.length}`)
  }
}

//*========================================================================
// Helpers
//*========================================================================

/**
 * Returns the GitHub issue to conform to this database's schema properties.
 *
 * @param {{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }} issue
 */
function getPropertiesFromIssue(issue) {
  const { title, number, state, comment_count, url } = issue
  return {
    Name: {
      title: [{ type: "text", text: { content: title } }],
    },
    "Issue Number": {
      number,
    },
    State: {
      select: { name: state },
    },
    "Number of Comments": {
      number: comment_count,
    },
    "Issue URL": {
      url,
    },
  }
}
