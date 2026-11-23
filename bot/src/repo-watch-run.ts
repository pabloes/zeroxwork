/**
 * The weekly pass: look at each watched project's repository, and when the
 * week holds something worth a player's attention, post a devlog in that
 * game's channel.
 *
 * Nothing is configured here, and nothing is configured in `repo_watches`
 * either. A game is set up entirely on its portfolio item -- `repoUrl` says
 * which repository, `discordChannelId` says which channel -- so there is one
 * form to fill and one place to look. This pass reads the projects that carry
 * both and writes itself a `repo_watches` row to remember how far it got.
 */

import { PermissionFlagsBits, type Client, type TextChannel } from 'discord.js';
import type { PrismaClient } from './db';
import type { BotConfig } from './config';
import { fetchRange, GitHubError } from './github.js';
import { assess, buildTemplatePost, isDue, parseGitHubRepo, type PostInput } from './repo-watch.js';
import { writeDevlog } from './devlog.js';

type Log = (message: string) => Promise<void>;

interface WatchState {
    branch: string | null;
    lastSha: string | null;
    lastCheckedAt: Date | null;
    lastError: string | null;
    enabled: boolean;
}

interface WatchProject {
    id: number;
    title: string;
    repoUrl: string | null;
    siteUrl: string | null;
    discordChannelId: string | null;
    repoWatch: WatchState | null;
}

async function sendPost(client: Client, channelId: string, content: string): Promise<void> {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.isDMBased()) {
        throw new Error(`channel ${channelId} is not a text channel in the server`);
    }
    const text = channel as TextChannel;
    const me = text.guild.members.me ?? await text.guild.members.fetchMe();
    if (!text.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        throw new Error(`the bot cannot write in #${text.name}`);
    }
    // No mentions from text a model wrote: a devlog has no business pinging
    // anybody, and @everyone in a generated post would be unrecoverable.
    await text.send({ content, allowedMentions: { parse: [] } });
}

/** The bot owns this row, so it creates it the first time it needs one. */
async function remember(
    prisma: PrismaClient,
    projectId: number,
    data: { lastSha?: string; lastPostedAt?: Date; lastError: string | null },
): Promise<void> {
    const now = new Date();
    await prisma.repoWatch.upsert({
        where: { projectId },
        create: { projectId, lastCheckedAt: now, ...data },
        update: { lastCheckedAt: now, ...data },
    });
}

async function runOne(
    project: WatchProject,
    client: Client,
    prisma: PrismaClient,
    config: BotConfig,
    log: Log,
): Promise<void> {
    const { repoWatch } = config;
    const repo = parseGitHubRepo(project.repoUrl);
    if (!repo) {
        throw new Error(`"${project.repoUrl ?? 'no repository'}" is not a GitHub repository`);
    }
    const channelId = project.discordChannelId!;
    const state = project.repoWatch;

    const range = await fetchRange(repo, state?.branch ?? null, state?.lastSha ?? null, repoWatch.githubToken);
    if (!range) {
        await remember(prisma, project.id, { lastError: null });
        console.log(`[repo-watch] ${repo}: nothing new`);
        return;
    }

    const assessment = assess(range);
    if (!assessment.worthPosting) {
        // lastSha deliberately stays where it is: next week carries what piled
        // up here, instead of a quiet week swallowing it.
        await remember(prisma, project.id, { lastError: null });
        console.log(`[repo-watch] ${repo}: nothing to announce -- ${assessment.reason}`);
        return;
    }

    const input: PostInput = {
        gameName: project.title,
        range,
        assessment,
        siteUrl: project.siteUrl,
    };

    let content: string;
    let writtenBy = 'template';
    try {
        const written = await writeDevlog(input, repoWatch.anthropicKey, repoWatch.model);
        if (written) {
            content = written.text;
            writtenBy = written.model;
        } else {
            content = buildTemplatePost(input);
        }
    } catch (error) {
        // A model that would not or could not write is no reason to lose the
        // week: the commit subjects still say what happened.
        await log(`Devlog for ${repo} fell back to the plain list: ${error instanceof Error ? error.message : 'unknown error'}`);
        content = buildTemplatePost(input);
    }

    if (repoWatch.dryRun) {
        const preview = `**[dry run]** devlog for \`${repo}\`, meant for <#${channelId}>, written by ${writtenBy}:\n\n${content}`;
        if (config.logChannelId) {
            await sendPost(client, config.logChannelId, preview.slice(0, 2000));
        } else {
            console.log(preview);
        }
        // Nothing went out to the players, so nothing is marked as reported:
        // a dry run can be read, corrected and run again on the same week.
        await remember(prisma, project.id, { lastError: null });
        return;
    }

    await sendPost(client, channelId, content);
    // Only now, and in one write: the range is reported, so it can never go
    // out twice.
    await remember(prisma, project.id, {
        lastSha: range.headSha,
        lastPostedAt: new Date(),
        lastError: null,
    });
    await log(`Devlog posted for ${repo} in <#${channelId}>, written by ${writtenBy}`);
}

/**
 * Runs often; acts on a project only when its week is up. The cadence lives in
 * `lastCheckedAt` rather than in a timer, so a deploy -- which restarts the
 * bot -- neither skips a week nor fires one early.
 */
export async function repoWatchPass(
    client: Client,
    prisma: PrismaClient,
    config: BotConfig,
    log: Log,
): Promise<void> {
    const projects = await prisma.project.findMany({
        where: {
            published: true,
            repoUrl: { not: null },
            discordChannelId: { not: null },
        },
        select: {
            id: true,
            title: true,
            repoUrl: true,
            siteUrl: true,
            discordChannelId: true,
            repoWatch: {
                select: { branch: true, lastSha: true, lastCheckedAt: true, lastError: true, enabled: true },
            },
        },
    }) as WatchProject[];

    const now = new Date();
    for (const project of projects) {
        // A row the admin switched off: the configuration stays on the project,
        // and this is the one thing that pauses it without clearing it.
        if (project.repoWatch && !project.repoWatch.enabled) continue;
        if (!isDue(project.repoWatch?.lastCheckedAt ?? null, now, config.repoWatch.everyMs)) continue;

        try {
            await runOne(project, client, prisma, config, log);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            // lastCheckedAt moves on a failure too, through `remember`, except
            // here: a failure is usually a token or a permission, and the next
            // pass should retry in an hour rather than in a week. The log only
            // speaks when the error changes, so a broken setup says so once
            // and then stays quiet.
            const isNew = project.repoWatch?.lastError !== message;
            await prisma.repoWatch.upsert({
                where: { projectId: project.id },
                create: { projectId: project.id, lastError: message },
                update: { lastError: message },
            });
            if (isNew) {
                await log(`Devlog check failed for "${project.title}": ${message}`);
            }
            if (error instanceof GitHubError && error.status === 404) {
                console.error(`[repo-watch] ${project.repoUrl}: not found or not visible to the token`);
            }
        }
    }
}
