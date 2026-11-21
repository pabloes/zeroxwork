/**
 * The weekly pass: look at each watched portfolio item's repository, and when
 * the week holds something worth a player's attention, post a devlog in that
 * game's channel.
 *
 * The repository is never configured here. It comes from the portfolio item
 * (`Project.repoUrl`), so there is one place where a project's repository is
 * written down and it is the same one the website shows. A `repo_watches` row
 * only adds what the portfolio has no business knowing: the Discord channel,
 * and how far the bot has already reported.
 */

import { PermissionFlagsBits, type Client, type TextChannel } from 'discord.js';
import type { PrismaClient } from './db';
import type { BotConfig } from './config';
import { fetchRange, GitHubError } from './github.js';
import { assess, buildTemplatePost, isDue, parseGitHubRepo, type PostInput } from './repo-watch.js';
import { writeDevlog } from './devlog.js';

type Log = (message: string) => Promise<void>;

interface WatchRow {
    id: number;
    channelId: string;
    branch: string | null;
    lastSha: string | null;
    lastCheckedAt: Date | null;
    lastError: string | null;
    project: { title: string; repoUrl: string | null; siteUrl: string | null; published: boolean };
}

async function sendPost(
    client: Client,
    channelId: string,
    content: string,
): Promise<void> {
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

async function runOne(
    watch: WatchRow,
    client: Client,
    prisma: PrismaClient,
    config: BotConfig,
    log: Log,
): Promise<void> {
    const { repoWatch } = config;
    const repo = parseGitHubRepo(watch.project.repoUrl);
    if (!repo) {
        throw new Error(`"${watch.project.repoUrl ?? 'no repository'}" is not a GitHub repository`);
    }

    const range = await fetchRange(repo, watch.branch, watch.lastSha, repoWatch.githubToken);
    if (!range) {
        await prisma.repoWatch.update({
            where: { id: watch.id },
            data: { lastCheckedAt: new Date(), lastError: null },
        });
        console.log(`[repo-watch] ${repo}: nothing new`);
        return;
    }

    const assessment = assess(range);
    if (!assessment.worthPosting) {
        // lastSha deliberately stays where it is: next week carries what piled
        // up here, instead of a quiet week swallowing it.
        await prisma.repoWatch.update({
            where: { id: watch.id },
            data: { lastCheckedAt: new Date(), lastError: null },
        });
        console.log(`[repo-watch] ${repo}: nothing to announce -- ${assessment.reason}`);
        return;
    }

    const input: PostInput = {
        gameName: watch.project.title,
        range,
        assessment,
        siteUrl: watch.project.siteUrl,
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
        const preview = `**[dry run]** devlog for \`${repo}\`, meant for <#${watch.channelId}>, written by ${writtenBy}:\n\n${content}`;
        if (config.logChannelId) {
            await sendPost(client, config.logChannelId, preview.slice(0, 2000));
        } else {
            console.log(preview);
        }
        // Nothing went out to the players, so nothing is marked as reported:
        // a dry run can be read, corrected and run again on the same week.
        await prisma.repoWatch.update({
            where: { id: watch.id },
            data: { lastCheckedAt: new Date(), lastError: null },
        });
        return;
    }

    await sendPost(client, watch.channelId, content);
    // Only now, and in one write: the range is reported, so it can never go
    // out twice.
    await prisma.repoWatch.update({
        where: { id: watch.id },
        data: {
            lastSha: range.headSha,
            lastPostedAt: new Date(),
            lastCheckedAt: new Date(),
            lastError: null,
        },
    });
    await log(`Devlog posted for ${repo} in <#${watch.channelId}>, written by ${writtenBy}`);
}

/**
 * Runs often; acts on a repository only when its week is up. The cadence lives
 * in `lastCheckedAt` rather than in a timer, so a deploy -- which restarts the
 * bot -- neither skips a week nor fires one early.
 */
export async function repoWatchPass(
    client: Client,
    prisma: PrismaClient,
    config: BotConfig,
    log: Log,
): Promise<void> {
    const watches = await prisma.repoWatch.findMany({
        where: { enabled: true, project: { published: true, repoUrl: { not: null } } },
        select: {
            id: true,
            channelId: true,
            branch: true,
            lastSha: true,
            lastCheckedAt: true,
            lastError: true,
            project: { select: { title: true, repoUrl: true, siteUrl: true, published: true } },
        },
    }) as WatchRow[];

    const now = new Date();
    for (const watch of watches) {
        if (!isDue(watch.lastCheckedAt, now, config.repoWatch.everyMs)) continue;

        try {
            await runOne(watch, client, prisma, config, log);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            // lastCheckedAt is deliberately left alone: a failure is usually a
            // token or a permission, and the next pass should retry in an hour
            // rather than in a week. The log only speaks when the error
            // changes, so a broken setup says so once and then stays quiet.
            const isNew = watch.lastError !== message;
            await prisma.repoWatch.update({ where: { id: watch.id }, data: { lastError: message } });
            if (isNew) {
                await log(`Devlog check failed for "${watch.project.title}": ${message}`);
            }
            if (error instanceof GitHubError && error.status === 404) {
                console.error(`[repo-watch] ${watch.project.repoUrl}: not found or not visible to the token`);
            }
        }
    }
}
