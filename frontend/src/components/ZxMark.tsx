// ZEROxWORK mark. The X disc keeps the original artwork; the "0" is redrawn as
// vector on top of it, so it stays whole (the raster had it cut by the X disc)
// and can take the ink or the light colour depending on the theme.
// Geometry measured from public/zx-mark.png (240x136).

import { useId } from 'react';

const ZERO_C = { x: 65.84, y: 69.14, r: 66.34 };
const HOLE_R = 33;
const BAR_H = 28.3;

const ZxMark: React.FC<{ className?: string; title?: string }> = ({ className, title = 'ZEROxWORK' }) => {
    const uid = useId();
    const cutId = `zx-cut-${uid}`;
    const zeroId = `zx-zero-${uid}`;

    return (
        <svg className={`zx-mark ${className ?? ''}`.trim()} viewBox="0 0 240 136" role="img" aria-label={title}>
            <defs>
                {/* everything but the "0" disc, so the raster's cut-off zero never shows */}
                <clipPath id={cutId} clipPathUnits="userSpaceOnUse">
                    <path
                        clipRule="evenodd"
                        d={`M0 0H240V136H0Z M${ZERO_C.x - ZERO_C.r} ${ZERO_C.y}a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${ZERO_C.r * 2} 0a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${-ZERO_C.r * 2} 0Z`}
                    />
                </clipPath>
                <clipPath id={zeroId} clipPathUnits="userSpaceOnUse">
                    <circle cx={ZERO_C.x} cy={ZERO_C.y} r={ZERO_C.r} />
                </clipPath>
            </defs>

            <image href="/zx-mark.png" x="0" y="0" width="240" height="136" clipPath={`url(#${cutId})`} />

            {/* keeps the two discs readable when both are dark */}
            <circle
                className="zx-mark-gap"
                cx={ZERO_C.x}
                cy={ZERO_C.y}
                r={ZERO_C.r}
                fill="none"
                strokeWidth="3.4"
            />

            <g className="zx-mark-zero" clipPath={`url(#${zeroId})`}>
                <path
                    fillRule="evenodd"
                    d={`M${ZERO_C.x - ZERO_C.r} ${ZERO_C.y}a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${ZERO_C.r * 2} 0a${ZERO_C.r} ${ZERO_C.r} 0 1 0 ${-ZERO_C.r * 2} 0Z`
                        + `M${ZERO_C.x - HOLE_R} ${ZERO_C.y}a${HOLE_R} ${HOLE_R} 0 1 0 ${HOLE_R * 2} 0a${HOLE_R} ${HOLE_R} 0 1 0 ${-HOLE_R * 2} 0Z`}
                />
                <rect
                    x={ZERO_C.x - ZERO_C.r}
                    y={ZERO_C.y - BAR_H / 2}
                    width={ZERO_C.r * 2}
                    height={BAR_H}
                    transform={`rotate(-45 ${ZERO_C.x} ${ZERO_C.y})`}
                />
            </g>
        </svg>
    );
};

export default ZxMark;
