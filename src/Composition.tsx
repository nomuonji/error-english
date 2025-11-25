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
    messageTranslation: z.string(),
    generalMeaning: z.string(),
    generalExample: z.string(),
    techMeaning: z.string(),
    explanation: z.string(),
    usageContext: z.string(),
    usageExample: z.string(),
    usageExampleTranslation: z.string(),
    usagePunchline: z.string(),
    usagePunchlineTranslation: z.string(),
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

// Scene 1: The Panic (Development Context) (0-8s)
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

    // Japanese "Error Occurred" Pop appearance
    const jpErrorScale = spring({
        frame: frame - errorFrame - 5,
        fps,
        config: { damping: 12, stiffness: 200 }
    });

    // Flash effect on error
    const flashOpacity = interpolate(
        frame,
        [errorFrame, errorFrame + 5, errorFrame + 10],
        [0, 0.5, 0],
        { extrapolateRight: 'clamp' }
    );

    // Shake effect on error
    const shake = interpolate(
        frame,
        [errorFrame, errorFrame + 10],
        [0, 0],
        {
            extrapolateRight: 'clamp',
            easing: (t) => Math.sin(t * Math.PI * 10) * 10 * (1 - t)
        }
    );
    // Simple shake calculation if easing is complex
    const simpleShake = frame >= errorFrame && frame < errorFrame + 10
        ? Math.sin((frame - errorFrame) * 2) * 20 * (1 - (frame - errorFrame) / 10)
        : 0;


    // "What does this mean??" overlay appearance
    const questionFrame = 120;
    const showQuestion = frame > questionFrame;
    const questionScale = spring({
        frame: frame - questionFrame,
        fps,
        config: { damping: 10, stiffness: 100 }
    });
    const questionShake = Math.sin(frame * 0.8) * 10;

    return (
        <AbsoluteFill style={{ backgroundColor: '#1e1e1e', fontFamily: monoFamily, color: '#d4d4d4', fontSize: 24, padding: 40 }}>
            {/* Flash Overlay */}
            <AbsoluteFill style={{ backgroundColor: 'red', opacity: flashOpacity, zIndex: 5, pointerEvents: 'none' }} />

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
            <div style={{ marginTop: 40, whiteSpace: 'pre-wrap', transform: `translateX(${simpleShake}px)` }}>
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
                    border: '4px solid #f48771', // Thicker border
                    borderRadius: 12,
                    padding: 0,
                    boxShadow: '0 30px 80px rgba(0,0,0,0.8)', // Stronger shadow
                    width: '90%', // Wider
                    overflow: 'hidden',
                    zIndex: 10
                }}>
                    <div style={{ backgroundColor: '#f48771', padding: '15px 30px', color: '#2d2d2d', fontWeight: 'bold', fontSize: 30, display: 'flex', alignItems: 'center', gap: 15 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        ERROR DETECTED
                    </div>
                    <div style={{ padding: 40 }}>
                        <p style={{ color: '#f48771', fontSize: 75, margin: 0, fontWeight: 'bold', lineHeight: 1.1 }}>{errorMessage}</p>
                    </div>
                </div>
            )}

            {/* Japanese Error Pop */}
            {showError && (
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    right: '5%',
                    transform: `scale(${jpErrorScale}) rotate(15deg)`,
                    zIndex: 15,
                }}>
                    <div style={{
                        backgroundColor: '#ff0000',
                        color: 'white',
                        padding: '20px 40px',
                        borderRadius: '10px',
                        border: '8px solid white',
                        boxShadow: '0 15px 30px rgba(0,0,0,0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            fontSize: 80,
                            lineHeight: 1,
                            marginBottom: 10
                        }}>⚠️</div>
                        <div style={{
                            fontFamily: '"Hiragino Kaku Gothic ProN", sans-serif',
                            fontWeight: 900,
                            fontSize: 70,
                            whiteSpace: 'nowrap',
                            textShadow: '2px 2px 0 rgba(0,0,0,0.2)'
                        }}>
                            エラー発生！
                        </div>
                    </div>
                </div>
            )}

            {/* Tsukkomi Overlay */}
            {showQuestion && (
                <div style={{
                    position: 'absolute',
                    top: '65%',
                    left: '50%',
                    transform: `translate(-50%, -50%) scale(${questionScale}) translate(${questionShake}px, 0)`,
                    zIndex: 20,
                    width: '100%',
                    textAlign: 'center'
                }}>
                    <p style={{
                        fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
                        fontSize: 110,
                        fontWeight: 900,
                        color: 'white',
                        textShadow: '5px 5px 0 #ff0000, -5px -5px 0 #0000ff',
                        margin: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: '30px 0',
                        transform: 'rotate(-5deg)'
                    }}>
                        どういう意味！！？？
                    </p>
                </div>
            )}
        </AbsoluteFill>
    );
};

// Scene 2: The Word (Dictionary Style) (5-20s)
const WordScene: React.FC<{ word: string, meaning: string, example: string, messageTranslation: string, errorMessage: string }> = ({ word, meaning, example, messageTranslation, errorMessage }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 10], [0, 1]);
    const slideUp = spring({ frame, fps, config: { damping: 20 } });

    // Translation appears later
    const translationFrame = 150; // 5 seconds into the scene
    const translationOpacity = interpolate(frame, [translationFrame, translationFrame + 30], [0, 1]);
    const translationSlide = spring({ frame: frame - translationFrame, fps, config: { damping: 20 } });

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

                {/* Full Message Translation */}
                <div style={{
                    marginTop: 80,
                    opacity: translationOpacity,
                    transform: `translateY(${interpolate(translationSlide, [0, 1], [30, 0])}px)`,
                    backgroundColor: '#2c3e50',
                    padding: '20px 40px',
                    borderRadius: 15,
                    color: 'white',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                }}>
                    <p style={{ fontSize: 20, color: '#bdc3c7', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 2 }}>Original Error</p>
                    <p style={{ fontSize: 28, color: '#ecf0f1', marginBottom: 20, fontFamily: monoFamily, borderBottom: '1px solid #7f8c8d', paddingBottom: 10 }}>
                        {errorMessage}
                    </p>

                    <p style={{ fontSize: 20, color: '#bdc3c7', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 2 }}>Meaning</p>
                    <p style={{ fontSize: 36, fontWeight: 'bold', margin: 0 }}>
                        {messageTranslation}
                    </p>
                </div>
            </div>
        </AbsoluteFill>
    );
};

// Scene 3: The Context (Matrix/Hacker Style) (20-40s)
const ContextScene: React.FC<{ techMeaning: string, explanation: string }> = ({ techMeaning, explanation }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Enhanced Matrix rain effect
    const drops = new Array(40).fill(0).map((_, i) => {
        const x = i * 25 + 10;
        const speed = 10 + random(i) * 20;
        const y = (frame * speed) % 2000 - 100;
        const opacity = random(i + 100) * 0.5 + 0.1;
        return (
            <div key={i} style={{
                position: 'absolute',
                left: x,
                top: y,
                color: '#0f0',
                opacity,
                fontSize: 16,
                textShadow: '0 0 5px #0f0'
            }}>
                {String.fromCharCode(0x30A0 + Math.floor(random(i + frame) * 96))}
            </div>
        );
    });

    // Content animation
    const contentOpacity = interpolate(frame, [0, 20], [0, 1]);
    const contentScale = spring({ frame, fps, config: { damping: 20 } });

    return (
        <AbsoluteFill style={{ backgroundColor: '#000', color: '#0f0', fontFamily: monoFamily, overflow: 'hidden' }}>
            {drops}

            {/* Scanline effect */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.2) 50%)',
                backgroundSize: '100% 4px',
                pointerEvents: 'none',
                zIndex: 10
            }} />

            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 60, backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <div style={{
                    border: '2px solid #0f0',
                    padding: 50,
                    borderRadius: 10,
                    backgroundColor: 'rgba(0,20,0,0.9)',
                    boxShadow: '0 0 30px rgba(0, 255, 0, 0.3)',
                    opacity: contentOpacity,
                    transform: `scale(${contentScale})`,
                    maxWidth: '90%'
                }}>
                    <h2 style={{
                        fontSize: 40,
                        borderBottom: '2px solid #0f0',
                        paddingBottom: 20,
                        marginBottom: 40,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20
                    }}>
                        <span style={{ animation: 'blink 1s infinite' }}>█</span>
                        SYSTEM_CONTEXT_ANALYSIS
                    </h2>

                    <div style={{ marginBottom: 60 }}>
                        <p style={{ color: '#0f0', fontSize: 24, marginBottom: 15, letterSpacing: 2 }}>// TECHNICAL MEANING</p>
                        <p style={{
                            color: '#fff',
                            fontSize: 50,
                            fontWeight: 'bold',
                            textShadow: '0 0 15px #0f0',
                            lineHeight: 1.3
                        }}>
                            {techMeaning}
                        </p>
                    </div>

                    <div>
                        <p style={{ color: '#0f0', fontSize: 24, marginBottom: 15, letterSpacing: 2 }}>// EXPLANATION</p>
                        <p style={{ color: '#ccc', fontSize: 40, lineHeight: 1.5, fontFamily: '"Hiragino Kaku Gothic ProN", sans-serif' }}>
                            {explanation}
                        </p>
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// Scene 4: Usage (Chat App Style) (40-50s)
const UsageScene: React.FC<{
    context: string,
    example: string,
    exampleTranslation: string,
    punchline: string,
    punchlineTranslation: string
}> = ({ context, example, exampleTranslation, punchline, punchlineTranslation }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Final CTA animation
    const ctaFrame = 200; // Appears near the end
    const showCta = frame > ctaFrame;
    const ctaScale = spring({
        frame: frame - ctaFrame,
        fps,
        config: { damping: 12, stiffness: 100 }
    });

    // Chat bubble animations
    const msg1Start = 10;
    const msg1Scale = spring({
        frame: frame - msg1Start,
        fps,
        config: { damping: 15, stiffness: 150 }
    });
    const msg1Opacity = interpolate(frame, [msg1Start, msg1Start + 5], [0, 1], { extrapolateRight: 'clamp' });

    const msg2Start = 60;
    const msg2Scale = spring({
        frame: frame - msg2Start,
        fps,
        config: { damping: 15, stiffness: 150 }
    });
    const msg2Opacity = interpolate(frame, [msg2Start, msg2Start + 5], [0, 1], { extrapolateRight: 'clamp' });


    return (
        <AbsoluteFill style={{ backgroundColor: '#ece5dd', fontFamily }}>
            {/* Header */}
            <div style={{
                height: 120,
                backgroundColor: '#075e54',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 40px',
                color: 'white',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                zIndex: 10,
                position: 'absolute',
                top: 0,
                width: '100%'
            }}>
                <div style={{ fontSize: 40, fontWeight: 'bold' }}>【使用例】{context}</div>
            </div>

            <div style={{
                padding: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: 60,
                justifyContent: 'center',
                height: '100%',
                maxWidth: '90%',
                margin: '0 auto'
            }}>
                {/* Message 1 (Right - Me) */}
                <div style={{
                    alignSelf: 'flex-end',
                    backgroundColor: '#dcf8c6',
                    padding: '30px 50px',
                    borderRadius: '30px 0 30px 30px',
                    maxWidth: '90%',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    opacity: msg1Opacity,
                    transform: `scale(${msg1Scale})`,
                    transformOrigin: 'bottom right'
                }}>
                    <p style={{ fontSize: 42, margin: 0, color: '#333', marginBottom: 15 }}>{example}</p>
                    <p style={{ fontSize: 32, margin: 0, color: '#555', borderTop: '2px solid rgba(0,0,0,0.1)', paddingTop: 15, fontWeight: 'bold' }}>{exampleTranslation}</p>
                </div>

                {/* Message 2 (Left - Other) */}
                <div style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#fff',
                    padding: '30px 50px',
                    borderRadius: '0 30px 30px 30px',
                    maxWidth: '90%',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    opacity: msg2Opacity,
                    transform: `scale(${msg2Scale})`,
                    transformOrigin: 'bottom left'
                }}>
                    <p style={{ fontSize: 42, margin: 0, color: '#333', fontWeight: 'bold', marginBottom: 15 }}>{punchline}</p>
                    <p style={{ fontSize: 32, margin: 0, color: '#555', borderTop: '2px solid rgba(0,0,0,0.1)', paddingTop: 15, fontWeight: 'bold' }}>{punchlineTranslation}</p>
                </div>
            </div>

            {/* Final CTA Pop-up */}
            {showCta && (
                <div style={{
                    position: 'absolute',
                    bottom: 50,
                    left: '50%',
                    transform: `translateX(-50%) scale(${ctaScale})`,
                    backgroundColor: '#ff9f43',
                    padding: '20px 60px',
                    borderRadius: 50,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    border: '5px solid white',
                    zIndex: 20
                }}>
                    <p style={{
                        fontSize: 50,
                        fontWeight: 'bold',
                        color: 'white',
                        margin: 0,
                        textAlign: 'center',
                        textShadow: '2px 2px 0 rgba(0,0,0,0.2)'
                    }}>
                        明日から使ってみよう！
                    </p>
                </div>
            )}
        </AbsoluteFill>
    );
};

export const ErrorEnglishVideo: React.FC<z.infer<typeof myCompSchema>> = (props) => {
    return (
        <AbsoluteFill>
            <Sequence from={0} durationInFrames={240}>
                <PanicScene errorMessage={props.errorMessage} />
            </Sequence>
            <Sequence from={240} durationInFrames={450}>
                <WordScene word={props.targetWord} meaning={props.generalMeaning} example={props.generalExample} messageTranslation={props.messageTranslation} errorMessage={props.errorMessage} />
            </Sequence>
            <Sequence from={690} durationInFrames={600}>
                <ContextScene techMeaning={props.techMeaning} explanation={props.explanation} />
            </Sequence>
            <Sequence from={1290} durationInFrames={300}>
                <UsageScene
                    context={props.usageContext}
                    example={props.usageExample}
                    exampleTranslation={props.usageExampleTranslation}
                    punchline={props.usagePunchline}
                    punchlineTranslation={props.usagePunchlineTranslation}
                />
            </Sequence>
        </AbsoluteFill>
    );
};
