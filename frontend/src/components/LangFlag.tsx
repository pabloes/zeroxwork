import type { SupportedLang } from "../i18n";

// 5-pointed star centred on 0,0 with radius 1, pointing up
const STAR = "M0-1 .2245-.309.951-.309.363.118.588.809 0 .382-.588.809-.363.118-.951-.309-.2245-.309Z";

const FLAGS: Record<SupportedLang, React.ReactNode> = {
    'es': (
        <>
            <rect width="20" height="14" fill="#AA151B" />
            <rect y="3.5" width="20" height="7" fill="#F1BF00" />
        </>
    ),
    'en': (
        <>
            <rect width="20" height="14" fill="#012169" />
            <path d="M0 0l20 14M20 0L0 14" stroke="#FFF" strokeWidth="2.8" />
            <path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.5" />
            <path d="M10 0v14M0 7h20" stroke="#FFF" strokeWidth="4.6" />
            <path d="M10 0v14M0 7h20" stroke="#C8102E" strokeWidth="2.6" />
        </>
    ),
    'pt-br': (
        <>
            <rect width="20" height="14" fill="#009B3A" />
            <path d="M10 1.4 18.6 7 10 12.6 1.4 7Z" fill="#FEDF00" />
            <circle cx="10" cy="7" r="3.1" fill="#002776" />
        </>
    ),
    'zh': (
        <>
            <rect width="20" height="14" fill="#DE2910" />
            <path d={STAR} fill="#FFDE00" transform="translate(4 4.2) scale(2.6)" />
            <path d={STAR} fill="#FFDE00" transform="translate(8.2 1.7) scale(.9)" />
            <path d={STAR} fill="#FFDE00" transform="translate(9.8 3.5) scale(.9)" />
            <path d={STAR} fill="#FFDE00" transform="translate(9.8 5.9) scale(.9)" />
            <path d={STAR} fill="#FFDE00" transform="translate(8.2 7.7) scale(.9)" />
        </>
    ),
};

const LangFlag: React.FC<{ lang: SupportedLang; className?: string }> = ({ lang, className }) => (
    <svg className={className} viewBox="0 0 20 14" aria-hidden="true">
        <g clipPath="url(#zx-flag-clip)">{FLAGS[lang]}</g>
        <defs>
            <clipPath id="zx-flag-clip">
                <rect width="20" height="14" rx="2" />
            </clipPath>
        </defs>
    </svg>
);

export default LangFlag;
