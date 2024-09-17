import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { PrismaClient } from '@prisma/client';
import express from 'express';

const app = express();
const prisma = new PrismaClient();

// Configurar AdminJS
const adminJs = new AdminJS({
    resources: [
        {
            resource: { model: prisma.user, client: prisma },
            options: { properties: { password: { isVisible: false } } },
        },
    ],
    rootPath: '/admin',
});

const adminRouter = AdminJSExpress.buildRouter(adminJs);

// Montar AdminJS en Express
app.use(adminJs.options.rootPath, adminRouter);

export { adminJs, adminRouter };
