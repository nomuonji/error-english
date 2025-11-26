import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, random, staticFile, Audio } from 'remotion';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { Rect, Circle } from '@remotion/shapes';
import React from 'react';
import { Character } from './Character';

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
    audioPaths: z.object({
        errorMessage: z.string(),
        messageTranslation: z.string(),
        targetWord: z.string(),
        generalMeaning: z.string(),
        generalExample: z.string(),
        techMeaning: z.string(),
        explanation: z.string(),
        usageContext: z.string(),
        usageExample: z.string(),
        usageExampleTranslation: z.string(),
        usagePunchline: z.string(),
        usagePunchlineTranslation: z.string(),
    }).optional(),
    audioDurations: z.object({
        errorMessage: z.number().optional(),
        messageTranslation: z.number().optional(),
        targetWord: z.number().optional(),
        generalMeaning: z.number().optional(),
        generalExample: z.number().optional(),
        techMeaning: z.number().optional(),
        explanation: z.number().optional(),
        usageContext: z.number().optional(),
        usageExample: z.number().optional(),
        usageExampleTranslation: z.number().optional(),
        usagePunchline: z.number().optional(),
        usagePunchlineTranslation: z.number().optional(),
    }).optional(),
    sceneDurations: z.object({
        panic: z.number(),
        errorMeaning: z.number(),
        word: z.number(),
        context: z.number(),
        usage: z.number(),
        outro: z.number(),
    }).optional(),
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
const PanicScene: React.FC<{ errorMessage: string, errorAudioDuration?: number }> = ({ errorMessage, errorAudioDuration }) => {
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
    // Calculate start frame based on error audio duration if available
    // Default to 120 if no audio duration provided
    const errorAudioFrames = errorAudioDuration ? Math.ceil(errorAudioDuration * fps) : 75; // Default 2.5s
    const questionFrame = errorFrame + errorAudioFrames + 10; // 10 frames buffer

    const showQuestion = frame > questionFrame;
    const questionScale = spring({
        frame: frame - questionFrame,
        fps,
        config: { damping: 10, stiffness: 100 }
    });
    const questionShake = Math.sin(frame * 0.8) * 10;

    return (
        <AbsoluteFill style={{ backgroundColor: '#1e1e1e', fontFamily: monoFamily, color: '#d4d4d4', fontSize: 24, padding: 40 }}>
            {/* SE: Type Sound at Start */}
            <Sequence from={0}>
                <Audio src={staticFile("se/type.mp3")} volume={0.5} />
            </Sequence>

            {/* SE: Alert on Error */}
            <Sequence from={errorFrame}>
                <Audio src={staticFile("se/alert.mp3")} volume={0.5} />
            </Sequence>

            {/* SE: Pop on Japanese Error */}
            <Sequence from={errorFrame + 5}>
                <Audio src={staticFile("se/pop.mp3")} volume={0.5} />
            </Sequence>

            {/* SE: Pop on Tsukkomi */}
            <Sequence from={questionFrame}>
                <Audio src={staticFile("se/pop.mp3")} volume={0.6} />
            </Sequence>

            {/* Voice: What does this mean? */}
            <Sequence from={questionFrame}>
                <Audio src={staticFile("se/what_mean.mp3")} volume={0.8} />
            </Sequence>

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
            {
                showError && (
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
                )
            }

            {/* Japanese Error Pop */}
            {
                showError && (
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
                )
            }

            {/* Tsukkomi Overlay */}
            {
                showQuestion && (
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
                )
            }

            {/* Character - Crying emotion during error with slide-in animation */}
            {showError && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: -50,
                    opacity: interpolate(frame - errorFrame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
                    transform: `translateX(${interpolate(frame - errorFrame, [0, 30], [200, 0], { extrapolateRight: 'clamp' })}px)`,
                    zIndex: 100
                }}>
                    <Character
                        emotion="cry"
                        isSpeaking={false}
                    />
                </div>
            )}
        </AbsoluteFill >
    );
};

// Scene 1.5: Error Meaning (Explaining the error)
const ErrorMeaningScene: React.FC<{
    errorMessage: string,
    messageTranslation: string,
    audioDurations?: {
        messageTranslation?: number
    }
}> = ({ errorMessage, messageTranslation, audioDurations }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 10], [0, 1]);
    const slideUp = spring({ frame, fps, config: { damping: 20 } });

    // Lip-sync logic
    const durations = {
        messageTranslation: 4.0,
        ...audioDurations
    };

    const clipStart = 10;
    const clipEnd = clipStart + Math.ceil(durations.messageTranslation * fps);
    const isSpeaking = frame >= clipStart && frame <= clipEnd;

    return (
        <AbsoluteFill style={{ backgroundColor: '#2c3e50', justifyContent: 'center', alignItems: 'center', fontFamily }}>
            <div style={{
                opacity,
                transform: `translateY(${interpolate(slideUp, [0, 1], [30, 0])}px)`,
                backgroundColor: 'white', // Inverted colors for impact
                padding: '40px 60px',
                borderRadius: 20,
                color: '#2c3e50',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                width: '85%',
                textAlign: 'center',
                position: 'relative'
            }}>
                {/* Title Badge */}
                <div style={{
                    position: 'absolute',
                    top: -25,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    padding: '10px 40px',
                    fontSize: 24,
                    fontWeight: 'bold',
                    letterSpacing: 3,
                    borderRadius: 50,
                    boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)',
                    whiteSpace: 'nowrap'
                }}>
                    エラーの意味
                </div>

                <p style={{ fontSize: 40, color: '#e74c3c', marginBottom: 40, marginTop: 30, fontFamily: monoFamily, borderBottom: '2px solid #ecf0f1', paddingBottom: 20, fontWeight: 'bold' }}>
                    {errorMessage}
                </p>

                <p style={{ fontSize: 60, fontWeight: 900, margin: 0, color: '#2c3e50' }}>
                    {messageTranslation}
                </p>
            </div>

            <Character
                emotion="normal"
                isSpeaking={isSpeaking}
            />
        </AbsoluteFill>
    );
};

// Scene 2: The Word (Dictionary Style) (5-20s)
const WordScene: React.FC<{
    word: string,
    meaning: string,
    example: string,
    audioDurations?: {
        targetWord?: number,
        generalMeaning?: number,
        generalExample?: number
    }
}> = ({ word, meaning, example, audioDurations }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 10], [0, 1]);
    const slideUp = spring({ frame, fps, config: { damping: 20 } });

    // Character speaking timing (during narration)
    // Calculate precise speaking intervals based on audio durations
    const durations = {
        targetWord: 1.5, // Default duration if not provided
        generalMeaning: 2.5,
        generalExample: 3.5,
        ...audioDurations
    };

    const startFrame = 10;
    const gap = 15;

    // Calculate intervals for each clip
    // Clip 1: Target Word
    const clip1Start = startFrame;
    const clip1End = clip1Start + Math.ceil(durations.targetWord * fps);

    // Clip 2: General Meaning
    const clip2Start = clip1End + gap;
    const clip2End = clip2Start + Math.ceil(durations.generalMeaning * fps);

    // Clip 3: General Example
    const clip3Start = clip2End + gap;
    const clip3End = clip3Start + Math.ceil(durations.generalExample * fps);

    const isSpeaking =
        (frame >= clip1Start && frame <= clip1End) ||
        (frame >= clip2Start && frame <= clip2End) ||
        (frame >= clip3Start && frame <= clip3End);

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
                        backgroundColor: '#fff',
                        padding: '50px 40px',
                        borderRadius: 20,
                        boxShadow: '0 15px 40px rgba(52, 152, 219, 0.15)',
                        border: '3px solid #3498db',
                        position: 'relative'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: -20,
                            left: 40,
                            backgroundColor: '#3498db',
                            color: 'white',
                            padding: '8px 25px',
                            borderRadius: 20,
                            fontSize: 20,
                            fontWeight: 'bold',
                            letterSpacing: 2,
                            boxShadow: '0 5px 15px rgba(52, 152, 219, 0.4)'
                        }}>
                            例文
                        </div>
                        <p style={{ fontSize: 38, color: '#2c3e50', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                            {example}
                        </p>
                    </div>
                </div>

            </div >

            {/* Character - Speaking during narration */}
            <Character
                emotion="normal"
                isSpeaking={isSpeaking}
            />
        </AbsoluteFill >
    );
};

// Sub-component for Context Scene Title
const ContextTitle: React.FC<{ word: string, error: string }> = ({ word, error }) => {
    return (
        <div style={{
            width: '100%',
            marginBottom: 40,
        }}>
            {/* Main Title Section */}
            <div style={{
                borderBottom: '4px solid #0f0',
                paddingBottom: 15,
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
            }}>
                <div style={{
                    backgroundColor: '#0f0',
                    color: 'black',
                    padding: '5px 15px',
                    fontSize: 20,
                    fontWeight: 'bold',
                    marginBottom: 10,
                    letterSpacing: 2
                }}>
                    文脈で覚える
                </div>
                <div style={{
                    fontSize: 90,
                    color: 'white',
                    fontWeight: 'bold',
                    textShadow: '0 0 20px rgba(0, 255, 0, 0.6)',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                }}>
                    {word}
                    <span style={{ animation: 'blink 1s infinite', color: '#0f0' }}>_</span>
                </div>
            </div>

            {/* Sub Title / Error Message Section */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                backgroundColor: 'rgba(255, 95, 86, 0.15)',
                borderLeft: '8px solid #ff5f56',
                padding: '20px 30px',
                borderRadius: '0 10px 10px 0'
            }}>
                <span style={{ color: '#ff5f56', fontSize: 42 }}>⚠️</span>
                <span style={{
                    color: '#ff5f56',
                    fontSize: 42,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    lineHeight: 1.2
                }}>
                    {error}
                </span>
            </div>
        </div>
    );
};

// Scene 3: The Context (Matrix/Hacker Style) (20-40s)
const ContextScene: React.FC<{
    targetWord: string,
    errorMessage: string,
    techMeaning: string,
    explanation: string,
    duration: number,
    audioDurations?: {
        techMeaning?: number,
        explanation?: number
    }
}> = ({ targetWord, errorMessage, techMeaning, explanation, duration, audioDurations }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Lip-sync logic
    const durations = {
        techMeaning: 3.0,
        explanation: 5.0,
        ...audioDurations
    };

    // Calculate start frames based on the sequence in ErrorEnglishVideo
    // The audio starts at: panicDuration + wordDuration + 20
    // But inside this scene, we start at 0.
    // The parent sequence passes audio clips. We need to match that timing.
    // In parent:
    // Clip 1 (Tech Meaning) starts at relative frame 20
    const clip1Start = 20;
    const clip1End = clip1Start + Math.ceil(durations.techMeaning * fps);

    // Clip 2 (Explanation) starts after Clip 1 + 20 frames gap (increased for "Tsumari" timing)
    const clip2Start = clip1End + 20;
    const clip2End = clip2Start + Math.ceil(durations.explanation * fps);

    const isSpeaking =
        (frame >= clip1Start && frame <= clip1End) ||
        (frame >= clip2Start && frame <= clip2End);

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
                    maxWidth: '90%',
                    width: '90%'
                }}>
                    <ContextTitle word={targetWord} error={errorMessage} />

                    <div style={{ marginBottom: 30 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15, color: '#0f0' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <circle cx="12" cy="16" r="2" />
                                <path d="M12 11V7" />
                                <rect x="10" y="3" width="4" height="4" rx="1" />
                            </svg>
                            <span style={{ fontSize: 24, letterSpacing: 2, fontFamily: '"Hiragino Kaku Gothic ProN", sans-serif' }}>💻 コンピュータの言い分</span>
                        </div>
                        <p style={{
                            color: '#fff',
                            fontSize: 50,
                            fontWeight: 'bold',
                            textShadow: '0 0 15px #0f0',
                            lineHeight: 1.3,
                            paddingLeft: 20,
                            borderLeft: '4px solid #0f0'
                        }}>
                            {techMeaning}
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: '#fffcf5', // Warmer white
                        padding: '40px 40px',
                        borderRadius: 20,
                        position: 'relative',
                        opacity: interpolate(frame, [clip2Start - 10, clip2Start], [0, 1], { extrapolateRight: 'clamp' }),
                        transform: `translateY(${interpolate(frame, [clip2Start - 10, clip2Start], [20, 0], { extrapolateRight: 'clamp' })}px) scale(${1 + Math.sin(frame * 0.05) * 0.01})`, // Gentle pulse
                        boxShadow: '0 15px 50px rgba(255, 165, 0, 0.15)', // Warm shadow
                        border: '4px solid #ffd700' // Gold border
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: -25,
                            left: 30,
                            backgroundColor: '#ff9f43', // Orange accent
                            padding: '10px 25px',
                            borderRadius: 30,
                            color: '#fff',
                            fontSize: 22,
                            letterSpacing: 1,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            boxShadow: '0 5px 15px rgba(255, 159, 67, 0.4)'
                        }}>
                            <span style={{ fontSize: 28 }}>💡</span>
                            ざっくり言うと
                        </div>
                        <p style={{ color: '#2c3e50', fontSize: 42, lineHeight: 1.5, fontFamily: '"Hiragino Kaku Gothic ProN", sans-serif', margin: 0, fontWeight: 'bold' }}>
                            {explanation}
                        </p>
                    </div>
                </div>
            </AbsoluteFill>

            {/* SE: Naruhodo at end - dynamic timing based on scene duration */}
            {/* Play after explanation finishes */}
            <Sequence from={clip2End + 15}>
                <Audio src={staticFile("se/context_end.mp3")} volume={0.6} />
            </Sequence>

            {/* Character - Speaking during narration */}
            <Character
                emotion="normal"
                isSpeaking={isSpeaking}
            />
        </AbsoluteFill>
    );
};

// Scene 4: Usage (Chat App Style) (40-50s)
const UsageScene: React.FC<{
    context: string,
    example: string,
    exampleTranslation: string,
    punchline: string,
    punchlineTranslation: string,
    duration: number,
    audioDurations?: {
        usageContext?: number,
        usageExample?: number,
        usageExampleTranslation?: number,
        usagePunchline?: number,
        usagePunchlineTranslation?: number
    }
}> = ({ context, example, exampleTranslation, punchline, punchlineTranslation, duration, audioDurations }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Final CTA animation - appears just before the scene ends
    const ctaFrame = duration - 45; // 1.5 seconds before end
    const showCta = frame > ctaFrame;
    const ctaScale = spring({
        frame: frame - ctaFrame,
        fps,
        config: { damping: 12, stiffness: 100 }
    });

    // Lip-sync logic
    const durations = {
        usageContext: 2.0,
        usageExample: 3.0,
        usageExampleTranslation: 3.0,
        usagePunchline: 3.0,
        usagePunchlineTranslation: 3.0,
        ...audioDurations
    };

    // Audio sequence timing matching parent component
    // Starts at relative frame 5
    const startFrame = 5;
    const gap = 15;

    // Clip 1: Context
    const clip1Start = startFrame;
    const clip1End = clip1Start + Math.ceil(durations.usageContext * fps);

    // Clip 2: Example
    const clip2Start = clip1End + gap;
    const clip2End = clip2Start + Math.ceil(durations.usageExample * fps);

    // Clip 3: Example Translation
    const clip3Start = clip2End + gap;
    const clip3End = clip3Start + Math.ceil(durations.usageExampleTranslation * fps);

    // Clip 4: Punchline
    const clip4Start = clip3End + gap;
    const clip4End = clip4Start + Math.ceil(durations.usagePunchline * fps);

    // Clip 5: Punchline Translation
    const clip5Start = clip4End + gap;
    const clip5End = clip5Start + Math.ceil(durations.usagePunchlineTranslation * fps);

    const isSpeaking =
        (frame >= clip1Start && frame <= clip1End) ||
        (frame >= clip2Start && frame <= clip2End) ||
        (frame >= clip3Start && frame <= clip3End) ||
        (frame >= clip4Start && frame <= clip4End) ||
        (frame >= clip5Start && frame <= clip5End);

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

            {/* Chat messages container */}
            <div style={{
                padding: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: 60,
                justifyContent: 'center',
                height: '100%',
                maxWidth: '90%',
                margin: '0 auto',
                position: 'relative',
                zIndex: 10
            }}>
                {/* Message 1 (Right - Me) */}
                <div style={{
                    alignSelf: 'flex-end',
                    backgroundColor: 'rgba(220, 248, 198, 0.95)',
                    padding: '30px 50px',
                    borderRadius: '30px 0 30px 30px',
                    maxWidth: '90%',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    opacity: msg1Opacity,
                    transform: `scale(${msg1Scale})`,
                    transformOrigin: 'bottom right',
                    position: 'relative',
                    zIndex: 20
                }}>
                    <p style={{ fontSize: 42, margin: 0, color: '#333', marginBottom: 15 }}>{example}</p>
                    <p style={{ fontSize: 32, margin: 0, color: '#555', borderTop: '2px solid rgba(0,0,0,0.1)', paddingTop: 15, fontWeight: 'bold' }}>{exampleTranslation}</p>
                </div>

                {/* Message 2 (Left - Other) */}
                <div style={{
                    alignSelf: 'flex-start',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    padding: '30px 50px',
                    borderRadius: '0 30px 30px 30px',
                    maxWidth: '90%',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    opacity: msg2Opacity,
                    transform: `scale(${msg2Scale})`,
                    transformOrigin: 'bottom left',
                    position: 'relative',
                    zIndex: 20
                }}>
                    <p style={{ fontSize: 42, margin: 0, color: '#333', fontWeight: 'bold', marginBottom: 15 }}>{punchline}</p>
                    <p style={{ fontSize: 32, margin: 0, color: '#555', borderTop: '2px solid rgba(0,0,0,0.1)', paddingTop: 15, fontWeight: 'bold' }}>{punchlineTranslation}</p>
                </div>
            </div>

            {/* Character - Speaking during conversation */}
            <Character
                emotion="normal"
                isSpeaking={isSpeaking}
            />

            {/* Final CTA Pop-up - moved to ABSOLUTE END of DOM and HIGHEST zIndex */}
            {showCta && (
                <div style={{
                    position: 'absolute',
                    top: 220, // Adjusted to be centered in the upper space
                    left: '50%',
                    transform: `translateX(-50%) scale(${ctaScale})`,
                    backgroundColor: '#ff9f43',
                    padding: '20px 60px',
                    borderRadius: 50,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    border: '5px solid white',
                    zIndex: 2000 // Highest priority
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

// Scene 5: Outro (Branding/CTA) (53-58s)
const OutroScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 10], [0, 1]);
    const scale = spring({ frame, fps, config: { damping: 15 } });

    return (
        <AbsoluteFill style={{ backgroundColor: '#2c3e50', justifyContent: 'center', alignItems: 'center', fontFamily }}>
            <Sequence from={20}>
                <Audio src={staticFile("se/follow_me.mp3")} />
            </Sequence>
            <div style={{ opacity, transform: `scale(${scale})`, textAlign: 'center', color: 'white' }}>
                <div style={{
                    width: 150,
                    height: 150,
                    backgroundColor: '#f48771',
                    borderRadius: '50%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    margin: '0 auto 40px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>

                <h1 style={{ fontSize: 70, fontWeight: 'bold', marginBottom: 20, letterSpacing: 2 }}>
                    エラーで学ぶ英語
                </h1>
                <p style={{ fontSize: 36, opacity: 0.9, marginBottom: 60, fontFamily: monoFamily }}>
                    Error English for Engineers
                </p>

                <div style={{
                    backgroundColor: 'white',
                    color: '#2c3e50',
                    padding: '20px 50px',
                    borderRadius: 50,
                    fontSize: 40,
                    fontWeight: 'bold',
                    display: 'inline-block',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
                }}>
                    Follow for more!
                </div>
            </div>

            {/* Character - Speaking during outro */}
            {/* Sync with "follow me" audio (approx 2.5s) */}
            <Character
                emotion="normal"
                isSpeaking={frame >= 20 && frame <= 95}
            />
        </AbsoluteFill>
    );
};

export const ErrorEnglishVideo: React.FC<z.infer<typeof myCompSchema>> = (props) => {
    return (
        <AbsoluteFill>
            <Audio src={staticFile("bgm.mp3")} volume={0.1} loop />

            {/* Audio Narrations */}
            {props.audioPaths && props.audioDurations && (
                <>
                    {/* Panic Scene Audio */}
                    {props.audioPaths.errorMessage && (
                        <Sequence from={45}>
                            <Audio src={staticFile(props.audioPaths.errorMessage)} />
                        </Sequence>
                    )}

                    {/* Error Meaning Scene Audio */}
                    {(() => {
                        const panicDuration = props.sceneDurations?.panic || 240;
                        let currentFrame = panicDuration + 10;
                        const clips = [
                            { path: props.audioPaths.messageTranslation, duration: props.audioDurations.messageTranslation },
                        ];
                        return clips.map((clip, i) => {
                            if (!clip.path) return null;
                            const start = currentFrame;
                            currentFrame += Math.ceil((clip.duration || 0) * 30) + 15;
                            return (
                                <Sequence key={i} from={start}>
                                    <Audio src={staticFile(clip.path)} />
                                </Sequence>
                            );
                        });
                    })()}

                    {/* Word Scene Audio */}
                    {(() => {
                        const panicDuration = props.sceneDurations?.panic || 240;
                        const errorMeaningDuration = props.sceneDurations?.errorMeaning || 150;
                        let currentFrame = panicDuration + errorMeaningDuration + 10;
                        const clips = [
                            { path: props.audioPaths.targetWord, duration: props.audioDurations.targetWord },
                            { path: props.audioPaths.generalMeaning, duration: props.audioDurations.generalMeaning },
                            { path: props.audioPaths.generalExample, duration: props.audioDurations.generalExample },
                        ];
                        return clips.map((clip, i) => {
                            if (!clip.path) return null;
                            const start = currentFrame;
                            currentFrame += Math.ceil((clip.duration || 0) * 30) + 15;
                            return (
                                <Sequence key={i} from={start}>
                                    <Audio src={staticFile(clip.path)} />
                                </Sequence>
                            );
                        });
                    })()}

                    {/* Context Scene Audio */}
                    {(() => {
                        const panicDuration = props.sceneDurations?.panic || 240;
                        const errorMeaningDuration = props.sceneDurations?.errorMeaning || 150;
                        const wordDuration = props.sceneDurations?.word || 300;
                        let currentFrame = panicDuration + errorMeaningDuration + wordDuration + 20;
                        const clips = [
                            { path: props.audioPaths.techMeaning, duration: props.audioDurations.techMeaning },
                            { path: props.audioPaths.explanation, duration: props.audioDurations.explanation },
                        ];
                        return clips.map((clip, i) => {
                            if (!clip.path) return null;
                            const start = currentFrame;
                            currentFrame += Math.ceil((clip.duration || 0) * 30) + 20; // Increased gap for Tsumari
                            return (
                                <Sequence key={i} from={start}>
                                    <Audio src={staticFile(clip.path)} />
                                </Sequence>
                            );
                        });
                    })()}

                    {/* Usage Scene Audio */}
                    {(() => {
                        const panicDuration = props.sceneDurations?.panic || 240;
                        const errorMeaningDuration = props.sceneDurations?.errorMeaning || 150;
                        const wordDuration = props.sceneDurations?.word || 300;
                        const contextDuration = props.sceneDurations?.context || 600;
                        let currentFrame = panicDuration + errorMeaningDuration + wordDuration + contextDuration + 5;
                        const clips = [
                            { path: props.audioPaths.usageContext, duration: props.audioDurations.usageContext },
                            { path: props.audioPaths.usageExample, duration: props.audioDurations.usageExample },
                            { path: props.audioPaths.usageExampleTranslation, duration: props.audioDurations.usageExampleTranslation },
                            { path: props.audioPaths.usagePunchline, duration: props.audioDurations.usagePunchline },
                            { path: props.audioPaths.usagePunchlineTranslation, duration: props.audioDurations.usagePunchlineTranslation },
                        ];
                        return clips.map((clip, i) => {
                            if (!clip.path) return null;
                            const start = currentFrame;
                            currentFrame += Math.ceil((clip.duration || 0) * 30) + 15;
                            return (
                                <Sequence key={i} from={start}>
                                    <Audio src={staticFile(clip.path)} />
                                </Sequence>
                            );
                        });
                    })()}
                </>
            )}

            <Sequence from={0} durationInFrames={props.sceneDurations?.panic || 240}>
                <PanicScene
                    errorMessage={props.errorMessage}
                    errorAudioDuration={props.audioDurations?.errorMessage}
                />
            </Sequence>
            <Sequence from={props.sceneDurations?.panic || 240} durationInFrames={props.sceneDurations?.errorMeaning || 150}>
                <ErrorMeaningScene
                    errorMessage={props.errorMessage}
                    messageTranslation={props.messageTranslation}
                    audioDurations={props.audioDurations}
                />
            </Sequence>
            <Sequence from={(props.sceneDurations?.panic || 240) + (props.sceneDurations?.errorMeaning || 150)} durationInFrames={props.sceneDurations?.word || 300}>
                <WordScene
                    word={props.targetWord}
                    meaning={props.generalMeaning}
                    example={props.generalExample}
                    audioDurations={props.audioDurations}
                />
            </Sequence>
            <Sequence from={(props.sceneDurations?.panic || 240) + (props.sceneDurations?.errorMeaning || 150) + (props.sceneDurations?.word || 300)} durationInFrames={props.sceneDurations?.context || 710}>
                <ContextScene
                    targetWord={props.targetWord}
                    errorMessage={props.errorMessage}
                    techMeaning={props.techMeaning}
                    explanation={props.explanation}
                    duration={props.sceneDurations?.context || 710}
                    audioDurations={props.audioDurations}
                />
            </Sequence>
            <Sequence from={(props.sceneDurations?.panic || 240) + (props.sceneDurations?.errorMeaning || 150) + (props.sceneDurations?.word || 300) + (props.sceneDurations?.context || 710)} durationInFrames={props.sceneDurations?.usage || 300}>
                <UsageScene
                    context={props.usageContext}
                    example={props.usageExample}
                    exampleTranslation={props.usageExampleTranslation}
                    punchline={props.usagePunchline}
                    punchlineTranslation={props.usagePunchlineTranslation}
                    duration={props.sceneDurations?.usage || 300}
                    audioDurations={props.audioDurations}
                />
            </Sequence>
            <Sequence from={(props.sceneDurations?.panic || 240) + (props.sceneDurations?.errorMeaning || 150) + (props.sceneDurations?.word || 300) + (props.sceneDurations?.context || 710) + (props.sceneDurations?.usage || 300)} durationInFrames={props.sceneDurations?.outro || 150}>
                <OutroScene />
            </Sequence>
        </AbsoluteFill>
    );
};
