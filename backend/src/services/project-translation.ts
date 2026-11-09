import { prisma } from '../db/index.js';
import { translateMarkdown, translateText, getTargetLangs } from './deepl.js';

/**
 * A project in the other languages.
 *
 * Two things set this apart from article translations:
 *
 *  - The title is never translated. A project is called what it is called:
 *    DeepL turns "Claim Bite" into "Resumen de la reclamación", and a game with
 *    a different invented name in every language is not translated, it is
 *    renamed. The stored row still carries the title so a reader never gets an
 *    empty one, it is simply the original.
 *  - No slug per language. A project has one address, /portfolio/<slug>, and
 *    the reader's language picks which stored copy fills the page.
 */
export async function updateProjectTranslations(
    projectId: number,
    title: string,
    summary: string | null,
    content: string,
    sourceLang: string,
    newHash: string,
): Promise<void> {
    for (const targetLang of getTargetLangs(sourceLang)) {
        const lang = targetLang.toLowerCase();

        try {
            const existing = await prisma.projectTranslation.findUnique({
                where: { projectId_targetLang: { projectId, targetLang: lang } },
            });

            // Up to date: the text has not moved since this copy was made.
            if (existing?.sourceHash === newHash) continue;

            const [translatedContent, translatedSummary] = await Promise.all([
                translateMarkdown(content, targetLang),
                summary && summary.trim() !== '' ? translateText(summary, targetLang) : Promise.resolve(null),
            ]);

            const data = {
                title,
                summary: translatedSummary,
                content: translatedContent,
                sourceHash: newHash,
                provider: 'deepl',
                cachedAt: new Date(),
            };

            await prisma.projectTranslation.upsert({
                where: { projectId_targetLang: { projectId, targetLang: lang } },
                update: data,
                create: { projectId, targetLang: lang, ...data },
            });

            console.log(`Translated project ${projectId} to ${lang}`);
        } catch (error) {
            // One language failing is not a reason to leave the others undone.
            console.error(`Failed to translate project ${projectId} to ${lang}:`, error);
        }
    }
}

/**
 * Drop every stored translation of a project. Used when the source language
 * changes: the copies that exist were made from a different original and
 * translating Spanish prose as if it were English is worse than having nothing.
 */
export async function dropProjectTranslations(projectId: number): Promise<void> {
    await prisma.projectTranslation.deleteMany({ where: { projectId } });
}
