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
        }
    ],
    rootPath: '/admin',
}

export default options;
