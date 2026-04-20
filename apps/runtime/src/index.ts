import { createApp } from "./app.js"
import { appConfig } from "./config.js"

const app = await createApp()

app.listen(appConfig.port)

console.log(`Planetnik Runtime listening on http://localhost:${appConfig.port}`)
console.log(`Environment: ${appConfig.nodeEnv}`)
console.log(`Trusted origins: ${appConfig.corsOrigins.join(", ")}`)
