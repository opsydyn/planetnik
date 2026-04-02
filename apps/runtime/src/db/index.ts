import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { appConfig } from "../config.js"
import { account, session, user, verification } from "./schema/auth.js"
import { report, workspace } from "./schema/app.js"

const sql = neon(appConfig.databaseUrl)

export const db = drizzle(sql, {
  schema: {
    account,
    report,
    session,
    user,
    verification,
    workspace,
  },
})
