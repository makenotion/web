# Sample Integration: GitHub Issues to Notion

<img src="https://dev.notion.so/front-static/external/readme/images/github-notion-example@2x.png" alt="drawing" width="500"/>

## About the Integration

This Notion integration syncs GitHub Issues for a specific project to a Notion Database. This integration was built using this [database template](https://www.notion.com/367cd67cfe8f49bfaf0ac21305ebb9bf?v=bc79ca62b36e4c54b655ceed4ef06ebd) and [GitHub's Octokit Library](https://github.com/octokit). Changes made to issues in the Notion database will not be reflected in GitHub. For an example which allows you to take actions based on changes in a database [go here.](https://github.com/makenotion/notion-sdk-js/tree/main/examples/database-email-update)

## Running Locally

### 1. Setup your local project

```zsh
# Clone this repository locally
git clone https://github.com/makenotion/notion-sdk-js.git

# Switch into this project
cd notion-sdk-js/examples/notion-github-project-issues-sync

# Install the dependencies
npm install
```

### 2. Set your environment variables in a `.env` file

```zsh
GITHUB_KEY=<your-github-personal-access-token>
NOTION_KEY=<your-notion-api-key>
NOTION_DATABASE_ID=<notion-database-id>
GITHUB_ORGANIZATION_NAME=<github-organization-name>
GITHUB_PROJECT_NAME=<github-project-name>
GITHUB_PROJECT_NUMBER=<github-project-number>
```

You can create your Notion API key [here](https://www.notion.com/my-integrations).

You can create your GitHub Personal Access token by following the guide [here](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).

To create a Notion database that will work with this example, duplicate [this empty database template](https://www.notion.com/367cd67cfe8f49bfaf0ac21305ebb9bf?v=bc79ca62b36e4c54b655ceed4ef06ebd).

Your Notion integration will need access to the Notion database you have created. To provide access, follow the instructions found in Notion's [Integration guide](https://developers.notion.com/docs/create-a-notion-integration#step-2-share-a-database-with-your-integration).

### 3. Run code

```zsh
node index.js
```
