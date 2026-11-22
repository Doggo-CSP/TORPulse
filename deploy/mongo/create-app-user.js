// Runs once, when the MongoDB data volume is first created (docker-entrypoint-initdb.d).
// Creates the account the application uses (ASVS V13.2.1, V13.2.2, V13.2.3): its own
// generated password, and only readWrite on the TORPulse database. No admin, no other
// databases, no user management. The root account is only for maintenance.
const fs = require('fs')

const dbName = process.env.MONGO_APP_DB
const password = fs.readFileSync(process.env.MONGO_APP_PASSWORD_FILE, 'utf8').trim()

db.getSiblingDB(dbName).createUser({
  user: 'torpulse_app',
  pwd: password,
  roles: [{ role: 'readWrite', db: dbName }],
})
print(`created torpulse_app with readWrite on ${dbName}`)
