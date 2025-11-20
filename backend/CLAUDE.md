# INSTRUCTIONS FOR CLAUDE -- OHMYSERVER PROJECT

These rules are MANDATORY for any action or suggestion inside this
repository\
(code changes, migrations, terminal commands, file edits, etc.).

------------------------------------------------------------------------

## 🔐 Prisma Rules (CRITICAL)

1.  **Do NOT use `prisma db push` in this project**, unless the user
    explicitly requests it and understands the risk.

2.  All structural schema changes must be handled with:

    ``` bash
    npx prisma migrate dev --name <change_description>
    ```

    Never replace this workflow with `db push`.

3.  **Never run or suggest `npx prisma migrate reset`** unless the user
    explicitly approves and acknowledges data loss.

4.  Do not suggest or execute actions that may drop, recreate, or
    overwrite database objects.

5.  Any schema change must:

    -   be reflected in `prisma/schema.prisma`
    -   and be accompanied by a migration inside `prisma/migrations`.

6.  In production environments (CapRover, Docker):

    -   always assume the correct workflow is:

        ``` bash
        npx prisma migrate deploy
        ```

    -   Never replace this with `db push` unless explicitly requested.

------------------------------------------------------------------------

## 🗂 Handling Environments (LOCAL vs PRODUCTION)

1.  Always assume the local database may contain important real data.
2.  Before executing any command that modifies a database:
    -   ask whether it targets local or production,
    -   confirm that a backup exists,
    -   explain risks and expected impact.
3.  If drift occurs between migrations ↔ schema ↔ database:
    -   prefer solutions that avoid data loss,
    -   prefer generating new migrations,
    -   use `migrate resolve` to mark migrations as applied when needed,
    -   avoid resets or destructive schema rebuilds.

------------------------------------------------------------------------

## ⚠️ Dangerous Commands (FORBIDDEN unless explicitly approved)

Do NOT suggest or run:

-   `npx prisma migrate reset`
-   `DROP DATABASE`
-   `DROP SCHEMA`
-   `DROP TABLE`
-   `TRUNCATE <table>`
-   `DELETE FROM <table>` without a WHERE clause
-   SQL scripts that cause mass deletion or rebuild tables
-   Destructive migrations without warning and approval

If such commands are ever required: - explain the risk, - propose safer
alternatives, - request explicit confirmation.

------------------------------------------------------------------------

## 🧾 File Editing Rules

1.  Do not modify `prisma/schema.prisma` unless the user requests it.
2.  Do not delete or rename entire folders without explicit approval.
3.  Do not modify the `Dockerfile` or deploy scripts without explaining
    why.
4.  Maintain migration consistency at all times with schema and code.

------------------------------------------------------------------------

## 📦 Correct Workflow for Prisma Changes

1.  User edits or requests edits to `schema.prisma`.

2.  Claude explains the consequences and required migration.

3.  Claude generates the migration using:

    ``` bash
    npx prisma migrate dev --name <name>
    ```

4.  Validate that:

    -   the migration folder is created properly,
    -   it doesn't break data,
    -   it matches the intended schema changes.

5.  In production:

    -   remind that the migration will be applied using:

        ``` bash
        npx prisma migrate deploy
        ```

------------------------------------------------------------------------

## 🧠 Claude Working Style in This Repository

1.  Be conservative with data: **do not break anything**.
2.  Never make unilateral decisions---always ask when unsure.
3.  Before running risky operations:
    -   describe them clearly,
    -   explain potential consequences,
    -   wait for confirmation.
4.  Follow the user's communication preferences:
    -   concise,
    -   direct,
    -   no unnecessary fluff,
    -   efficient and useful.
