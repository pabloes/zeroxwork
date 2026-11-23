import {AdminJSOptions} from 'adminjs';
import {getModelByName} from '@adminjs/prisma';
import {prisma} from '../src/db';
import argon2 from 'argon2';

import {fileURLToPath} from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import PasswordsFeature from '@adminjs/passwords';
import { GRANTABLE_ROLES } from '../src/constants/discord-roles';
import { enqueueDiscordSyncForUser } from '../src/services/discord-sync-queue';

/**
 * Granting or revoking a role here has to reach the bot, which is a separate
 * process. The row in the queue is what tells it to look at that member again.
 */
const queueGrantChange = async (response: any, _request: any, context: any) => {
    const userId = Number(context?.record?.params?.userId ?? response?.record?.params?.userId);
    if (Number.isInteger(userId)) {
        await enqueueDiscordSyncForUser(userId, 'grant_changed');
    }
    return response;
};
import {Components, componentLoader} from './component-loader';
import path from "path";

const options:AdminJSOptions =  {
    componentLoader:componentLoader,
    dashboard: {
        component: Components.Dashboard,
    },
    branding: {
        logo: false,
        companyName: 'ZEROxWORK',
    },
    resources: [
        {

            resource: {
                model: getModelByName("User"),
                client: prisma,
            },
            options: {
                properties: {
                    ID: { isVisible: { show: true, edit: false, list: true, filter: true } },
                    email: { isVisible: { show: true, edit: true, list: true, filter: true } },
                    password: { isVisible: {list: false, edit: false, filter: false, show: false} },
                    role: { isVisible: { show: true, edit: true, list: true, filter: true } },
                    // Editable here so a member's handle can be set for them,
                    // which is what links their project credits to their page.
                    handle: { isVisible: { show: true, edit: true, list: true, filter: true } },
                    displayName: { isVisible: { show: true, edit: true, list: true, filter: true } },
                },
            },
            features: [
                PasswordsFeature({
                    properties: {
                        encryptedPassword: 'password',
                        password: 'pass'
                    },
                    hash: argon2.hash,
                    componentLoader
                })
            ]
        },
        {
            resource: {
                model: getModelByName("ApiKey"),
                client: prisma,
            },
        },
        {
            resource: {
                model: getModelByName("Article"),
                client: prisma,
            },
            options: {
                listProperties: ['id', 'lang', 'category', 'title', 'content', 'createdAt', 'updatedAt', 'user', 'thumbnail', 'published', 'featured', 'slug'],
                properties: {
                    id: {
                        isVisible: { show: true, edit: false, list: true, filter: true },
                    },
                    lang: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    category: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    title: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    content: {
                        isVisible: { show: true, edit: true, list: true, filter: false },
                        type: 'textarea',
                        props: {
                            rows: 10,
                        },
                        components: {
                            list: Components.TruncatedText,
                        },
                    },
                    createdAt: {
                        isVisible: { show: true, edit: false, list: true, filter: true },
                    },
                    updatedAt: {
                        isVisible: { show: true, edit: false, list: true, filter: true },
                    },
                    user: {
                        isVisible: { show: true, edit: false, list: true, filter: true },
                    },
                    thumbnail: {
                        isVisible: { show: true, edit: true, list: true, filter: false },
                        components: {
                            list: Components.ThumbnailList,
                        },
                    },
                    published: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    featured: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    slug: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    sourceHash: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                    },
                    script: {
                        isVisible: { show: true, edit: true, list: false, filter: false },
                    },
                    translations: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                        reference: 'ArticleTranslation',
                    },
                    slugHistory: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                        reference: 'ArticleSlug',
                    },
                },
            },
        },
        {
            resource: {
                model: getModelByName("ArticleTranslation"),
                client: prisma,
            },
            options: {
                properties: {
                    // Editable fields
                    title: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    content: {
                        isVisible: { show: true, edit: true, list: false, filter: false },
                        type: 'textarea',
                    },
                    slug: {
                        isVisible: { show: true, edit: true, list: true, filter: true },
                    },
                    // Read-only fields
                    articleId: {
                        isVisible: { show: true, edit: false, list: true, filter: true },
                    },
                    targetLang: {
                        isVisible: { show: true, edit: false, list: true, filter: true },
                    },
                    sourceHash: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                    },
                    provider: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                    },
                    cachedAt: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                    },
                    // Hide article relation in edit to avoid confusion
                    article: {
                        isVisible: { show: true, edit: false, list: false, filter: false },
                    },
                },
            },
        },
        {
            resource: {
                model: getModelByName("ArticleSlug"),
                client: prisma,
            },
        },
        {
            resource: {
                model: getModelByName("FileUpload"),
                client: prisma,
            },
        },
        {
            resource: {
                model: getModelByName("Wallet"),
                client: prisma,
            },
        },
        {
            resource: {
                model: getModelByName("WalletNames"),
                client: prisma,
            },
        },
        {
            resource: {
                model: getModelByName("Category"),
                client: prisma,
            },
        },
        {
            resource: {
                model: getModelByName("Tag"),
                client: prisma,
            },
        },
        {
            // Una ficha del catalogo de /tools. `mode` dice como se llega:
            // `link` salta a `href`, `embed` lo mete en un iframe dentro de
            // /tools/<slug>, y entonces `embedHeight` significa algo.
            resource: {
                model: getModelByName("Tool"),
                client: prisma,
            },
            options: {
                listProperties: ['id', 'slug', 'title', 'mode', 'href', 'published', 'featured'],
                editProperties: [
                    'slug', 'title', 'summary', 'content', 'thumbnail',
                    'href', 'mode', 'embedHeight', 'lang',
                    'published', 'featured', 'createdById',
                ],
            },
        },
        {
            // Las copias traducidas, escritas por DeepL. Se pueden corregir a
            // mano, pero el `sourceHash` es lo que decide si estan al dia:
            // cambiarlo de cualquier manera las condena a no refrescarse nunca.
            resource: {
                model: getModelByName("ToolTranslation"),
                client: prisma,
            },
            options: {
                listProperties: ['id', 'toolId', 'targetLang', 'title', 'cachedAt'],
            },
        },
        {
            // Who is credited on a project. `name` is what gets shown when the
            // credit has no account behind it; filling `userId` turns the name
            // into a link to that member's page.
            resource: {
                model: getModelByName("ArticleCredit"),
                client: prisma,
            },
            options: {
                listProperties: ['id', 'articleId', 'name', 'role', 'userId', 'position'],
                editProperties: ['articleId', 'name', 'role', 'userId', 'position'],
            },
        },
        {
            // Written by the OAuth flow, never by hand: editing an id here would
            // hand someone else's Discord account a role.
            resource: {
                model: getModelByName("DiscordLink"),
                client: prisma,
            },
            options: {
                navigation: { name: 'Discord' },
                actions: {
                    new: { isAccessible: false },
                    edit: { isAccessible: false },
                },
                listProperties: ['id', 'userId', 'discordId', 'username', 'globalName', 'linkedAt', 'lastSyncedAt'],
            },
        },
        {
            // Roles handed out by hand. The bot grants the base role on its own.
            resource: {
                model: getModelByName("DiscordRoleGrant"),
                client: prisma,
            },
            options: {
                navigation: { name: 'Discord' },
                actions: {
                    new: { after: queueGrantChange },
                    edit: { after: queueGrantChange },
                    delete: { after: queueGrantChange },
                },
                properties: {
                    roleKey: {
                        availableValues: GRANTABLE_ROLES.map((role) => ({ value: role.key, label: role.label })),
                    },
                    note: { type: 'textarea' },
                },
                listProperties: ['id', 'userId', 'roleKey', 'note', 'createdAt'],
            },
        },
        {
            // Entered from the site's own form, and edited from either: that
            // form for anything with a rule behind it, this screen for the
            // handful of fields that are plain configuration.
            //
            // `new` and `delete` stay shut. A project is born with at least one
            // member and a slug of its own, and taking one away has to take its
            // translations, its credits and its repo watch with it. AdminJS
            // knows none of that, so doing either here would be a way around
            // all of it.
            //
            // `editProperties` is the whole of what can be written by hand
            // without breaking something behind it. Left out on purpose: title,
            // summary, content, lang and slug. The form recomputes `sourceHash`
            // and drops the stored translations when the prose or the language
            // changes (routes/project.ts); written here, those copies would
            // stay behind and read as if nothing had ever changed.
            //
            // It has to be registered all the same: `repo_watches.projectId`
            // is a relation, AdminJS treats a relation as a reference to
            // another resource, and listing the watches made it look this one
            // up. Unregistered, that threw and the whole Repo watches screen
            // answered 500.
            resource: {
                model: getModelByName("Project"),
                client: prisma,
            },
            options: {
                navigation: { name: 'Portfolio' },
                actions: {
                    new: { isAccessible: false },
                    delete: { isAccessible: false },
                },
                editProperties: [
                    'published', 'featured', 'status',
                    'thumbnail', 'screenshots', 'videoUrl', 'siteUrl',
                    'repoUrl', 'repoUrlPublic', 'discordChannelId',
                    'startedAt', 'endedAt',
                ],
                listProperties: ['id', 'slug', 'title', 'published', 'repoUrl', 'repoUrlPublic', 'discordChannelId'],
            },
        },
        {
            // How far the devlog watcher has got with each project. Nothing
            // here is configuration -- the repository and the channel are
            // both on the project itself -- and the bot writes its own row.
            // What is worth having here is `enabled`, to pause a watch
            // without clearing the project's channel.
            //
            // `lastSha` is the last commit already reported. Clearing it makes
            // the next run start from the week before the newest commit again,
            // which is how a post is replayed after a bad one.
            resource: {
                model: getModelByName("RepoWatch"),
                client: prisma,
            },
            options: {
                navigation: { name: 'Discord' },
                properties: {
                    branch: { description: 'Leave empty for the repository default branch.' },
                    lastSha: { description: 'Last commit already posted. Clear it to replay the latest week.' },
                    lastError: { isVisible: { edit: false, new: false, list: true, show: true } },
                    lastPostedAt: { isVisible: { edit: false, new: false, list: true, show: true } },
                    lastCheckedAt: { isVisible: { edit: false, new: false, list: true, show: true } },
                },
                listProperties: ['id', 'project', 'enabled', 'lastPostedAt', 'lastCheckedAt', 'lastError'],
            },
        }
    ],
    rootPath: '/admin',
}

export default options;
