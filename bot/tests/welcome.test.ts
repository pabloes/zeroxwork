import { describe, it, expect } from 'vitest';
import {
    DEFAULT_WELCOME_LANG,
    HELP_CHANNEL_NAME,
    LANG_FLAGS,
    MAX_MESSAGE_LENGTH,
    WELCOME,
    WELCOME_LANGS,
    buildWelcomeMessage,
    generalChannelName,
    parseWelcomeCustomId,
    pickAskChannel,
    renderWelcome,
    welcomeCustomId,
} from '../src/welcome.js';

const CHANNEL_ID = '1567562204243562648'; // a real-length snowflake: mentions are longer than the placeholder
const GAMES = ['Golfcraft', 'Portal Lake', 'Claim Bite', 'Elon Race', 'Flappy Roadster'];

describe('welcome texts', () => {
    it.each(WELCOME_LANGS)('%s fits in one Discord message once the channel mention is filled in', (lang) => {
        expect(renderWelcome(lang, CHANNEL_ID).length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    });

    it.each(WELCOME_LANGS)('%s tells the reader how to get in, with links that do not unfurl', (lang) => {
        const text = renderWelcome(lang, CHANNEL_ID);
        expect(text).toContain('<https://zeroxwork.com>');
        expect(text).toContain('<https://zeroxwork.com/account>');
        expect(text).toContain('ZEROxMEMBER');
    });

    it.each(WELCOME_LANGS)('%s presents both halves and names every game', (lang) => {
        const text = renderWelcome(lang, CHANNEL_ID);
        expect(text).toContain('ZEROxWORK');
        expect(text).toContain('ZEROxPLAY');
        for (const game of GAMES) expect(text).toContain(game);
    });

    it.each(WELCOME_LANGS)('%s leaves no placeholder behind', (lang) => {
        expect(renderWelcome(lang, CHANNEL_ID)).not.toMatch(/\{[a-z]+\}/);
        expect(renderWelcome(lang, CHANNEL_ID)).toContain(`<#${CHANNEL_ID}>`);
    });

    it('keeps the phrase the brand is described with in Spanish', () => {
        expect(WELCOME.es.body).toContain('comunidad-cowork online');
    });

    it('falls back to the channel name when its id is not known', () => {
        expect(renderWelcome('es')).toContain('#help');
        expect(renderWelcome('es', null)).not.toContain('<#');
    });
});

describe('where to ask', () => {
    const generals = WELCOME_LANGS.map((lang, index) => ({ id: `id-${index}`, name: generalChannelName(lang) }));
    const help = { id: 'id-help', name: HELP_CHANNEL_NAME };
    const idOf = (lang: (typeof WELCOME_LANGS)[number]) => generals[WELCOME_LANGS.indexOf(lang)].id;

    it('names each general channel after its flag, all different', () => {
        const names = WELCOME_LANGS.map(generalChannelName);
        expect(new Set(names).size).toBe(WELCOME_LANGS.length);
        for (const lang of WELCOME_LANGS) {
            expect(generalChannelName(lang)).toBe(`${LANG_FLAGS[lang]}-general`);
        }
        expect(generalChannelName('en')).toBe('🇬🇧-general');
    });

    it.each(WELCOME_LANGS)('sends a linked %s reader to the general channel of their language', (lang) => {
        expect(pickAskChannel(lang, [help, ...generals])).toBe(idOf(lang));
    });

    it.each(WELCOME_LANGS)('sends a %s reader who has not linked, and can only write in #help, to #help', (lang) => {
        expect(pickAskChannel(lang, [help])).toBe('id-help');
    });

    it('falls back to the English channel when theirs is missing', () => {
        const withoutFrench = generals.filter((channel) => channel.name !== generalChannelName('fr'));
        expect(pickAskChannel('fr', [help, ...withoutFrench])).toBe(idOf('en'));
    });

    it('still finds the single #general of a server that has not been split', () => {
        expect(pickAskChannel('es', [{ id: 'old', name: 'general' }])).toBe('old');
    });

    it('prefers #help over a leftover #general', () => {
        expect(pickAskChannel('zh', [{ id: 'old', name: 'general' }, help])).toBe('id-help');
    });

    it('gives nothing when there is no channel to point at, and the text names #help instead', () => {
        expect(pickAskChannel('es', [{ id: 'x', name: 'projects' }])).toBeNull();
        expect(renderWelcome('es', pickAskChannel('es', []))).toContain('#help');
    });
});

describe('buttons', () => {
    it('offers one button per language in a single row, which is all Discord allows', () => {
        const message = buildWelcomeMessage();
        expect(message.components).toHaveLength(1);
        expect(message.components[0].components).toHaveLength(WELCOME_LANGS.length);
        expect(WELCOME_LANGS.length).toBeLessThanOrEqual(5);
    });

    it('gives every button its own id and label', () => {
        const buttons = buildWelcomeMessage().components[0].components;
        expect(new Set(buttons.map((b) => b.custom_id)).size).toBe(buttons.length);
        expect(new Set(buttons.map((b) => b.label)).size).toBe(buttons.length);
    });

    it('round-trips the language through the button id', () => {
        for (const lang of WELCOME_LANGS) {
            expect(parseWelcomeCustomId(welcomeCustomId(lang))).toBe(lang);
        }
    });

    it('ignores buttons that are not ours', () => {
        for (const id of ['', 'es', 'other:es', 'Welcome:es']) {
            expect(parseWelcomeCustomId(id)).toBeNull();
        }
    });

    it('answers in English when one of our buttons names a language we do not have', () => {
        for (const id of ['welcome:', 'welcome:de', 'welcome:es:extra', 'welcome:ES']) {
            expect(parseWelcomeCustomId(id)).toBe('en');
        }
    });

    it('puts English first, as the button and in the public text', () => {
        const message = buildWelcomeMessage();
        expect(DEFAULT_WELCOME_LANG).toBe('en');
        expect(WELCOME_LANGS[0]).toBe('en');
        expect(message.components[0].components[0].custom_id).toBe(welcomeCustomId('en'));
        const [, greetings, choose] = message.content.split('\n');
        expect(greetings.startsWith('Welcome')).toBe(true);
        expect(choose.startsWith('Choose your language')).toBe(true);
    });

    it('renders English for a language that is not there at runtime', () => {
        expect(renderWelcome('de' as never, CHANNEL_ID)).toBe(renderWelcome('en', CHANNEL_ID));
    });

    it('keeps the public message short and language-neutral', () => {
        const { content } = buildWelcomeMessage();
        expect(content.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
        expect(content).toContain('ZEROxWORK');
        expect(content).toContain('ZEROxPLAY');
    });
});
