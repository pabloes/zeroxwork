import { prisma } from '../db/index.js';
import { translateMarkdown, translateText, getTargetLangs } from './deepl.js';

/**
 * Una herramienta en los otros idiomas.
 *
 * Como en proyectos, el titulo no se traduce: una herramienta se llama como se
 * llama, y "Brain Wallet Tool" traducido es otra herramienta. La fila guardada
 * lo lleva igualmente para que nadie vea un titulo vacio, pero es el original.
 *
 * Lo que de verdad viaja es el resumen -- la linea de la tarjeta -- y la prosa
 * cuando la hay. Dos de las tres primeras herramientas no tenian ni una
 * palabra, asi que el contenido se traduce solo si existe: pedirle a DeepL que
 * traduzca la cadena vacia es gastar una llamada en nada.
 */
export async function updateToolTranslations(
    toolId: number,
    title: string,
    summary: string | null,
    content: string | null,
    sourceLang: string,
    newHash: string,
): Promise<void> {
    for (const targetLang of getTargetLangs(sourceLang)) {
        const lang = targetLang.toLowerCase();

        try {
            const existing = await prisma.toolTranslation.findUnique({
                where: { toolId_targetLang: { toolId, targetLang: lang } },
            });

            // Al dia: el texto no se ha movido desde que se hizo esta copia.
            if (existing?.sourceHash === newHash) continue;

            const hayTexto = (value: string | null) => value !== null && value.trim() !== '';

            const [translatedSummary, translatedContent] = await Promise.all([
                hayTexto(summary) ? translateText(summary as string, targetLang) : Promise.resolve(null),
                hayTexto(content) ? translateMarkdown(content as string, targetLang) : Promise.resolve(null),
            ]);

            const data = {
                title,
                summary: translatedSummary,
                content: translatedContent,
                sourceHash: newHash,
                provider: 'deepl',
                cachedAt: new Date(),
            };

            await prisma.toolTranslation.upsert({
                where: { toolId_targetLang: { toolId, targetLang: lang } },
                update: data,
                create: { toolId, targetLang: lang, ...data },
            });

            console.log(`Translated tool ${toolId} to ${lang}`);
        } catch (error: any) {
            // Que falle un idioma no es motivo para dejar los otros sin hacer.
            console.error(`Failed to translate tool ${toolId} to ${lang}:`, error);
        }
    }
}

/**
 * Tirar todas las copias de una herramienta. Se usa cuando cambia el idioma en
 * que esta escrita: lo que hay se hizo desde otro original, y traducir un texto
 * en espanol como si fuera ingles es peor que no tener nada.
 */
export async function dropToolTranslations(toolId: number): Promise<void> {
    await prisma.toolTranslation.deleteMany({ where: { toolId } });
}
