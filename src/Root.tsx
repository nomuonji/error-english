import { Composition } from 'remotion';
import { ErrorEnglishVideo, myCompSchema } from './Composition';
import './style.css';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="ErrorEnglishVideo"
                component={ErrorEnglishVideo}
                durationInFrames={1740}
                fps={30}
                width={1080}
                height={1920}
                schema={myCompSchema}
                defaultProps={{
                    targetWord: "Fatal",
                    errorMessage: "FATAL ERROR: System Halted",
                    messageTranslation: "致命的なエラー：システムが停止しました",
                    generalMeaning: "【形】致命的な、命に関わる",
                    generalExample: "A fatal accident (死亡事故)",
                    techMeaning: "プログラムが即死して、もう息をしていない状態",
                    explanation: "再起不能。保存してないデータは諦めよう。",
                    usageContext: "遅刻確定の時",
                    usageExample: "I made a fatal mistake...",
                    usageExampleTranslation: "致命的なミスをしちゃった…",
                    usagePunchline: "Boss: 403 Forbidden",
                    usagePunchlineTranslation: "上司：許さん（アクセス拒否）"
                }}
            />
        </>
    );
};
