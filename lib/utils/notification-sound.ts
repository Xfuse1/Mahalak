// MOB-04: تنبيه صوتي للطلب الجديد عبر Web Audio API — لا يحتاج ملف صوت.
// فشل صامت عند منع التشغيل التلقائي (autoplay) أو عدم دعم المتصفح.

let ctx: AudioContext | null = null

export function playNewOrderSound() {
  if (typeof window === "undefined") return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!ctx) ctx = new AC()
    if (ctx.state === "suspended") ctx.resume().catch(() => {})

    const now = ctx.currentTime
    // نغمتان قصيرتان صاعدتان (جرس لطيف)
    const tones = [880, 1320]
    tones.forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const start = now + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.connect(gain)
      gain.connect(ctx!.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    })
  } catch {
    // فشل صامت
  }
}
