-- Las herramientas, en su propia tabla.
--
-- Hasta ahora una herramienta era un articulo con la categoria "tool", y de las
-- tres que habia dos no tenian ni un caracter de texto: eran un nombre, una
-- imagen y un sitio al que ir, con el destino metido a presion en redirectUrl o
-- en embedUrl segun el dia. Esto les da el campo que de verdad las define.
--
-- No se borra nada: los articulos de categoria "tool" siguen donde estan hasta
-- que el script de traspaso los copie aqui y se despubliquen a mano.

-- CreateTable
CREATE TABLE "tools" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "thumbnail" TEXT,
    "href" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'link',
    "embedHeight" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_translations" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "targetLang" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "sourceHash" TEXT,
    "provider" TEXT,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "tool_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TagToTool" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tools_slug_key" ON "tools"("slug");

-- CreateIndex
CREATE INDEX "tools_slug_idx" ON "tools"("slug");

-- CreateIndex
CREATE INDEX "tools_published_idx" ON "tools"("published");

-- CreateIndex
CREATE INDEX "tools_createdById_idx" ON "tools"("createdById");

-- CreateIndex
CREATE INDEX "tool_translations_toolId_idx" ON "tool_translations"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "tool_translations_toolId_targetLang_key" ON "tool_translations"("toolId", "targetLang");

-- CreateIndex
CREATE UNIQUE INDEX "_TagToTool_AB_unique" ON "_TagToTool"("A", "B");

-- CreateIndex
CREATE INDEX "_TagToTool_B_index" ON "_TagToTool"("B");

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_translations" ADD CONSTRAINT "tool_translations_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTool" ADD CONSTRAINT "_TagToTool_A_fkey" FOREIGN KEY ("A") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTool" ADD CONSTRAINT "_TagToTool_B_fkey" FOREIGN KEY ("B") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
