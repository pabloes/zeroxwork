/**
 * One block of a ficha: the column of facts beside a project or an article.
 * Rendered only when it has something in it, so the caller builds a list of
 * these and lets the count decide the layout.
 */
const FichaSlot: React.FC<{ label: string; note?: string | null; children: React.ReactNode }> =
    ({ label, note, children }) => (
        <div className="zx-ficha-slot">
            <p className="zx-ficha-label">{label}</p>
            {children}
            {note && <p className="zx-ficha-note">{note}</p>}
        </div>
    );

export default FichaSlot;
