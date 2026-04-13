import { Camera, ScanFace, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function FaceCapture({ onFramesChange, maxFrames = 5, label = 'Capture face samples' }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const [active, setActive] = useState(false)
  const [frames, setFrames] = useState([])

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
    setActive(true)
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setActive(false)
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const image = canvas.toDataURL('image/jpeg', 0.85)
    const nextFrames = [...frames, image].slice(0, maxFrames)
    setFrames(nextFrames)
    onFramesChange?.(nextFrames)
  }

  return (
    <div className="card-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Capture 5 to 10 clear images for better matching.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{frames.length}/{maxFrames}</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.5rem] bg-slate-950">
        <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {active ? (
          <>
            <button onClick={captureFrame} type="button" className="action-primary">
              <ScanFace size={16} />
              Capture sample
            </button>
            <button onClick={stopCamera} type="button" className="action-secondary">
              <Square size={16} />
              Stop
            </button>
          </>
        ) : (
          <button onClick={startCamera} type="button" className="action-primary">
            <Camera size={16} />
            Start camera
          </button>
        )}
      </div>
    </div>
  )
}
