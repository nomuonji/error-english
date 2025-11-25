import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, random } from 'remotion';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { Rect, Circle } from '@remotion/shapes';
import React from 'react';

const { fontFamily } = loadFont();
const { fontFamily: monoFamily } = loadMono();

export const myCompSchema = z.object({
    targetWord: z.string(),
    errorMessage: z.string(),
    generalMeaning: z.string(),
    generalExample: z.string(),
    techMeaning: z.string(),
    explanation: z.string(),
    usageContext: z.string(),
    usageExample: z.string(),
    usagePunchline: z.string(),
});

// Mock Code for background
const mockCode = `function processData(data) {
  if (!data) {
    return null;
  }
  const result = data.map(item => {
    return transform(item);
  });
  return result;
}

async function main() {
  console.log("Starting...");
  await initSystem();
  // TODO: Fix this later
  const user = await getUser();
`;

// Scene 1: The Panic (Development Context) (0-5s)
const PanicScene: React.FC<{ errorMessage: string }> = ({ errorMessage }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Typing effect
    const charsToShow = Math.floor(interpolate(frame, [0, 60], [0, mockCode.length]));
    const currentCode = mockCode.substring(0, charsToShow);

    // Error Popup appearance
    const errorFrame = 45;
    const showError = frame > errorFrame;
    const errorScale = spring({
        frame: frame - errorFrame,
        fps,
        config: { damping: 15, stiffness: 120 }
    });

    return (
        <AbsoluteFill style={{ backgroundColor: '#1e1e1e', fontFamily: monoFamily, color: '#d4d4d4', fontSize: 24, padding: 40 }}>
            {/* VS Code Header */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, backgroundColor: '#252526', display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Circle radius={6} color="#ff5f56" />
                    <Circle radius={6} color="#ffbd2e" />
                    <Circle radius={6} color="#27c93f" />
                </div>
                <span style={{ marginLeft: 20, fontSize: 16, color: '#999' }}>index.ts - Visual Studio Code</span>
            </div>

            {/* Code Area */}
            <div style={{ marginTop: 40, whiteSpace: 'pre-wrap' }}>
                {currentCode}
                <span style={{ borderRight: '2px solid white', animation: 'blink 1s step-end infinite' }}>|</span>
            </div>

            {/* Error Popup */}
            {showError && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) scale(${errorScale})`,
                    backgroundColor: '#2d2d2d',
                    border: '1px solid #f48771',
                    borderRadius: 8,
                    padding: 0,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    width: '80%',
                    overflow: 'hidden'
                }}>
                    <div style={{ backgroundColor: '#f48771', padding: '10px 20px', color: '#2d2d2d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        ERROR
                    </div>
                    <div style={{ padding: 30 }}>
                        <p style={{ color: '#f48771', fontSize: 32, margin: 0, fontWeight: 'bold' }}>{errorMessage}</p>
                        <p style={{ color: '#ccc', fontSize: 24, marginTop: 10 }}>What does this mean??</p>
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};

// Scene 2: The Word (Dictionary Style) (5-20s)
const WordScene: React.FC<{ word: string, meaning: string, example: string }> = ({ word, meaning, example }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 10], [0, 1]);
    const slideUp = spring({ frame, fps, config: { damping: 20 } });

    return (
        <AbsoluteFill style={{ backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', fontFamily }}>
            <div style={{ opacity, textAlign: 'center', width: '80%' }}>
                <h1 style={{
                    fontSize: 140,
                    color: '#2c3e50',
                    marginBottom: 20,
                    borderBottom: '4px solid #2c3e50',
                    display: 'inline-block',
                    paddingBottom: 10
                }}>
                    {word}
                </h1>

                <div style={{ transform: `translateY(${interpolate(slideUp, [0, 1], [50, 0])}px)` }}>
                    <p style={{ fontSize: 48, color: '#34495e', marginTop: 40, fontWeight: 500 }}>
                        {meaning}
                    </p>

                    <div style={{
                        marginTop: 60,
                        backgroundColor: 'white',
                        padding: 40,
                        borderRadius: 20,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                        borderLeft: '10px solid #3498db'
                    }}>
                        <p style={{ fontSize: 36, color: '#7f8c8d', fontStyle: 'italic', margin: 0 }}>
                            "{example}"
                        </p>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

// Scene 3: The Context (Matrix/Hacker Style) (20-40s)
const ContextScene: React.FC<{ techMeaning: string, explanation: string }> = ({ techMeaning, explanation }) => {
    const frame = useCurrentFrame();

    // Matrix rain effect simulation
    const drops = new Array(20).fill(0).map((_, i) => {
        const x = i * 50 + 20;
        const y = (frame * (10 + random(i) * 10)) % 2000 - 100;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, color: '#0f0', opacity: 0.2, fontSize: 20 }}>{random(i) > 0.5 ? '1' : '0'}</div>;
    });

    return (
        <AbsoluteFill style={{ backgroundColor: '#000', color: '#0f0', fontFamily: monoFamily, overflow: 'hidden' }}>
            {drops}
            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 60, backgroundColor: 'rgba(0,0,0,0.8)' }}>
                <div style={{ border: '2px solid #0f0', padding: 40, borderRadius: 10, backgroundColor: 'rgba(0,20,0,0.9)', boxShadow: '0 0 20px #0f0' }}>
                    <h2 style={{ fontSize: 40, borderBottom: '1px solid #0f0', paddingBottom: 20, marginBottom: 40 }}>
                        &gt; SYSTEM_CONTEXT_ANALYSIS
                    </h2>

                    <div style={{ marginBottom: 60 }}>
                        <p style={{ color: '#0f0', fontSize: 24, marginBottom: 10 }}>// TECHNICAL MEANING</p>
                        <p style={{ color: '#fff', fontSize: 50, fontWeight: 'bold', textShadow: '0 0 10px #fff' }}>
                            {techMeaning}
                        </p>
                    </div>

                    <div>
                        <p style={{ color: '#0f0', fontSize: 24, marginBottom: 10 }}>// EXPLANATION</p>
                        <p style={{ color: '#ccc', fontSize: 40, lineHeight: 1.5 }}>
                            {explanation}
                        </p>
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// Scene 4: Usage (Chat App Style) (40-50s)
const UsageScene: React.FC<{ context: string, example: string, punchline: string }> = ({ context, example, punchline }) => {
    const frame = useCurrentFrame();

    return (
        <AbsoluteFill style={{ backgroundColor: '#ece5dd', fontFamily }}>
            {/* Header */}
            <div style={{ height: 120, backgroundColor: '#075e54', display: 'flex', alignItems: 'center', padding: '0 40px', color: 'white', fontSize: 40, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: '#fff', marginRight: 20 }} />
                {context}
            </div>

            <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 40 }}>
                {/* Message 1 (Right - Me) */}
                <div style={{
                    alignSelf: 'flex-end',
                    backgroundColor: '#dcf8c6',
                    padding: '20px 40px',
                    borderRadius: '20px 0 20px 20px',
                    maxWidth: '80%',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    transform: `scale(${interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })})`,
                    transformOrigin: 'top right'
                }}>
                    <p style={{ fontSize: 36, margin: 0, color: '#333' }}>{example}</p>
                    <span style={{ fontSize: 20, color: '#999', display: 'block', textAlign: 'right', marginTop: 10 }}>10:42 PM</span>
                </div>

                {/* Message 2 (Left - Other) */}
                <div style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#fff',
                    padding: '20px 40px',
                    borderRadius: '0 20px 20px 20px',
                    maxWidth: '80%',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    transform: `scale(${interpolate(frame, [30, 40], [0, 1], { extrapolateRight: 'clamp' })})`,
                    transformOrigin: 'top left'
                }}>
                    <p style={{ fontSize: 36, margin: 0, color: '#333', fontWeight: 'bold' }}>{punchline}</p>
                    <span style={{ fontSize: 20, color: '#999', display: 'block', textAlign: 'right', marginTop: 10 }}>10:43 PM</span>
                </div>
            </div>
        </AbsoluteFill>
    );
};

export const ErrorEnglishVideo: React.FC<z.infer<typeof myCompSchema>> = (props) => {
    return (
        <AbsoluteFill>
            <Sequence from={0} durationInFrames={150}>
                <PanicScene errorMessage={props.errorMessage} />
            </Sequence>
            <Sequence from={150} durationInFrames={450}>
                <WordScene word={props.targetWord} meaning={props.generalMeaning} example={props.generalExample} />
            </Sequence>
            <Sequence from={600} durationInFrames={600}>
                <ContextScene techMeaning={props.techMeaning} explanation={props.explanation} />
            </Sequence>
            <Sequence from={1200} durationInFrames={300}>
                <UsageScene context={props.usageContext} example={props.usageExample} punchline={props.usagePunchline} />
            </Sequence>
        </AbsoluteFill>
    );
};
