// Find the official Notion API client @ https://github.com/makenotion/notion-sdk-js/
// npm install @notionhq/client
import { Client } from "@notionhq/client"
import { config } from "dotenv"
import { setApiKey, send } from "@sendgrid/mail"

config()

setApiKey(process.env.SENDGRID_KEY)
const notion = new Client({ auth: process.env.NOTION_KEY })

const database_id = process.env.NOTION_DATABASE_ID

async function findChangesAndSendEmails(tasksInDatabase) {
  console.log("Looking for changes in Notion database ")
  // Get the tasks currently in the database
  const currTasksInDatabase = await getTasksFromDatabase()

  // Iterate over the current tasks and compare them to tasks in our local store (tasksInDatabase)
  for (const [page_id, value] of Object.entries(currTasksInDatabase)) {
    const current_status = value.Status
    // If this task hasn't been seen before
    if (!(page_id in tasksInDatabase)) {
      // Add this task to the local store of all tasks
      tasksInDatabase[page_id] = {
        Status: current_status,
      }
    }
    // else if the current status is different from the status in the local store
    else if (current_status !== tasksInDatabase[page_id].Status) {
      // Change the local store.
      tasksInDatabase[page_id] = {
        Status: current_status,
      }
      // Send an email about this change.
      const msg = {
        to: process.env.EMAIL_TO_FIELD,
        from: process.env.EMAIL_FROM_FIELD,
        subject: "Notion Task Status Updated",
        text: `A Notion task's ${value.Status} status has been updated to ${current_status}.`,
      }
      send(msg)
        .then(() => {
          console.log("Email Sent")
        })
        .catch(error => {
          console.error(error)
        })
      console.log("Status Changed")
    }
  }
  // Run this method every 5 seconds (5000 milliseconds)
  setTimeout(main, 5000)
}

// Get a paginated list of Tasks currently in a the database.
async function getTasksFromDatabase() {
  const tasks = {}

  async function getPageOfTasks(cursor) {
    // while there are more pages left in the query, get pages from the database.
    const db = await notion.databases.query({
      database_id,
      start_cursor: cursor,
    })
    for (const page of db.results) {
      tasks[page.id] = {
        Status: page.properties.Status
          ? page.properties.Status.select.name
          : "No Status",
        Title: page.properties.Name.title[0].text.content,
      }
    }
    if (db.has_more) {
      await getPageOfTasks(db.next_cursor)
    }
  }
  await getPageOfTasks()
  return tasks
}

async function main() {
  const tasksInDatabase = await getTasksFromDatabase()
  findChangesAndSendEmails(tasksInDatabase).catch(console.error)
}

main()
