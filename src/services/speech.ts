import { t } from '../i18n';
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike | undefined;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstanceLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null;
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return english.sort((a, b) => {
    const aUS = a.lang.toLowerCase() === 'en-us' ? 0 : 1;
    const bUS = b.lang.toLowerCase() === 'en-us' ? 0 : 1;
    if (aUS !== bUS) return aUS - bUS;
    return a.name.localeCompare(b.name);
  });
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakText(
  text: string,
  options: {
    rate?: number;
    voiceURI?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  } = {},
): boolean {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.();
    return false;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = options.rate ?? 0.95;

  const voices = getEnglishVoices();
  const chosen =
    (options.voiceURI ? voices.find((v) => v.voiceURI === options.voiceURI) : undefined) ??
    voices.find((v) => v.lang.toLowerCase() === 'en-us' && v.default) ??
    voices.find((v) => v.lang.toLowerCase() === 'en-us') ??
    voices[0];

  if (chosen) {
    utterance.voice = chosen;
  }

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
  return true;
}

export interface ListeningSession {
  stop: () => void;
  abort: () => void;
}

export function startListening(callbacks: {
  onStart?: () => void;
  onInterim?: (transcript: string) => void;
  onFinal?: (transcript: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): ListeningSession | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    callbacks.onError?.(t('mic.unsupported'));
    return null;
  }

  // Stop TTS before opening the mic so the mic does not capture the prompt audio.
  stopSpeaking();

  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onstart = () => {
    callbacks.onStart?.();
  };

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? '';
      if (result?.isFinal) {
        finalTranscript += `${text} `;
      } else {
        interim += text;
      }
    }

    const combined = `${finalTranscript}${interim}`.trim();
    if (combined) {
      callbacks.onInterim?.(combined);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
    const messages: Record<string, string> = {
      'not-allowed': t('mic.denied'),
      'service-not-allowed': t('mic.blocked'),
      'no-speech': t('mic.noSpeech'),
      'audio-capture': t('mic.noDevice'),
      network: t('mic.network'),
      aborted: '',
    };
    const msg = messages[event.error] ?? t('mic.other', { code: event.error });
    if (msg) {
      callbacks.onError?.(msg);
    }
  };

  recognition.onend = () => {
    const trimmed = finalTranscript.trim();
    if (trimmed) {
      callbacks.onFinal?.(trimmed);
    }
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    callbacks.onError?.(t('mic.startFailed'));
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Ignore already-stopped recognition.
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        // Ignore already-aborted recognition.
      }
    },
  };
}
