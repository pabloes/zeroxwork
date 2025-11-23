import {AdminJSOptions} from 'adminjs';
import {getModelByName} from '@adminjs/prisma';
import {prisma} from '../src/db';
import argon2 from 'argon2';

import {fileURLToPath} from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import PasswordsFeature from '@adminjs/passwords';
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
        }
    ],
    rootPath: '/admin',
}

export default options;
