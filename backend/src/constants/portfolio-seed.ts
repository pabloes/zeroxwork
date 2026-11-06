/**
 * The projects that fill the portfolio, as data.
 *
 * Kept apart from the seeding script so the shape can be tested without a
 * database, and so adding a project is a change to this file alone.
 *
 * Images live in frontend/public/portfolio/ and are served straight from the
 * site, not hotlinked from somebody else's host.
 *
 * `credits.handle` is the ZEROxWORK handle of the person, when they have an
 * account. The seeding script links the credit to that account if a user with
 * that handle exists, and otherwise stores the name on its own, so people who
 * have not registered yet can still be credited.
 */

export interface SeedCredit {
    name: string;
    handle?: string;
    role?: string;
}

export interface SeedProject {
    slug: string;
    title: string;
    lang: string;
    tags: string[];
    thumbnail: string | null;
    credits: SeedCredit[];
    content: string;
}

export const PORTFOLIO_CATEGORY = 'project';

export const PORTFOLIO_PROJECTS: SeedProject[] = [
    {
        slug: 'golfcraft',
        title: 'Golfcraft',
        lang: 'en',
        tags: ['GAME', 'METAVERSE', 'DECENTRALAND', 'MULTIPLAYER'],
        thumbnail: '/portfolio/golfcraft.jpg',
        credits: [
            { name: 'Pablo', handle: 'pablo', role: 'code' },
            { name: 'Carlos', handle: 'carlosmu', role: 'code' },
        ],
        content: `A minigolf game for Decentraland, live since 2020 and still running.

👉 [Play it in Decentraland](https://decentraland.org/places/place/47,-45) — Genesis City, on desktop and in the Decentraland mobile app.

## What you can do

- **Ranked runs.** Four maps picked for your rank, against three recorded players, any time, with nobody to wait for. Rank points move you up the ladder, and milestones hand out the season's wearables.
- **Ranked with friends.** Two to four players on the same maps at once, each seeing the others' balls.
- **Tutorial missions** with the clubhouse scientist, a club workshop, daily missions and a prizes board.
- Everything is reached from a 2D menu built for phones first. A run costs one energy, and you get ten a day.

## How it is built

A Decentraland SDK7 scene for the lobby, menus, courses, physics and shot controls; a Colyseus game server for the ranked, party, mission and tournament rooms; and a REST API behind the courses, tournaments and stats.

## Where it is going

Community tournaments in the game menu, in the two formats Golfcraft has always had — async, open between a start and an end date so each player goes when they can, and live, everyone on the same maps at the same time — and then the in-world map editor and the map-building contests that need it.`,
    },
    {
        slug: 'moneygrass',
        title: 'Money Grass',
        lang: 'en',
        tags: ['ART', 'METAVERSE', 'DECENTRALAND', '3D'],
        thumbnail: '/portfolio/moneygrass.jpg',
        credits: [
            { name: 'Carlos', handle: 'carlosmu' },
            { name: 'Pablo', handle: 'pablo' },
            { name: 'Llacer', handle: 'llacer' },
        ],
        content: `An art piece built to be walked through, not looked at.

👉 [Visit it in Decentraland](https://decentraland.org/places/place/-133,-95) — Genesis City, four parcels.

*Money Grass* is a meadow of banknotes where faceless beings graze blindly, while the signs around them spell out a consumerist society headed for the slaughterhouse.

It is a 3D installation rather than a game: there is nothing to win and no score. What the space does is put you inside the metaphor at your own scale — you arrive, you walk among the grazers, you read the signs, and the piece lands or it does not.`,
    },
    {
        slug: 'claimbite',
        title: 'Claim Bite',
        lang: 'en',
        tags: ['GAME', 'METAVERSE', 'DECENTRALAND', 'WEB3'],
        thumbnail: '/portfolio/claimbite.jpg',
        credits: [
            { name: 'Carlos', handle: 'carlosmu', role: 'code' },
        ],
        content: `A gold-rush mining game, set in its own Decentraland world.

👉 [Play it in Decentraland](https://decentraland.org/places/world/claimbite.dcl.eth)

Grab your pickaxe, mine for gold and build your fortune in the Wild West: upgrade your gear, read the market better than the other miners, and end up the richest one in town.

Being a World rather than a Genesis City scene means the whole place is the game — no neighbours, no parcel budget shared with anyone else, and the layout can be exactly what the loop needs.`,
    },
];
