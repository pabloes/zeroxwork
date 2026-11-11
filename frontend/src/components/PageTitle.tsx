import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The page's heading, which also sets the browser tab's title.
 *
 * `className` is here for pages with a look of their own: the portfolio's
 * heading is set in its own type scale, and a page should not have to choose
 * between that and keeping the tab title right.
 */
const PageTitle = ({ title, className }: { title: string; className?: string }) => {
    const location = useLocation();

    useEffect(() => {
        document.title = `ZEROxWORK | ${title}`;
    }, [location, title]);

    return (
        <h1 className={className ?? 'uk-heading-medium uk-margin-bottom'}>{title}</h1>
    );
};

export default PageTitle;