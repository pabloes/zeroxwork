import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "../i18n";
import { useArticles } from "../services/use-articles";
import ArticleCard from "../components/ArticleCard";
import ToolCard from "../components/ToolCard";
import ZxMark from "../components/ZxMark";

// one row each: the rest lives on /tools and /blog
const TOOLS_IN_ROW = 4;
const ARTICLES_IN_ROW = 3;

const KIT = [
    { key: 'kit1', accent: 'var(--zx-orange)', tag: 'landing.tag_code' },
    { key: 'kit2', accent: 'var(--zx-blue)', tag: 'landing.tag_collab' },
    { key: 'kit3', accent: 'var(--zx-mint)', tag: 'landing.tag_design' },
    { key: 'kit4', accent: 'var(--zx-cyan)', tag: 'landing.tag_code' },
    { key: 'kit5', accent: 'var(--zx-red)', tag: 'landing.tag_community' },
    { key: 'kit6', accent: 'var(--zx-orange)', tag: 'landing.tag_community' },
];

const DISCIPLINES = [
    { key: 'disc1', color: 'var(--zx-red)', meta: 'solidity · defi · on-chain' },
    { key: 'disc2', color: 'var(--zx-orange)', meta: 'react · shaders · canvas' },
    { key: 'disc3', color: 'var(--zx-blue)', meta: 'three.js · bevy · blender' },
    { key: 'disc4', color: 'var(--zx-mint)', meta: 'ui/ux · branding · arte' },
];

const Landing: React.FC = () => {
    const { t } = useTranslation();
    const { data: tools = [] } = useArticles('tool');
    const { data: articles = [] } = useArticles('blog');

    const latestArticles = [...articles]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, ARTICLES_IN_ROW);

    // reveal sections as they enter the viewport
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: .14 });

        document.querySelectorAll('.zx-reveal').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [tools.length, articles.length]);

    return (
        <div className="zx-landing">

            {/* hero */}
            <header className="zx-hero">
                <div className="zx-wrap zx-hero-grid">
                    <div>
                        <span className="zx-hero-eyebrow"><span className="zx-tick" />{t('landing.eyebrow')}</span>
                        <h1>{t('landing.h1_lead')} <span className="zx-spectrum-text">{t('landing.h1_accent')}</span></h1>
                        <p className="zx-lede">{t('landing.lede')}</p>
                        <div className="zx-cta-row">
                            <Link className="zx-btn zx-btn-primary" to="/register">
                                {t('landing.cta_join')} <span className="arr">→</span>
                            </Link>
                            <a className="zx-btn zx-btn-ghost" href="#tools">{t('landing.cta_tools')}</a>
                        </div>
                    </div>
                    <div className="zx-hero-visual">
                        <svg className="zx-rays" viewBox="0 0 460 360" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                            <g strokeWidth="1" opacity=".4">
                                <line x1="300" y1="120" x2="520" y2="-40" stroke="var(--zx-red)" />
                                <line x1="300" y1="240" x2="540" y2="420" stroke="var(--zx-blue)" />
                                <line x1="190" y1="120" x2="-40" y2="-40" stroke="var(--zx-orange)" />
                                <line x1="190" y1="240" x2="-60" y2="430" stroke="var(--zx-cyan)" />
                            </g>
                        </svg>
                        <ZxMark className="zx-bigmark" />
                    </div>
                </div>
            </header>

            <div className="zx-wrap"><div className="zx-diag-rule" /></div>

            {/* the two halves of the name */}
            <section className="zx-section" id="duality" style={{ paddingTop: '74px' }}>
                <div className="zx-wrap zx-reveal">
                    <div className="zx-duality-box">
                        <div className="zx-du-cell zx-du-tech">
                            <div className="big zx-mono">0</div>
                            <div className="kk">{t('landing.du_tech_kk')}</div>
                            <h3>{t('landing.du_tech_title')}</h3>
                            <p>{t('landing.du_tech_text')}</p>
                        </div>
                        <div className="zx-du-cross" aria-hidden="true">
                            <svg viewBox="0 0 84 160">
                                <line x1="6" y1="6" x2="78" y2="154" stroke="var(--zx-tech-ink)" strokeWidth="3" strokeLinecap="round" />
                                <line x1="78" y1="6" x2="6" y2="154" stroke="url(#zx-crossg)" strokeWidth="3" strokeLinecap="round" />
                                <defs>
                                    <linearGradient id="zx-crossg" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0" stopColor="#EF4D42" />
                                        <stop offset=".5" stopColor="#EF8D28" />
                                        <stop offset="1" stopColor="#2F9CFB" />
                                    </linearGradient>
                                </defs>
                                <circle cx="42" cy="80" r="5" fill="#EF8D28" />
                            </svg>
                        </div>
                        <div className="zx-du-cell zx-du-art">
                            <div className="big zx-mono">X</div>
                            <div className="kk">{t('landing.du_art_kk')}</div>
                            <h3>{t('landing.du_art_title')}</h3>
                            <p>{t('landing.du_art_text')}</p>
                        </div>
                    </div>
                    <div className="zx-du-caption">{t('landing.du_caption')}</div>
                </div>
            </section>

            {/* how it works */}
            <section className="zx-section" id="how">
                <div className="zx-wrap">
                    <div className="zx-how-head zx-reveal">
                        <div className="zx-eyebrow" style={{ color: 'var(--zx-orange)' }}>{t('landing.how_eyebrow')}</div>
                        <h2 className="zx-sec-title">{t('landing.how_title')}</h2>
                        <p className="zx-sec-sub">{t('landing.how_sub')}</p>
                    </div>
                    <div className="zx-steps zx-reveal">
                        {['step1', 'step2', 'step3'].map((step, i) => (
                            <div className="zx-step" key={step}>
                                <div className="num">{`0${i + 1}`}</div>
                                <h3>{t(`landing.${step}_title`)}</h3>
                                <p>{t(`landing.${step}_text`)}</p>
                                <div className="bar" style={{ background: ['var(--zx-red)', 'var(--zx-orange)', 'var(--zx-blue)'][i] }} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="zx-wrap"><div className="zx-diag-rule" /></div>

            {/* tools: one row of what is live, plus the member kit */}
            <section className="zx-section" id="tools">
                <div className="zx-wrap">
                    <div className="zx-row-head zx-reveal">
                        <div style={{ maxWidth: '32em' }}>
                            <div className="zx-eyebrow" style={{ color: 'var(--zx-ok)' }}>{t('landing.tools_eyebrow')}</div>
                            <h2 className="zx-sec-title">{t('landing.tools_title')}</h2>
                            <p className="zx-sec-sub">{t('landing.tools_sub')}</p>
                        </div>
                        <Link className="zx-more-link" to="/tools">{t('landing.tools_all')} →</Link>
                    </div>

                    {tools.length > 0 && (
                        <>
                            <div className="zx-sub-head zx-reveal"><span className="zx-tick" />{t('landing.tools_live')}</div>
                            <div className="zx-card-grid zx-cols-4 zx-reveal">
                                {tools.slice(0, TOOLS_IN_ROW).map((tool, i) => (
                                    <ToolCard key={tool.id} tool={tool} index={i} />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="zx-sub-head zx-reveal">{t('landing.kit')}</div>
                    <div className="zx-kit-grid zx-reveal">
                        {KIT.map(({ key, accent, tag }) => (
                            <div className="zx-kit" key={key} style={{ '--zx-accent': accent } as React.CSSProperties}>
                                <div className="dot" />
                                <h3>{t(`landing.${key}_title`)}</h3>
                                <p>{t(`landing.${key}_text`)}</p>
                                <span className="tag">{t(tag)}</span>
                            </div>
                        ))}
                    </div>
                    <span className="zx-free-pill">◆ {t('landing.free_pill')}</span>
                </div>
            </section>

            <div className="zx-wrap"><div className="zx-diag-rule" /></div>

            {/* disciplines */}
            <section className="zx-section" id="disc">
                <div className="zx-wrap zx-disc">
                    <div className="zx-reveal">
                        <div className="zx-eyebrow zx-spectrum-text">{t('landing.disc_eyebrow')}</div>
                        <h2 className="zx-sec-title">{t('landing.disc_title')}</h2>
                        <p className="zx-sec-sub">{t('landing.disc_sub')}</p>
                    </div>
                    <div className="zx-disc-bars zx-reveal">
                        {DISCIPLINES.map(({ key, color, meta }) => (
                            <div className="zx-disc-row" key={key}>
                                <span className="sw" style={{ background: color }} />
                                <span className="nm">{t(`landing.${key}`)}</span>
                                <span className="meta">{meta}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="zx-wrap"><div className="zx-diag-rule" /></div>

            {/* blog: one row of the latest articles */}
            <section className="zx-section" id="blog">
                <div className="zx-wrap">
                    <div className="zx-row-head zx-reveal">
                        <div style={{ maxWidth: '32em' }}>
                            <div className="zx-eyebrow" style={{ color: 'var(--zx-blue)' }}>{t('landing.blog_eyebrow')}</div>
                            <h2 className="zx-sec-title">{t('landing.blog_title')}</h2>
                        </div>
                        <Link className="zx-more-link" to="/blog">{t('landing.blog_all')} →</Link>
                    </div>
                    <div className="zx-card-grid zx-reveal">
                        {latestArticles.map((article) => (
                            <ArticleCard key={article.id} article={article} />
                        ))}
                    </div>
                </div>
            </section>

            {/* closing CTA */}
            <section className="zx-cta-band" id="join">
                <div className="zx-wrap">
                    <div className="zx-cta-box zx-reveal">
                        <h2>
                            {t('landing.cta_title_a')}<br />
                            {t('landing.cta_title_b')} <span className="zx-spectrum-text">{t('landing.cta_title_accent')}</span>
                        </h2>
                        <p>{t('landing.cta_text')}</p>
                        <Link className="zx-btn zx-btn-primary" to="/register">
                            {t('landing.cta_button')} <span className="arr">→</span>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Landing;
