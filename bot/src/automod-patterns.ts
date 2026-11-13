/**
 * Names that pass themselves off as the team.
 *
 * The usual scam is not a link in a channel, which AutoMod already blocks: it
 * is somebody called "ZEROxWORK Support" writing to members in private. A
 * member profile rule stops them before they can interact at all.
 *
 * Narrow on purpose. The brand next to a word for staff, in either order, and
 * nothing else: "ZEROxWORK fan" is fine, so is a person called Mod, and so is
 * anybody who only says "support". Written in the Rust flavour AutoMod runs,
 * kept to what JavaScript reads the same way so the tests can exercise them.
 */

/** The brand as an impostor would write it: spaces, a dot, zeros for the o. */
const BRAND = 'z[e3]r[o0][\\s._-]*x[\\s._-]*(w[o0]rk|pl[a4]y)';
/** Words that claim to speak for the team. */
const STAFF = '(support|supp[o0]rt|admin(istrator)?|mod(erator)?s?|team|staff|official|help\\s*desk)';

export const IMPERSONATION_PATTERNS = [
    `(?i)${BRAND}.{0,20}\\b${STAFF}\\b`,
    `(?i)\\b${STAFF}\\b.{0,20}${BRAND}`,
];
