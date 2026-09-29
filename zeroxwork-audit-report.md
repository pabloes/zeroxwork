# ZEROxWORK Audit Report

**Fecha:** 2026-03-24
**Proyecto:** ZEROxWORK (zeroxwork.com)
**Repositorio:** pabloes/zeroxwork (monorepo frontend + backend)
**Infraestructura:** CapRover (Docker) en zerox3.zeroxwork.com

---

## 1. Diagnostico ejecutivo

### Que es realmente este producto

ZEROxWORK es una plataforma web que intenta ser varias cosas a la vez:

1. **Blog multilenguaje** con traducciones automaticas (DeepL) -- es el core visible
2. **Brain Wallet tool** para generar wallets cripto desde frases memorables
3. **Image hosting** con escaneo de virus (ClamAV) y deteccion de contenido (Google Vision)
4. **Sistema de identidad web3** vinculando wallets Ethereum/Decentraland/Base names a cuentas de usuario
5. **CMS con scripts embebidos** en articulos (sandboxed/inline JS execution)

### Problema principal de foco

**El producto no tiene identidad clara.** Un visitante llega a zeroxwork.com y ve un blog con 7 posts. No hay hero, no hay propuesta de valor, no hay CTA. Las tools estan escondidas detras de un tab. El brain wallet (la feature mas diferenciadora) requiere navegar a `/tools` y luego a un articulo-link. No hay landing page.

### Que funciona

- El sistema de blog con traducciones automaticas a 4 idiomas es solido y bien implementado
- El slug history con 301 redirects es una buena practica SEO
- Brain Wallet es una herramienta util y diferenciadora
- El backend es funcional y razonablemente estructurado
- El deploy pipeline con CapRover funciona

### Que no funciona

- No hay propuesta de valor visible en los primeros 5 segundos
- La home es un listado de blog posts sin contexto
- Las herramientas cripto estan enterradas
- El image upload y la identidad web3 son features huerfanas sin caso de uso claro para el visitante
- El bundle del frontend es de 3.8MB (enorme)
- 128 vulnerabilidades reportadas por GitHub en dependencias

### Oportunidad real

ZEROxWORK podria posicionarse como **plataforma de herramientas cripto + contenido educativo** para hispanohablantes (y multilenguaje). El brain wallet, combinado con contenido educativo sobre seguridad cripto, tiene un nicho claro y monetizable. El blog como soporte de contenido SEO para atraer trafico hacia las tools.

---

## 2. Top 10 problemas

| # | Problema | Severidad | Impacto | Solucion concreta |
|---|---------|-----------|---------|-------------------|
| 1 | **Sin landing page ni propuesta de valor** | Critico | Tasa de rebote alta, cero conversion | Crear hero section con value prop + CTA directo a tools |
| 2 | **JWT expira en 10000 segundos (~2.7h) con numero magico** | Alto | Sesiones erraticas, codigo confuso | Usar `'3h'` o variable de entorno, estandarizar |
| 3 | **Session secret hardcodeado como 'localhost'** | Critico | Sesiones AdminJS predecibles en produccion | Mover a variable de entorno obligatoria |
| 4 | **Bundle frontend 3.8MB** | Alto | Carga lenta, penalizacion SEO/Core Web Vitals | Code splitting, lazy loading, eliminar deps no usadas |
| 5 | **`/send-verification-mail` no valida que el email pertenezca al userId** | Critico | Cualquiera puede pedir verificacion de cualquier cuenta | Validar que el email coincida con el userId o eliminar el parametro email |
| 6 | **Category CRUD sin validacion de admin** | Alto | Cualquier usuario autenticado puede crear/editar/borrar categorias | Anadir middleware `requireAdmin` |
| 7 | **Articulos ejecutan JS arbitrario inline en el DOM principal** | Critico | XSS potencial, robo de tokens JWT del localStorage | Solo permitir modo iframe sandbox, eliminar `runInline` o restringir a admin |
| 8 | **CORS con `allowedHeaders` pero sin `origin` restrictivo** | Alto | Cualquier origen puede hacer requests al API | Configurar whitelist de origenes permitidos |
| 9 | **Sin rate limiting en login/register** | Alto | Vulnerable a brute force de credenciales | Anadir rate limiter como en image upload |
| 10 | **Duplicacion masiva de codigo** (Home.tsx y Tools.tsx son identicos) | Medio | Mantenimiento doble, bugs divergentes | Extraer componente `ArticleGrid` reutilizable |

---

## 3. Quick Wins (1-3 dias)

### 3.1 Fijar el session secret
```typescript
// server.ts - AHORA
secret: process.env.SESSION_SECRET || 'localhost'
// DEBE SER
secret: process.env.SESSION_SECRET // sin fallback, que falle si no esta
```
Anadir `SESSION_SECRET` como variable de entorno en CapRover. **Tiempo: 10 minutos.**

### 3.2 Rate limiting en auth
Anadir `express-rate-limit` a `/api/auth/login` y `/api/auth/register` (ya lo usas en image upload, copiar patron). **Tiempo: 15 minutos.**

### 3.3 Proteger el endpoint de verification mail
`/send-verification-mail` acepta `userId` y `email` del body sin validar que coincidan. Eliminar el parametro `email` y buscarlo desde el `userId`:
```typescript
router.post('/send-verification-mail', async(req, res) => {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    await sendVerificationMail(user.id, user.email);
    return res.send({ ok: true });
});
```
**Tiempo: 15 minutos.**

### 3.4 Proteger category/tag CRUD
Anadir `requireAdmin` middleware a POST/PUT/DELETE de categories y tags. **Tiempo: 10 minutos.**

### 3.5 Fix JWT expiration
```typescript
// AHORA
{ expiresIn: 10000 } // ambiguo: son segundos
// MEJOR
{ expiresIn: '8h' } // claro y mantenible
```
**Tiempo: 5 minutos.**

### 3.6 Restringir CORS origins
```typescript
app.use(cors({
    origin: ['https://zeroxwork.com', 'https://zerox3.zeroxwork.com'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
```
**Tiempo: 10 minutos.**

---

## 4. Mejoras estructurales (1-4 semanas)

### 4.1 Landing page real (3-5 dias)
Crear una home que no sea un listado de posts. Estructura:
1. Hero con propuesta de valor
2. Grid de tools destacadas (brain wallet, image upload)
3. Ultimos posts del blog debajo
4. CTA de registro

### 4.2 Code splitting del frontend (2-3 dias)
- Lazy load de paginas con `React.lazy()` + `Suspense`
- El brain wallet importa `bitcoinjs-lib`, `@solana/web3.js`, `tiny-secp256k1`, `bip32`, `bip39`, `bs58check` -- esto solo deberia cargarse cuando el usuario navega a esa pagina
- Mover `wagmi`/`connectkit`/`@coinbase/onchainkit` a lazy load (solo se usan en Account)
- Resultado esperado: bundle inicial < 500KB

### 4.3 Eliminar ejecucion inline de scripts en articulos (1 dia)
El componente `SandboxedArticleScript` con `runInline=true` ejecuta codigo arbitrario en el contexto del DOM principal. Esto es un vector XSS critico:
- Un articulo con script malicioso puede leer `localStorage` (donde esta el JWT)
- Puede hacer requests autenticados al API
- Solucion: eliminar la opcion `runInline`, solo permitir iframe con `sandbox="allow-scripts"`

### 4.4 Refactorizar componentes duplicados (1 dia)
`Home.tsx` y `Tools.tsx` son practicamente identicos (misma estructura, mismas interfaces, mismo fetch). Extraer un `ArticleGrid` component que reciba `category` como prop.

### 4.5 Eliminar el doble chequeo manual de token expiration (1 dia)
En `authMiddleware.ts:14` y `auth.ts:142` se hace `if((verified.exp * 1000) < Date.now())` DESPUES de `jwt.verify()`. Esto es redundante -- `jwt.verify()` ya lanza `TokenExpiredError` si el token expiro. Eliminar la comprobacion manual.

### 4.6 Estandarizar instancias de Prisma (1 dia)
`auth.ts` crea su propia `new PrismaClient()` en lugar de importar desde `../db`. Esto genera conexiones duplicadas a la base de datos. Cambiar a `import { prisma } from '../db'`.

---

## 5. Que eliminaria

### Features a eliminar o deprecar

| Feature | Razon | Accion |
|---------|-------|--------|
| **OldBrainWallet** (`/old-brain-wallet`) | Version legacy, confunde al usuario | Eliminar pagina y ruta |
| **`/hello` y `/hello/world` endpoints** | Debug endpoints en produccion | Eliminar de server.ts |
| **Segundo CORS middleware manual** (server.ts:81-85) | Ya se usa `cors()` con la libreria, este segundo middleware es redundante y mas permisivo (`*`) | Eliminar |
| **Rutas duplicadas brain wallet** (`/brain-wallet` y `/eth-brain-wallet`) | Dos URLs para lo mismo | Mantener solo `/brain-wallet`, redirect 301 la otra |
| **`node-cache` en frontend** (package.json) | Es una libreria de backend, no tiene sentido en frontend | Eliminar dependencia |
| **`decentraland-ui`** | Se importa en package.json pero no se usa en ningun componente | Verificar y eliminar si no se usa |
| **Cookie consent en espanol hardcodeado** | El sitio es multilenguaje pero el cookie consent esta en espanol | Internacionalizar o simplificar |

### Complejidad innecesaria

- **WalletNames / Decentraland integration**: Anadir 5MB de quota por nombre NFT es una mecanica compleja que nadie entiende sin explicacion. Simplificar o eliminar el sistema de quotas variables.
- **Google Vision API para SafeSearch**: Costoso, lento, y solo se usa para auto-banear imagenes. Para un proyecto de este tamano, moderacion manual es mas practico.

---

## 6. Que potenciaria

### Core del producto: Herramientas cripto + contenido educativo

El brain wallet es la feature mas diferenciadora. Combinada con contenido SEO sobre:
- "Como crear un brain wallet seguro"
- "Diferencia entre wallets ETH, BTC, SOL, TRX"
- "Como importar un mnemonic en MetaMask/TronLink/Phantom"
- "Generador de wallets multi-chain"

Esto posiciona zeroxwork.com como una **suite de herramientas cripto** con contenido de soporte.

### Potencial de monetizacion

1. **Google AdSense** (ya integrado) -- optimizar posicionamiento de anuncios en paginas de tools
2. **Afiliados de exchanges/wallets** -- links de referido en los articulos educativos
3. **Premium features** del brain wallet: exportar keys cifradas, backup PDF, etc.
4. **API de pago** para generacion masiva de wallets (el endpoint ya existe con API keys)

### Que construiria siguiente

1. **Mas herramientas cripto**: conversor de unidades (wei/gwei/eth), verificador de checksums de direcciones, firmador de mensajes
2. **Paginas SEO dedicadas por tool**: `/tools/brain-wallet`, `/tools/eth-wallet-generator`, etc.
3. **Schema markup** (JSON-LD) para que Google entienda que son herramientas

---

## 7. Plan de accion priorizado

### Fase 1: Impacto alto / esfuerzo bajo (1 semana)

1. Fijar session secret, CORS, rate limiting en auth
2. Proteger `/send-verification-mail` y category CRUD
3. Eliminar `runInline` de scripts en articulos
4. Eliminar endpoints de debug y duplicados
5. Estandarizar PrismaClient (una sola instancia)
6. Fix JWT expiration string

### Fase 2: Impacto alto / esfuerzo medio (2-3 semanas)

1. Crear landing page con hero + tools destacadas
2. Code splitting y lazy loading (reducir bundle a <500KB)
3. Extraer `ArticleGrid` reutilizable
4. Paginas SEO individuales por herramienta
5. Meta tags dinamicos por pagina (og:title, og:description)
6. Schema markup JSON-LD para tools

### Fase 3: Refactor / escala (1-2 meses)

1. Migrar de UIkit a un sistema de UI mas moderno o al menos bundle solo los componentes usados
2. Server-side rendering (Next.js o similar) para SEO real de articulos
3. Implementar tests (0 tests actualmente)
4. CI/CD con tests automaticos pre-deploy
5. Actualizar dependencias con vulnerabilidades criticas
6. Separar frontend y backend en deployments independientes

---

## 8. Copy optimizado

### Hero principal
**Actual:** No existe. La home es un listado de posts sin contexto.

**Propuesta:**
> **Herramientas cripto gratuitas, sin registro, sin rastreo**
> Genera wallets multi-chain desde una frase memorable, sube imagenes con escaneo de seguridad, y aprende sobre blockchain.

### Subheadline
> Tus claves privadas se generan en tu navegador. Nada se envia a ningun servidor. Codigo abierto.

### CTA principal
> **Crear Brain Wallet** (enlace directo a /brain-wallet)

### CTA secundarios
> **Explorar herramientas** | **Leer el blog**

---

## 9. Revision tecnica

### Frontend

**Organizacion:**
- Estructura plana en `/pages` -- aceptable para el tamano actual (14 paginas)
- Sin barrel exports ni modulo de constantes compartidas
- `SUPPORTED_LANGS` y funciones de idioma duplicadas en Home.tsx, Tools.tsx y Header.tsx

**Componentes problematicos:**
- `SandboxedArticleScript.tsx` (270 lineas): Duplicacion completa del transformer de imports entre modo inline y modo iframe. El codigo del iframe se construye como template literal gigante con interpolacion de JSON
- `BindWallet.tsx` (258 lineas): Demasiada logica en un componente. Mezcla conexion wallet, firma, bind, delete, identidad digital, avatar
- `BrainWallet.tsx` (ahora ~340 lineas): Creciendo con cada chain anadida. Extraer la logica de derivacion a un hook/servicio

**Performance:**
- Bundle principal: **3.84MB** (gzip: 1.17MB) -- inaceptable
- Importa `@solana/web3.js` (grande), `bitcoinjs-lib`, `wagmi`, `connectkit`, `ethers` en el bundle principal
- `ethers` Y `viem` estan ambos en dependencias -- son redundantes (viem es la alternativa moderna a ethers)
- UIkit JS se carga desde CDN (no tree-shakeable) + UIkit CSS completo via npm

**Refactors prioritarios:**
1. Lazy load de paginas pesadas (BrainWallet, Account/BindWallet)
2. Eliminar `ethers` (usar solo `viem`)
3. Extraer logica de derivacion del BrainWallet a `useBrainWallet.ts` hook
4. Componente `ArticleGrid` compartido

### Backend

**Estructura:**
```
backend/src/
  routes/       (5 archivos, bien separados por dominio)
  services/     (7 archivos)
  middleware/   (3 archivos)
  db/           (1 archivo)
  constants/    (asumido, roles)
```
Estructura aceptable para el tamano actual.

**Problemas detectados:**

1. **`blog.ts` tiene 738 lineas** -- archivo mas grande del backend. Mezcla CRUD de articles, categories, tags, queries SQL raw, slug management. Deberia separarse en al menos 3 archivos.

2. **SQL raw con `$queryRawUnsafe`** (blog.ts:406): Aunque los parametros se pasan correctamente, el uso de interpolacion para `${categoryCondition}` y `${limitParam}` dentro del template string es una superficie de riesgo. Los valores interpolados provienen de logica interna (no de user input directo), pero es fragil.

3. **`auth.ts` instancia su propio PrismaClient** en lugar de usar el singleton de `../db`. Esto crea conexiones duplicadas al pool de PostgreSQL.

4. **Prisma `$use` middleware** (db/index.ts): Se usa el deprecated middleware API para borrar slugs cuando se borra una traduccion. Prisma recomienda migrar a extensions.

5. **Sin validacion de input** en la mayoria de endpoints. No se usa zod, joi ni ningun schema validator. Los datos del body se usan directamente.

6. **Mezcla de idiomas** en comentarios y mensajes de error (espanol e ingles mezclados).

**Auth:**
- Argon2 para hashing -- buena eleccion
- JWT para sesiones -- correcto
- No hay refresh token mechanism -- el token expira y el usuario tiene que re-loguearse
- API Keys se almacenan en texto plano en la BD -- deberian hashearse (mostrar solo al crear)

**Refactors prioritarios:**
1. Dividir `blog.ts` en `articles.ts`, `categories.ts`, `tags.ts`
2. Anadir validacion de input con zod en todos los endpoints
3. Unificar PrismaClient (eliminar instancia duplicada en auth.ts)
4. Hashear API keys

### Arquitectura

**Que esta mal planteado:**
- Frontend y backend en el mismo proceso Docker. En produccion, Express sirve los archivos estaticos del frontend. Esto significa que un restart del backend tumba el frontend.
- `prisma generate` y `prisma migrate deploy` se ejecutan en el CMD del Dockerfile cada vez que el contenedor arranca. Esto anade ~5-10s al startup y es innecesario si no hay migraciones nuevas (deberia ser parte del build, no del runtime).

**Que simplificaria:**
- Servir frontend desde un CDN o nginx separado (incluso dentro del mismo servidor, un nginx reverse proxy)
- Mover `prisma generate` al build step del Dockerfile
- `prisma migrate deploy` como un step separado pre-deploy, no en el CMD

**Que modularizaria:**
- La logica de derivacion de wallets (brain wallet) deberia ser un modulo independiente que se pueda testear unitariamente
- El servicio de traducciones (DeepL) esta bien aislado pero no tiene retry ni manejo de quotas

---

## 10. Seguridad

### Riesgos detectados

| Riesgo | Severidad | Estado |
|--------|-----------|--------|
| **Session secret fallback a 'localhost'** | Critico | Debe fijar en produccion |
| **Inline script execution (XSS)** | Critico | `runInline=true` permite acceso al DOM y localStorage |
| **`/send-verification-mail` sin validacion** | Critico | Permite enviar emails de verificacion a cualquier cuenta |
| **CORS sin origin restriction** | Alto | Cualquier dominio puede hacer requests |
| **Sin rate limiting en auth** | Alto | Brute force posible |
| **API keys en texto plano en BD** | Alto | Si la BD se filtra, todas las API keys quedan expuestas |
| **JWT secret fallback 'your_jwt_secret'** en authMiddleware | Alto | Si la env var no esta, el secret es predecible |
| **Category/Tag CRUD sin admin check** | Alto | Cualquier usuario autenticado puede manipular taxonomia |
| **`$queryRawUnsafe` con interpolacion** | Medio | Actualmente seguro pero fragil ante futuros cambios |
| **Sin Content-Security-Policy headers** | Medio | Sin proteccion contra inline script injection |
| **Sin HTTPS redirect forzado** | Medio | CapRover probablemente lo maneja, verificar |
| **128 vulnerabilidades en dependencias** (9 criticas) | Alto | Ejecutar `npm audit fix` y actualizar manualmente las criticas |

### Prioridad de solucion

1. Session secret + JWT secret (dia 1)
2. Eliminar inline script execution (dia 1)
3. Fix verification mail endpoint (dia 1)
4. CORS + rate limiting (dia 2)
5. Admin-only category/tag CRUD (dia 2)
6. Hashear API keys (semana 1)
7. Dependency audit (semana 1)
8. CSP headers (semana 2)

### Problemas tipicos web2/web3 aplicables

- **El brain wallet genera keys en el navegador**: Correcto, pero no hay warning visible de que usar frases simples es peligroso. Anadir un indicador de fortaleza de la frase.
- **Wallet binding**: El mensaje de firma es generico ("Binding wallet"). Deberia incluir un nonce y timestamp para prevenir replay attacks.
- **Private keys visibles en DOM**: Cuando se muestran las private keys en el brain wallet, quedan en el DOM. Alguien con acceso fisico al navegador o una extension maliciosa puede leerlas. Anadir un boton explicito "Show" con warning.

---

## 11. SEO y contenido

### Problemas actuales

1. **SPA sin SSR**: Google puede renderizar SPAs pero con delay. Los articulos del blog no tendran meta tags correctos al compartir en redes sociales (sin og:title, og:description dinamicos).
2. **`<title>` estatico**: Siempre dice "ZEROxWORK" -- no cambia por pagina.
3. **Sin meta description** en ninguna pagina.
4. **Sin sitemap.xml** ni robots.txt configurados.
5. **Sin hreflang tags en el HTML** (existen en el API response pero no se renderizan en el `<head>`).
6. **URLs de articulos no son descriptivas en busqueda**: `/view-article/slug` en lugar de `/blog/slug` o directamente `/slug`.

### Quick wins

1. **React Helmet / react-helmet-async** para meta tags dinamicos por pagina
2. **Sitemap.xml** generado desde el backend con todos los articulos y sus traducciones
3. **robots.txt** basico permitiendo indexacion
4. **Canonicals** en articulos traducidos apuntando al original
5. Cambiar titulo de pagina dinamicamente con el titulo del articulo

### Estrategia recomendada

- **Corto plazo**: Meta tags dinamicos + sitemap + robots.txt
- **Medio plazo**: Pre-rendering con react-snap o similar para las paginas mas importantes
- **Largo plazo**: Migrar a Next.js/Remix para SSR real y SEO nativo

---

## 12. Conversion

### Por que no convierte

1. **No hay propuesta de valor visible**. Un visitante nuevo ve posts de blog sin contexto.
2. **No hay CTA claro**. No se le pide al usuario que haga nada.
3. **Las herramientas estan enterradas**. El brain wallet es la feature mas interesante pero requiere 3+ clics para llegar.
4. **El registro pide demasiado sin dar valor primero**. 3 checkboxes legales antes de poder crear una cuenta.
5. **No hay razon para registrarse**. Las tools funcionan sin registro, el blog es publico. El unico motivo es subir imagenes, pero eso no se comunica.

### Que falta

- Landing page con value proposition
- Feature tour o demo
- Trust signals (open source, "keys never leave your browser")
- Onboarding post-registro
- Razon clara para registrarse (guardar wallets generadas, historial, favoritos)

### Que cambiaria exactamente

1. **Home**: Reemplazar listado de posts por landing page con hero + tools + ultimos posts
2. **Header**: Anadir link directo "Brain Wallet" en la nav principal (no escondido en Tools)
3. **Brain Wallet page**: Anadir trust badges ("client-side only", "open source", "no tracking")
4. **Registro**: Mover los 3 checkboxes legales a una sola linea con link, reducir friccion
5. **Post-registro**: Redirigir a las tools, no a una pagina vacia

---

## 13. Score final

| Area | Score (1-10) | Comentario |
|------|:---:|-----------|
| **Producto** | 4 | Funcional pero sin identidad ni foco |
| **UX** | 3 | Sin onboarding, sin landing, sin CTA. Alert() para auth errors |
| **Conversion** | 2 | No hay funnel, no hay razon para registrarse |
| **Frontend** | 4 | Funciona pero bundle enorme, codigo duplicado, sin tests |
| **Backend** | 5 | Razonablemente bien estructurado pero con gaps de seguridad y validacion |
| **SEO** | 2 | SPA sin meta tags, sin sitemap, sin SSR. El sistema de slugs/traducciones es bueno pero invisible para Google |
| **Seguridad** | 3 | Session secret predecible, XSS via inline scripts, sin rate limiting en auth, CORS abierto |
| **Foco estrategico** | 3 | Intenta ser blog + image host + brain wallet + web3 identity sin excel en ninguno |

**Score global: 3.3 / 10**

El proyecto tiene buenos cimientos tecnicos (Prisma, TypeScript, sistema de traducciones, brain wallet) pero necesita foco brutal. La recomendacion principal: **elige una cosa, hazla excelente, y usa el blog como motor de trafico hacia esa cosa.** Esa cosa deberia ser el brain wallet / suite de herramientas cripto.

---

## Apendice: Archivos problematicos

| Archivo | Lineas | Problema |
|---------|--------|----------|
| `backend/src/routes/blog.ts` | 738 | Demasiado grande, mezcla 3 dominios, SQL raw |
| `frontend/src/pages/BrainWallet.tsx` | ~340 | Logica de derivacion mezclada con UI, crece con cada chain |
| `frontend/src/components/SandboxedArticleScript.tsx` | 270 | Transformer duplicado, vector XSS critico |
| `frontend/src/components/BindWallet.tsx` | 258 | Demasiadas responsabilidades en un componente |
| `frontend/src/pages/OldBrainWallet.tsx` | 10652 bytes | Codigo legacy que deberia eliminarse |
| `backend/src/routes/auth.ts` | 161 | PrismaClient duplicado, TODO sin resolver (check verified) |
| `backend/src/server.ts` | 99 | Debug endpoints, doble CORS middleware, session secret fragil |

---

*Generado por Claude Opus 4.6 como auditoria tecnica y de producto. Las recomendaciones son accionables y priorizadas por impacto en negocio.*
