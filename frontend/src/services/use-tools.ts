import { useQuery } from "@tanstack/react-query";
import { api } from "./axios-setup";
import { useTranslation } from "../i18n";
import { type ArticleTag } from "./use-articles";

/**
 * Las herramientas del catálogo, que ya no son artículos con una categoría
 * encima.
 *
 * Una herramienta es una ficha: un nombre, una imagen, una línea y un sitio al
 * que ir. Dos de las tres primeras no tenían ni una palabra de texto, así que
 * ni el cuerpo ni el resumen son obligatorios; lo único que no puede faltar es
 * el destino.
 */

/** Cómo se llega: saltando al sitio, o incrustándolo en nuestra página. */
export type ToolMode = 'link' | 'embed';

export interface Tool {
    id: number;
    slug: string;
    title: string;
    summary: string | null;
    content: string | null;
    lang: string;
    thumbnail: string | null;
    /** Dónde vive: una ruta de este sitio, o una dirección https. */
    href: string;
    mode: ToolMode;
    /** Alto del iframe. Sólo tiene valor cuando `mode` es `embed`. */
    embedHeight: number | null;
    published: boolean;
    featured: boolean;
    tags: ArticleTag[];
    createdAt: string;
    updatedAt: string;
    /** El idioma en el que ha venido de verdad esta copia. */
    readingLang: string;
    availableLangs: string[];
    /** Si quien mira puede editarla y publicarla. Sólo en la lectura de una. */
    canEdit?: boolean;
}

/**
 * A dónde lleva la tarjeta.
 *
 * Una herramienta que se incrusta tiene página propia, porque el iframe va
 * dentro de la nuestra. Una que salta no la necesita: su página es el sitio al
 * que lleva, y meter una parada intermedia sólo añade un clic.
 */
export function toolTarget(tool: Pick<Tool, 'id' | 'slug' | 'mode' | 'href'>): string {
    return tool.mode === 'embed' ? `/tools/${tool.slug || tool.id}` : tool.href;
}

/** Si el destino se abre fuera de este sitio, que es lo que decide el target. */
export function isExternal(href: string): boolean {
    return /^https?:\/\//i.test(href);
}

/** La dirección de la ficha, exista o no página propia. */
export function toolPath(tool: Pick<Tool, 'id' | 'slug'>): string {
    return `/tools/${tool.slug || tool.id}`;
}

export function useTools() {
    const { lang } = useTranslation();

    return useQuery<Tool[]>({
        queryKey: ['tools', lang],
        queryFn: async () => (await api.get(`/tools?lang=${lang}`)).data,
    });
}

export function useTool(idOrSlug: string) {
    const { lang } = useTranslation();

    return useQuery<Tool>({
        queryKey: ['tool', idOrSlug, lang],
        queryFn: async () => (await api.get(`/tools/${idOrSlug}?lang=${lang}`)).data,
        retry: false,
    });
}

/**
 * Una herramienta para editarla: siempre en su idioma original, nunca una
 * traducción, porque guardar una copia traducida encima del original
 * sobrescribiría el texto del que salió.
 */
export function useToolForEdit(id: string) {
    return useQuery<Tool>({
        queryKey: ['tool-edit', id],
        queryFn: async () => (await api.get(`/tools/${id}`)).data,
        retry: false,
        staleTime: 0,
    });
}

/** Lo que la lista de "mis herramientas" necesita, y nada más. */
export interface MyTool {
    id: number;
    slug: string;
    title: string;
    thumbnail: string | null;
    mode: ToolMode;
    href: string;
    published: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Lo que mandan los formularios. El servidor tiene la última palabra. */
export interface ToolPayload {
    title: string;
    summary?: string;
    content?: string;
    lang: string;
    slug?: string;
    thumbnail?: string;
    href: string;
    mode: ToolMode;
    embedHeight?: number;
    tagIds?: number[];
    newTags?: string[];
}

export async function createTool(payload: ToolPayload): Promise<Tool> {
    return (await api.post('/tools', payload)).data;
}

export async function updateTool({ id, ...payload }: ToolPayload & { id: number }): Promise<Tool> {
    return (await api.put(`/tools/${id}`, payload)).data;
}

/**
 * Publicar es su propio endpoint, no un guardado entero: un PUT desde una lista
 * tendría que reenviar la herramienta completa y borraría lo que la lista no
 * lleva encima.
 */
export async function setToolPublished({ id, published }: { id: number; published: boolean }) {
    return (await api.patch(`/tools/${id}/published`, { published })).data;
}

export async function deleteTool(id: number) {
    return (await api.delete(`/tools/${id}`)).data;
}

/** Las herramientas de quien llama, borradores incluidos. */
export function useMyTools() {
    return useQuery<MyTool[]>({
        queryKey: ['my-tools'],
        queryFn: async () => (await api.get('/tools/mine')).data,
    });
}
