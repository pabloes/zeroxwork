import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import '../styles/SpeedTest.scss';

interface SpeedResult {
    ping: number | null;
    download: number | null;
    upload: number | null;
}

type TestPhase = 'idle' | 'ping' | 'download' | 'upload' | 'done';

const API_BASE = import.meta.env.VITE_API_URL || '';

const SpeedTest: React.FC = () => {
    const { t } = useTranslation();
    const [result, setResult] = useState<SpeedResult>({ ping: null, download: null, upload: null });
    const [phase, setPhase] = useState<TestPhase>('idle');
    const [progress, setProgress] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    const runTest = useCallback(async () => {
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;
        setResult({ ping: null, download: null, upload: null });
        setProgress(0);

        try {
            // --- Ping ---
            setPhase('ping');
            const pings: number[] = [];
            for (let i = 0; i < 5; i++) {
                if (signal.aborted) return;
                const start = performance.now();
                await fetch(`${API_BASE}/api/speedtest/ping?_=${Date.now()}`, { signal, cache: 'no-store' });
                pings.push(performance.now() - start);
                setProgress(((i + 1) / 5) * 100);
            }
            const avgPing = pings.sort((a, b) => a - b).slice(1, -1).reduce((s, v) => s + v, 0) / 3;
            setResult(prev => ({ ...prev, ping: Math.round(avgPing) }));

            // --- Download ---
            setPhase('download');
            setProgress(0);
            const dlSize = 10 * 1024 * 1024; // 10 MB
            const dlStart = performance.now();
            const dlRes = await fetch(`${API_BASE}/api/speedtest/download?size=${dlSize}&_=${Date.now()}`, { signal, cache: 'no-store' });
            const reader = dlRes.body?.getReader();
            let dlReceived = 0;
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done || signal.aborted) break;
                    dlReceived += value.byteLength;
                    setProgress((dlReceived / dlSize) * 100);
                }
            }
            const dlTime = (performance.now() - dlStart) / 1000;
            const dlSpeed = (dlReceived * 8) / dlTime / 1_000_000; // Mbps
            setResult(prev => ({ ...prev, download: Math.round(dlSpeed * 100) / 100 }));

            // --- Upload ---
            setPhase('upload');
            setProgress(0);
            const ulSize = 5 * 1024 * 1024; // 5 MB
            const blob = new Blob([new Uint8Array(ulSize)]);
            const ulStart = performance.now();

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_BASE}/api/speedtest/upload`);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) setProgress((e.loaded / e.total) * 100);
                };
                xhr.onload = () => resolve();
                xhr.onerror = () => reject(new Error('Upload failed'));
                signal.addEventListener('abort', () => { xhr.abort(); reject(new Error('Aborted')); });
                xhr.send(blob);
            });

            const ulTime = (performance.now() - ulStart) / 1000;
            const ulSpeed = (ulSize * 8) / ulTime / 1_000_000; // Mbps
            setResult(prev => ({ ...prev, upload: Math.round(ulSpeed * 100) / 100 }));

            setPhase('done');
            setProgress(100);
        } catch (err: any) {
            if (err.name !== 'AbortError' && err.message !== 'Aborted') {
                console.error('Speed test error:', err);
            }
            setPhase('idle');
        }
    }, []);

    const stopTest = () => {
        abortRef.current?.abort();
        setPhase('idle');
        setProgress(0);
    };

    const isRunning = phase !== 'idle' && phase !== 'done';

    return (
        <div className="speedtest-container">
            <h1>{t('speedtest.title')}</h1>
            <p className="speedtest-subtitle">{t('speedtest.subtitle')}</p>

            <div className="speedtest-results">
                <div className={`speedtest-metric ${phase === 'ping' ? 'active' : ''}`}>
                    <span className="metric-label">{t('speedtest.ping')}</span>
                    <span className="metric-value">
                        {result.ping !== null ? `${result.ping} ms` : '—'}
                    </span>
                </div>
                <div className={`speedtest-metric ${phase === 'download' ? 'active' : ''}`}>
                    <span className="metric-label">{t('speedtest.download')}</span>
                    <span className="metric-value">
                        {result.download !== null ? `${result.download} Mbps` : '—'}
                    </span>
                </div>
                <div className={`speedtest-metric ${phase === 'upload' ? 'active' : ''}`}>
                    <span className="metric-label">{t('speedtest.upload')}</span>
                    <span className="metric-value">
                        {result.upload !== null ? `${result.upload} Mbps` : '—'}
                    </span>
                </div>
            </div>

            {isRunning && (
                <div className="speedtest-progress">
                    <div className="speedtest-progress-bar" style={{ width: `${progress}%` }} />
                    <span className="speedtest-phase">{t(`speedtest.phase_${phase}`)}</span>
                </div>
            )}

            <div className="speedtest-actions">
                {isRunning ? (
                    <button className="uk-button uk-button-danger" onClick={stopTest}>
                        {t('speedtest.stop')}
                    </button>
                ) : (
                    <button className="uk-button uk-button-primary speedtest-start-btn" onClick={runTest}>
                        {phase === 'done' ? t('speedtest.retest') : t('speedtest.start')}
                    </button>
                )}
            </div>

            <p className="speedtest-note">{t('speedtest.note')}</p>
        </div>
    );
};

export default SpeedTest;
