export const ROLE = {
    ADMIN: 'ADMIN',
    USER: 'USER',
} as const;

export type RoleType = typeof ROLE[keyof typeof ROLE];