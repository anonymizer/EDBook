export type TypingEffectOptions = {
    timePerCharacter?: number;
    startDelay?: number;
    maxAnimationTime?: number;
}

export class TypingEffect {
    private readonly timePerCharacter: number;
    private readonly startDelay: number;
    private readonly maxAnimationTime: number;
    private startTime = -1;
    private animationStartTime = -1;
    private endTime   = -1;
    private advanceTypingTimeout: NodeJS.Timeout | undefined;
    private inCodeBlock = false;
    private onChangeFuncs: ((newText: string) => void)[] = [];
    private onFinishFuncs: ((newText: string) => void)[] = [];
    
    public constructor(private source: string, opts?: TypingEffectOptions) {
        this.timePerCharacter = (opts && opts.timePerCharacter) ?? 8;
        this.startDelay = (opts && opts.startDelay) ?? 0;
        this.maxAnimationTime = (opts && opts.maxAnimationTime) ?? 10000;
    }

    public onChange(func: (newText: string) => void): () => void {
        this.onChangeFuncs.push(func);
        return () => {
            this.onChangeFuncs = this.onChangeFuncs.filter(f => f !== func);
        };
    }

    public onFinish(func: (newText: string) => void): () => void {
        this.onFinishFuncs.push(func);
        return () => {
            this.onFinishFuncs = this.onFinishFuncs.filter(f => f !== func);
        };
    }

    public start(): void {
        this.startTime = Date.now();
        this.animationStartTime = this.startTime + this.startDelay;
        this.endTime   = this.animationStartTime + Math.min(this.timePerCharacter * this.source.length, this.maxAnimationTime);
        this.advanceTyping();
    }
    public stop(): void {
        if (this.advanceTypingTimeout) { clearTimeout(this.advanceTypingTimeout); }
    }
    public setSource(newSource: string): void {
        this.stop();
        this.source = newSource;
        this.start();
    }
    private advanceTyping = () => {
        const now = Date.now();

        if(now >= this.endTime) {
            this.onFinishFuncs.forEach(func => func(this.source));
        } else if(now < this.animationStartTime) {
            this.advanceTypingTimeout = setTimeout(this.advanceTyping, this.animationStartTime - now);
        } else {
            const progress = (now - this.animationStartTime) / (this.endTime - this.animationStartTime);
            const charIndex = Math.floor(progress * this.source.length);
            const newDislayText = this.source.substring(0, charIndex);
            // const subStrSoFar = this.source.substring(0, charIndex);
            // if(TypingEffect.endsWithThreeBackticks(subStrSoFar)) {
            //     this.inCodeBlock = !this.inCodeBlock;
            // }

            // const newDislayText = this.inCodeBlock ? `${subStrSoFar}\n\`\`\`` : subStrSoFar;

            this.onChangeFuncs.forEach(func => func(newDislayText));
            this.advanceTypingTimeout = setTimeout(this.advanceTyping, this.timePerCharacter);
        }
    }

    // private static endsWithThreeBackticks(str: string): boolean {
    //     return str.length >= 3 && str[str.length - 1] === '`' && str[str.length - 2] === '`' && str[str.length - 3] === '`';
    // }
}