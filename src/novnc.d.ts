declare module '@novnc/novnc' {
  interface RFBOptions {
    credentials?: { password?: string }
    wsProtocols?: string | string[]
  }
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: RFBOptions)
    scaleViewport: boolean
    resizeSession: boolean
    viewOnly: boolean
    disconnect(): void
    addEventListener(type: string, listener: (event: Event) => void): void
    removeEventListener(type: string, listener: (event: Event) => void): void
  }
}
