/**
 * Multilingual welcome for the rules channel.
 *
 * One public message with a button per language. Pressing a button answers with
 * the full text in that language, visible only to whoever pressed it, so the
 * channel keeps a single message and nobody scrolls past four languages to find
 * their own.
 *
 * Everything here is plain data and pure functions; publishing lives in
 * welcome-publish.ts.
 */

export const WELCOME_LANGS = ['es', 'en', 'pt-br', 'zh', 'fr'] as const;
export type WelcomeLang = typeof WELCOME_LANGS[number];

const CUSTOM_ID_PREFIX = 'welcome:';

/** Discord rejects message content above this. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * `{general}` becomes a mention of the open channel, where unlinked members can ask.
 * Links are wrapped in <> so Discord does not unfurl a preview under the text.
 * The link step points at /account directly: the page is reached from a menu
 * whose label differs per language, and a URL cannot be mistranslated.
 */
export const WELCOME: Record<WelcomeLang, { label: string; body: string }> = {
    es: {
        label: 'Español',
        body: `**Bienvenido a ZEROxWORK**

Tanto si vienes a construir como a jugar, este es tu sitio.

**ZEROxWORK · construir**
Una comunidad-cowork online donde el código y el arte comparten mesa. Juntamos equipos de desarrollo y diseño para sacar adelante proyectos ambiciosos.

**ZEROxPLAY · jugar**
Los juegos que salen de aquí: Golfcraft, Portal Lake, Claim Bite, Elon Race y Flappy Roadster. Cada uno tiene su canal para jugar, comentar y proponer mejoras.

Lo uno alimenta a lo otro. Lo que se construye en WORK se juega en PLAY, y quien juega acaba probando, opinando y, si quiere, construyendo.

**Cómo entrar del todo**
Ahora mismo solo ves una parte del servidor. Para ver los canales de proyectos, los de cada juego y la voz:
1. Crea tu cuenta en <https://zeroxwork.com> y verifica tu email.
2. Entra en <https://zeroxwork.com/account> y pulsa **Vincular Discord**.
3. En unos segundos recibirás el rol **ZEROxMEMBER** y aparecerán los canales.

**Normas**
- Respeto. Se critica el trabajo, no a la persona.
- Nada de spam, publicidad ni enlaces de referidos.
- Nadie del equipo te escribirá por privado para pedirte claves, frases semilla ni que conectes tu wallet. Si te pasa, es una estafa: avisa en {general}.

¿Dudas? Pregunta en {general}.`,
    },
    en: {
        label: 'English',
        body: `**Welcome to ZEROxWORK**

Whether you come to build or to play, this is your place.

**ZEROxWORK · build**
An online community-cowork where code and art share a table. We put together teams of developers and designers to take ambitious projects all the way.

**ZEROxPLAY · play**
The games that come out of here: Golfcraft, Portal Lake, Claim Bite, Elon Race and Flappy Roadster. Each one has its own channel to play, talk about it and suggest improvements.

One feeds the other. What gets built in WORK gets played in PLAY, and those who play end up testing, giving feedback and, if they want, building.

**How to get full access**
Right now you only see part of the server. To see the project channels, the channel for each game and voice:
1. Create your account at <https://zeroxwork.com> and verify your email.
2. Go to <https://zeroxwork.com/account> and press **Link Discord**.
3. Within a few seconds you will get the **ZEROxMEMBER** role and the channels will appear.

**Rules**
- Respect. Criticise the work, not the person.
- No spam, advertising or referral links.
- Nobody from the team will ever message you privately to ask for keys, seed phrases or to connect your wallet. If that happens, it is a scam: report it in {general}.

Questions? Ask in {general}.`,
    },
    'pt-br': {
        label: 'Português',
        body: `**Bem-vindo à ZEROxWORK**

Seja para construir ou para jogar, aqui é o seu lugar.

**ZEROxWORK · construir**
Uma comunidade-cowork online onde o código e a arte dividem a mesma mesa. Reunimos equipes de desenvolvimento e design para tirar projetos ambiciosos do papel.

**ZEROxPLAY · jogar**
Os jogos que nascem aqui: Golfcraft, Portal Lake, Claim Bite, Elon Race e Flappy Roadster. Cada um tem seu canal para jogar, comentar e sugerir melhorias.

Uma coisa alimenta a outra. O que se constrói no WORK se joga no PLAY, e quem joga acaba testando, opinando e, se quiser, construindo.

**Como entrar de vez**
Por enquanto você vê só uma parte do servidor. Para ver os canais de projetos, os de cada jogo e a voz:
1. Crie sua conta em <https://zeroxwork.com> e verifique seu e-mail.
2. Acesse <https://zeroxwork.com/account> e clique em **Vincular Discord**.
3. Em alguns segundos você receberá o cargo **ZEROxMEMBER** e os canais vão aparecer.

**Regras**
- Respeito. Critica-se o trabalho, não a pessoa.
- Nada de spam, publicidade ou links de indicação.
- Ninguém da equipe vai escrever para você no privado pedindo chaves, frases-semente ou para conectar sua carteira. Se acontecer, é golpe: avise em {general}.

Dúvidas? Pergunte em {general}.`,
    },
    zh: {
        label: '中文',
        body: `**欢迎来到 ZEROxWORK**

无论你是来共创还是来玩游戏，这里都是你的地方。

**ZEROxWORK · 共创**
一个在线社区共创空间，代码与艺术在同一张桌上共创。我们把开发与设计团队组合起来，一起把有野心的项目做出来。

**ZEROxPLAY · 游戏**
从这里诞生的游戏：Golfcraft、Portal Lake、Claim Bite、Elon Race 和 Flappy Roadster。每款游戏都有自己的频道，可以一起玩、交流和提出改进建议。

两者相辅相成：在 WORK 里做出来的，在 PLAY 里玩；玩的人会参与测试、给出反馈，愿意的话也可以加入共创。

**如何获得完整权限**
现在你只能看到服务器的一部分。要看到项目频道、各游戏频道和语音频道：
1. 在 <https://zeroxwork.com> 注册账号并验证邮箱。
2. 打开 <https://zeroxwork.com/account>，点击 **绑定 Discord**。
3. 几秒钟后你会获得 **ZEROxMEMBER** 身份组，频道随即出现。

**规则**
- 互相尊重。评价作品，不针对个人。
- 禁止垃圾信息、广告和推广链接。
- 团队成员绝不会私信向你索要密钥、助记词，或要求你连接钱包。如果遇到，那就是诈骗：请在 {general} 告知大家。

有问题？在 {general} 提问。`,
    },
    fr: {
        label: 'Français',
        body: `**Bienvenue sur ZEROxWORK**

Que vous veniez pour construire ou pour jouer, vous êtes au bon endroit.

**ZEROxWORK · construire**
Une communauté-cowork en ligne où le code et l'art partagent la même table. Nous réunissons des équipes de développement et de design pour mener à bien des projets ambitieux.

**ZEROxPLAY · jouer**
Les jeux qui naissent ici : Golfcraft, Portal Lake, Claim Bite, Elon Race et Flappy Roadster. Chacun a son salon pour jouer, en discuter et proposer des améliorations.

L'un nourrit l'autre. Ce qui se construit dans WORK se joue dans PLAY, et ceux qui jouent finissent par tester, donner leur avis et, s'ils le souhaitent, construire.

**Comment accéder à tout**
Pour l'instant, vous ne voyez qu'une partie du serveur. Pour voir les salons de projets, ceux de chaque jeu et le vocal :
1. Créez votre compte sur <https://zeroxwork.com> et vérifiez votre e-mail.
2. Allez sur <https://zeroxwork.com/account> et cliquez sur **Lier Discord**.
3. En quelques secondes, vous recevrez le rôle **ZEROxMEMBER** et les salons apparaîtront.

**Règles**
- Respect. On critique le travail, pas la personne.
- Pas de spam, de publicité ni de liens de parrainage.
- Personne de l'équipe ne vous écrira en privé pour vous demander des clés, des phrases de récupération ou de connecter votre wallet. Si cela arrive, c'est une arnaque : signalez-le dans {general}.

Des questions ? Posez-les dans {general}.`,
    },
};

/** The message everyone sees: language-neutral, with one button per language. */
export const WELCOME_HEADER = [
    '**ZEROxWORK · ZEROxPLAY**',
    'Bienvenido · Welcome · Bem-vindo · 欢迎 · Bienvenue',
    'Elige idioma · Choose your language · Escolha o idioma · 选择语言 · Choisissez la langue',
].join('\n');

export function welcomeCustomId(lang: WelcomeLang): string {
    return `${CUSTOM_ID_PREFIX}${lang}`;
}

/** The language behind a pressed button, or null when the button is not ours. */
export function parseWelcomeCustomId(customId: string): WelcomeLang | null {
    if (!customId.startsWith(CUSTOM_ID_PREFIX)) return null;
    const lang = customId.slice(CUSTOM_ID_PREFIX.length);
    return (WELCOME_LANGS as readonly string[]).includes(lang) ? (lang as WelcomeLang) : null;
}

export interface WelcomeButton {
    type: 2;
    style: 2;
    label: string;
    custom_id: string;
}

export interface WelcomeMessage {
    content: string;
    components: [{ type: 1; components: WelcomeButton[] }];
}

/** Raw API shape: comparable in tests and against what is already published. */
export function buildWelcomeMessage(): WelcomeMessage {
    return {
        content: WELCOME_HEADER,
        components: [{
            type: 1,
            components: WELCOME_LANGS.map((lang) => ({
                type: 2,
                style: 2,
                label: WELCOME[lang].label,
                custom_id: welcomeCustomId(lang),
            })),
        }],
    };
}

/** Full text for one language, pointing at the open channel when its id is known. */
export function renderWelcome(lang: WelcomeLang, generalChannelId?: string | null): string {
    const general = generalChannelId ? `<#${generalChannelId}>` : '#general';
    return WELCOME[lang].body.replaceAll('{general}', general);
}
