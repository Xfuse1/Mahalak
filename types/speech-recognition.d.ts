export {}

declare global {
  interface BrowserSpeechRecognitionAlternative {
    transcript: string
    confidence: number
  }

  interface BrowserSpeechRecognitionResult {
    [index: number]: BrowserSpeechRecognitionAlternative
    length: number
    isFinal: boolean
  }

  interface BrowserSpeechRecognitionResultList {
    [index: number]: BrowserSpeechRecognitionResult
    length: number
  }

  interface BrowserSpeechRecognitionEvent extends Event {
    results: BrowserSpeechRecognitionResultList
  }

  interface BrowserSpeechRecognition extends EventTarget {
    lang: string
    continuous: boolean
    interimResults: boolean
    onstart: ((this: BrowserSpeechRecognition, ev: Event) => void) | null
    onresult: ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionEvent) => void) | null
    onerror: ((this: BrowserSpeechRecognition, ev: Event) => void) | null
    onend: ((this: BrowserSpeechRecognition, ev: Event) => void) | null
    start(): void
    stop(): void
  }

  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition
  }
}
