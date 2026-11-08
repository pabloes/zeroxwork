import { Link } from 'react-router-dom';
import type { ArticleCredit } from "../services/use-articles";
import { useTranslation } from "../i18n";

interface Props {
    credits: ArticleCredit[];
    withLabel?: boolean;
    /**
     * false inside a card that is itself one big link: a link within a link is
     * invalid markup and the inner one swallows the card's own click.
     */
    linked?: boolean;
}

/**
 * Who made this. A credit tied to an account links to that member's page; one
 * that is not is somebody with no ZEROxWORK account (yet), and is shown as
 * plain text rather than a dead link.
 */
const CreditList: React.FC<Props> = ({ credits, withLabel, linked = true }) => {
    const { t } = useTranslation();
    if (credits.length === 0) return null;

    return (
        <div className="zx-credits">
            {withLabel && <span className="zx-credits-label">{t('portfolio.made_by')}</span>}
            <span className="zx-credits-names">
                {credits.map((credit, index) => (
                    <span className="zx-credit" key={`${credit.name}-${index}`}>
                        {/* A credit links to a member as soon as it is tied to an
                            account. The handle makes a nicer URL when there is
                            one; the id is what always works. A credit with
                            neither is just a name somebody typed. */}
                        {linked && (credit.handle || credit.userId)
                            ? <Link to={`/member/${credit.handle ?? credit.userId}`}>{credit.name}</Link>
                            : <span>{credit.name}</span>}
                        {credit.role && <span className="zx-credit-role">{credit.role}</span>}
                    </span>
                ))}
            </span>
        </div>
    );
};

export default CreditList;
