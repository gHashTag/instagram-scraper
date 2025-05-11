export default {
    schema: "./db/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    dbCredentials: {
        url: "./.dev/sqlite.db",
    },
    strict: true,
    verbose: true,
};
