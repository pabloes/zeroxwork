/**
 * The Prisma client is generated from backend/prisma/schema.prisma into the
 * backend's node_modules. The bot reuses that one instead of keeping a second
 * copy of the schema, which would drift the first time someone migrates.
 *
 * Everything Prisma-shaped in the bot imports from here, so if the layout ever
 * changes there is a single line to fix.
 */
export { PrismaClient } from '../../backend/node_modules/@prisma/client/index.js';
export type { DiscordLink, DiscordRoleGrant, User } from '../../backend/node_modules/@prisma/client/index.js';
