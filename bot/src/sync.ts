import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import type { PrismaClient } from './db';
import { desiredRoleIds, isNoop, roleDiff, type RoleDiff } from './roles';
import type { BotConfig } from './config';

export interface SyncOutcome {
    discordId: string;
    applied: RoleDiff;
    skipped: string[];
    error?: string;
}

/**
 * Roles the bot can actually act on: configured, present in the guild, and
 * below the bot in the hierarchy. Discord answers 403 for anything above it,
 * so those are reported rather than retried forever.
 */
export function manageableRoleIds(guild: Guild, config: BotConfig): { managed: Set<string>; unreachable: string[] } {
    const me = guild.members.me;
    const managed = new Set<string>();
    const unreachable: string[] = [];

    for (const id of config.roleIds.values()) {
        const role = guild.roles.cache.get(id);
        if (!role) {
            unreachable.push(`${id} (no such role in the guild)`);
            continue;
        }
        if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
            unreachable.push(`${role.name} (above the bot in the hierarchy)`);
            continue;
        }
        managed.add(id);
    }

    return { managed, unreachable };
}

export function hasRolePermission(guild: Guild): boolean {
    return guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
}

/**
 * Bring one member in line with the database.
 */
export async function syncMember(
    member: GuildMember,
    prisma: PrismaClient,
    config: BotConfig,
    managed: Set<string>,
): Promise<SyncOutcome> {
    const link = await prisma.discordLink.findUnique({
        where: { discordId: member.id },
        include: { user: { include: { discordRoles: true } } },
    });

    const desired = desiredRoleIds(
        link ? { grantedRoleKeys: link.user.discordRoles.map((grant) => grant.roleKey) } : null,
        config.roleIds,
    );

    const diff = roleDiff(member.roles.cache.keys(), desired, managed);
    const outcome: SyncOutcome = { discordId: member.id, applied: { add: [], remove: [] }, skipped: [] };

    if (isNoop(diff)) {
        if (link) await touchSynced(prisma, link.id);
        return outcome;
    }

    try {
        if (diff.add.length) {
            await member.roles.add(diff.add, 'ZEROxWORK account linked');
            outcome.applied.add = diff.add;
        }
        if (diff.remove.length) {
            await member.roles.remove(diff.remove, 'ZEROxWORK link or grant removed');
            outcome.applied.remove = diff.remove;
        }
        if (link) await touchSynced(prisma, link.id);
    } catch (error) {
        // never log the token or the full Discord payload
        outcome.error = error instanceof Error ? error.message : 'unknown error';
    }

    return outcome;
}

async function touchSynced(prisma: PrismaClient, linkId: number): Promise<void> {
    await prisma.discordLink.update({
        where: { id: linkId },
        data: { lastSyncedAt: new Date() },
    });
}

/**
 * Walk every member of the guild. This is the pass that catches unlinks: a
 * deleted row leaves no trace to poll for, so the roles are reconciled from the
 * member list instead.
 */
export async function reconcileGuild(
    guild: Guild,
    prisma: PrismaClient,
    config: BotConfig,
): Promise<{ changed: SyncOutcome[]; failed: SyncOutcome[] }> {
    const { managed, unreachable } = manageableRoleIds(guild, config);
    if (unreachable.length) {
        console.warn(`Roles the bot cannot manage: ${unreachable.join(', ')}`);
    }
    if (managed.size === 0) {
        return { changed: [], failed: [] };
    }

    const members = await guild.members.fetch();
    const changed: SyncOutcome[] = [];
    const failed: SyncOutcome[] = [];

    for (const member of members.values()) {
        if (member.user.bot) continue;
        const outcome = await syncMember(member, prisma, config, managed);
        if (outcome.error) failed.push(outcome);
        else if (!isNoop(outcome.applied)) changed.push(outcome);
    }

    return { changed, failed };
}
