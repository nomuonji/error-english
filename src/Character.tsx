import { Img, useCurrentFrame, interpolate, staticFile } from 'remotion';
import React from 'react';

interface CharacterProps {
    emotion: 'cry' | 'normal';
    isSpeaking: boolean;
    position?: {
        bottom?: number;
        right?: number;
        left?: number;
        top?: number;
    };
    size?: number;
}

export const Character: React.FC<CharacterProps> = ({
    emotion,
    isSpeaking,
    position = { bottom: 0, right: -50 },
    size = 800
}) => {
    const frame = useCurrentFrame();

    // リップシンク: 口をパクパクさせる（約4フレームごとに切り替え）
    const mouthOpen = isSpeaking && Math.floor(frame / 4) % 2 === 0;

    // キャラクター画像の選択
    let characterImage = '';
    if (emotion === 'cry') {
        characterImage = 'character/chara-cry.png';
    } else {
        characterImage = mouthOpen
            ? 'character/chara-mouth-open.png'
            : 'character/chara-mouth-closed.png';
    }

    // 軽い上下の動き（息をしているような動き）
    const breatheOffset = Math.sin(frame / 20) * 5;

    return (
        <div style={{
            position: 'absolute',
            ...position,
            zIndex: 100,
            transform: `translateY(${breatheOffset}px)`,
        }}>
            <Img
                src={staticFile(characterImage)}
                style={{
                    width: size,
                    height: 'auto',
                    filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))',
                }}
            />
        </div>
    );
};
