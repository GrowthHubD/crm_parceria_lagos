declare module "opus-recorder" {
  interface OpusRecorderOptions {
    encoderPath: string;
    encoderApplication?: number;
    encoderSampleRate?: number;
    numberOfChannels?: number;
    encoderBitRate?: number;
    streamPages?: boolean;
    monitorGain?: number;
    recordingGain?: number;
    resampleQuality?: number;
  }

  class Recorder {
    constructor(options: OpusRecorderOptions);
    ondataavailable?: (data: Uint8Array) => void;
    onstart?: () => void;
    onstop?: () => void;
    onpause?: () => void;
    onresume?: () => void;
    start(): Promise<void>;
    stop(): void;
    pause(): void;
    resume(): void;
    close(): void;
    sourceNode?: MediaStreamAudioSourceNode;
    audioContext?: AudioContext;
    stream?: MediaStream;
  }

  export default Recorder;
}
