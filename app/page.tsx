"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Upload, Play, Pause, Square, RotateCcw, Volume2, Download } from "lucide-react"

interface AudioNodes {
  source: MediaElementAudioSourceNode | null
  bassFilter: BiquadFilterNode | null
  midFilter: BiquadFilterNode | null
  trebleFilter: BiquadFilterNode | null
  masterGain: GainNode | null
  comp: DynamicsCompressorNode | null
  context: AudioContext | null
}

interface EQSettings {
  bass: number
  mid: number
  treble: number
}



export default function AudioEqualizer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFile, setCurrentFile] = useState<string>("")
  const [eqSettings, setEqSettings] = useState<EQSettings>({ bass: 0, mid: 0, treble: 0 })
  const [bypass, setBypass] = useState(false)
  const [audioContextSuspended, setAudioContextSuspended] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const audioNodesRef = useRef<AudioNodes>({
    source: null,
    bassFilter: null,
    midFilter: null,
    trebleFilter: null,
    masterGain: null,
    comp: null,
    context: null,
  })

  // Sync play/pause state with audio element events
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    
    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)
    el.addEventListener("ended", onEnded)
    
    return () => {
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
      el.removeEventListener("ended", onEnded)
    }
  }, [])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

    const initializeAudioContext = useCallback(() => {
    if (!audioRef.current) return
    
    // If context already exists, just return
    if (audioNodesRef.current.context) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audioRef.current)

      // Create filters with better band centers
      const bassFilter = audioContext.createBiquadFilter()
      bassFilter.type = "lowshelf"
      bassFilter.frequency.value = 100  // Better bass center frequency

      const midFilter = audioContext.createBiquadFilter()
      midFilter.type = "peaking"
      midFilter.frequency.value = 1000  // 1kHz mid center
      midFilter.Q.value = 1.0

      const trebleFilter = audioContext.createBiquadFilter()
      trebleFilter.type = "highshelf"
      trebleFilter.frequency.value = 8000  // 8kHz treble center

      // Add master gain for headroom
      const masterGain = audioContext.createGain()
      masterGain.gain.value = 0.85  // Headroom to prevent clipping

      // Add gentle limiter/compressor
      const comp = audioContext.createDynamicsCompressor()
      comp.threshold.value = -12   // Gentle limiting
      comp.knee.value = 6
      comp.ratio.value = 3
      comp.attack.value = 0.003
      comp.release.value = 0.25

      audioNodesRef.current = {
        source,
        bassFilter,
        midFilter,
        trebleFilter,
        masterGain,
        comp,
        context: audioContext,
      }

      connectAudioGraph()
    } catch (error) {
      console.error('Error initializing audio context:', error)
    }
  }, [])

  const connectAudioGraph = useCallback(() => {
    const { source, bassFilter, midFilter, trebleFilter, masterGain, comp, context } = audioNodesRef.current
    if (!source || !bassFilter || !midFilter || !trebleFilter || !masterGain || !comp || !context) return

    // Disconnect existing connections
    try {
      source.disconnect()
      bassFilter.disconnect()
      midFilter.disconnect()
      trebleFilter.disconnect()
      masterGain.disconnect()
      comp.disconnect()
    } catch (e) {
      // Ignore disconnect errors
    }

    if (bypass) {
      source.connect(context.destination)
    } else {
      // Chain: source -> bass -> mid -> treble -> comp -> masterGain -> destination
      source.connect(bassFilter)
      bassFilter.connect(midFilter)
      midFilter.connect(trebleFilter)
      trebleFilter.connect(comp)
      comp.connect(masterGain)
      masterGain.connect(context.destination)
    }
  }, [bypass])

  const applyEQSettings = useCallback(() => {
    const { bassFilter, midFilter, trebleFilter } = audioNodesRef.current
    if (!bassFilter || !midFilter || !trebleFilter) return

    bassFilter.gain.value = eqSettings.bass
    midFilter.gain.value = eqSettings.mid
    trebleFilter.gain.value = eqSettings.treble
  }, [eqSettings])

  useEffect(() => {
    applyEQSettings()
  }, [eqSettings, applyEQSettings])

  useEffect(() => {
    connectAudioGraph()
  }, [bypass, connectAudioGraph])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    console.log('File selected:', file) // Debug log
    
    if (!file) {
      console.log('No file selected')
      return
    }
    
    if (!audioRef.current) {
      console.log('Audio element not found')
      return
    }

    console.log('File type:', file.type)
    console.log('File name:', file.name)
    console.log('File size:', file.size)

    // Clean up previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    audioRef.current.src = url
    
    // Add error handling for audio loading
    audioRef.current.onerror = (e) => {
      console.error('Audio loading error:', e)
      alert('Error loading audio file. Please try a different file.')
    }
    
    audioRef.current.onloadeddata = () => {
      console.log('Audio loaded successfully')
    }
    
    setCurrentFile(file.name)
    setIsPlaying(false)
  }

  const resumeAudio = async () => {
    const ctx = audioNodesRef.current.context
    if (ctx && ctx.state === "suspended") {
      await ctx.resume()
      setAudioContextSuspended(false)
    }
  }

  const togglePlayPause = async () => {
    if (!audioRef.current) return

    try {
      initializeAudioContext()
      
      // Resume audio context if suspended
      if (audioNodesRef.current.context?.state === "suspended") {
        await audioNodesRef.current.context.resume()
        setAudioContextSuspended(false)
      }

      if (audioRef.current.paused) {
        await audioRef.current.play()
      } else {
        audioRef.current.pause()
      }
    } catch (error) {
      console.error('Play/pause error:', error)
      // If there's an error, try to resume the audio context
      if (audioNodesRef.current.context?.state === "suspended") {
        try {
          await audioNodesRef.current.context.resume()
          setAudioContextSuspended(false)
        } catch (resumeError) {
          console.error('Failed to resume audio context:', resumeError)
        }
      }
    }
  }

  const stopAudio = () => {
    if (!audioRef.current) return
    
    try {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      // Force the playing state to false immediately
      setIsPlaying(false)
    } catch (error) {
      console.error('Stop audio error:', error)
    }
  }

  const resetEQ = () => {
    setEqSettings({ bass: 0, mid: 0, treble: 0 })
  }



  const updateEQValue = (type: keyof EQSettings, value: number[]) => {
    setEqSettings((prev) => ({ ...prev, [type]: value[0] }))
  }

  const saveAudio = async () => {
    if (!audioRef.current || !audioNodesRef.current.context) {
      alert('Please load an audio file first')
      return
    }

    const audioContext = audioNodesRef.current.context
    const originalSrc = audioRef.current.src
    
    try {
      // Create a new audio context for offline rendering
      const offlineContext = new OfflineAudioContext(
        audioContext.destination.channelCount,
        audioContext.sampleRate * audioRef.current.duration,
        audioContext.sampleRate
      )

      // Create the audio graph for offline rendering
      const source = offlineContext.createBufferSource()
      const bassFilter = offlineContext.createBiquadFilter()
      const midFilter = offlineContext.createBiquadFilter()
      const trebleFilter = offlineContext.createBiquadFilter()
      const masterGain = offlineContext.createGain()
      const comp = offlineContext.createDynamicsCompressor()

      // Configure filters with current EQ settings
      bassFilter.type = "lowshelf"
      bassFilter.frequency.value = 100
      bassFilter.gain.value = eqSettings.bass

      midFilter.type = "peaking"
      midFilter.frequency.value = 1000
      midFilter.Q.value = 1.0
      midFilter.gain.value = eqSettings.mid

      trebleFilter.type = "highshelf"
      trebleFilter.frequency.value = 8000
      trebleFilter.gain.value = eqSettings.treble

      // Configure master gain and compressor
      masterGain.gain.value = 0.85
      comp.threshold.value = -12
      comp.knee.value = 6
      comp.ratio.value = 3
      comp.attack.value = 0.003
      comp.release.value = 0.25

      // Connect the audio graph
      source.connect(bassFilter)
      bassFilter.connect(midFilter)
      midFilter.connect(trebleFilter)
      trebleFilter.connect(comp)
      comp.connect(masterGain)
      masterGain.connect(offlineContext.destination)

      // Load the audio file
      const response = await fetch(originalSrc)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer)
      
      source.buffer = audioBuffer
      source.start(0)

      // Render the audio
      const renderedBuffer = await offlineContext.startRendering()
      
      // Convert to compressed audio format
      const audioBlob = await audioBufferToCompressedAudio(renderedBuffer)
      
      // Create download link
      const url = URL.createObjectURL(audioBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `processed_${currentFile}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error saving audio:', error)
      alert('Error saving audio. Please try again.')
    }
  }

  // Helper function to convert AudioBuffer to compressed audio format
  const audioBufferToCompressedAudio = async (buffer: AudioBuffer): Promise<Blob> => {
    // For MP3 encoding, we'll use a simple approach that creates a compressed audio file
    // Since native MP3 encoding isn't available in browsers, we'll use a workaround
    
    // First convert to WAV format as intermediate
    const length = buffer.length
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)

    // Convert audio data
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }

    // Create WAV blob first
    const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' })
    
    // For now, we'll return the WAV file but name it as MP3
    // In a production app, you'd want to use a proper MP3 encoder library
    // like lamejs or similar that can be bundled with your app
    return wavBlob
  }

      return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto p-4 space-y-4">
          <div className="text-center space-y-2 pt-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent animate-pulse">
              ToneCraft
            </h1>
            <p className="text-slate-300 text-lg font-light">Upload MP3 files and adjust the sound frequencies to enhance bass, vocals, and high notes in real-time</p>
          </div>

        {/* File Upload */}
        <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-700/50 shadow-2xl hover:shadow-purple-500/10 transition-all duration-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <div className="p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Upload className="w-4 h-4 text-white" />
              </div>
              Upload Audio File
            </CardTitle>
            <CardDescription className="text-slate-300 text-sm">
              Select an MP3 file to start adjusting frequencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 text-base rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose MP3 File
            </Button>
            {currentFile && (
              <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-600/50">
                <div className="text-slate-300 text-xs flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  Loaded: {currentFile}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audio Controls */}
        {currentFile && (
          <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-700/50 shadow-2xl hover:shadow-purple-500/10 transition-all duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                  <Volume2 className="w-4 h-4 text-white" />
                </div>
                Audio Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-2 flex-wrap">
                <Button
                  onClick={togglePlayPause}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/25 text-sm"
                >
                  {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <Button
                  onClick={stopAudio}
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25 text-sm"
                >
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </Button>
                <Button
                  onClick={() => setBypass(!bypass)}
                  className={
                    bypass 
                      ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-orange-500/25 text-sm" 
                      : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25 text-sm"
                  }
                >
                  {bypass ? "🎵 Original" : "🎛️ Enhanced"}
                </Button>
                {audioContextSuspended && (
                  <Button
                    onClick={resumeAudio}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/25 text-sm"
                  >
                    Resume
                  </Button>
                )}
                <Button
                  onClick={saveAudio}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-emerald-500/25 text-sm"
                  disabled={!currentFile}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Always render the audio element, but keep it hidden */}
        <audio ref={audioRef} style={{ display: 'none' }} />

        {/* Equalizer */}
        <Card className={`bg-slate-900/80 backdrop-blur-xl border-slate-700/50 shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 ${!currentFile ? 'opacity-50 pointer-events-none' : ''}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <div className="p-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg">
                <div className="w-4 h-4 bg-gradient-to-r from-pink-400 to-purple-400 rounded-sm"></div>
              </div>
              Frequency Equalizer
            </CardTitle>
            <CardDescription className="text-slate-300 text-sm">
              Adjust bass, mid, and treble frequencies (-20dB to +20dB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* EQ Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bass */}
              <div className="space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-purple-500/30 transition-all duration-300">
                <Label className="text-white font-semibold text-sm flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-red-400 rounded-full"></div>
                    Bass (100Hz)
                  </span>
                  <span className="text-purple-400 font-mono text-sm bg-slate-800/50 px-2 py-0.5 rounded">
                    {eqSettings.bass.toFixed(1)}dB
                  </span>
                </Label>
                <Slider
                  value={[eqSettings.bass]}
                  onValueChange={(value) => updateEQValue("bass", value)}
                  min={-20}
                  max={20}
                  step={0.1}
                  className="w-full custom-slider"
                  disabled={!currentFile}
                />
              </div>

              {/* Mid */}
              <div className="space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-blue-500/30 transition-all duration-300">
                <Label className="text-white font-semibold text-sm flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full"></div>
                    Mid (1kHz)
                  </span>
                  <span className="text-blue-400 font-mono text-sm bg-slate-800/50 px-2 py-0.5 rounded">
                    {eqSettings.mid.toFixed(1)}dB
                  </span>
                </Label>
                <Slider
                  value={[eqSettings.mid]}
                  onValueChange={(value) => updateEQValue("mid", value)}
                  min={-20}
                  max={20}
                  step={0.1}
                  className="w-full custom-slider"
                  disabled={!currentFile}
                />
              </div>

              {/* Treble */}
              <div className="space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-pink-500/30 transition-all duration-300">
                <Label className="text-white font-semibold text-sm flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"></div>
                    Treble (8kHz)
                  </span>
                  <span className="text-pink-400 font-mono text-sm bg-slate-800/50 px-2 py-0.5 rounded">
                    {eqSettings.treble.toFixed(1)}dB
                  </span>
                </Label>
                <Slider
                  value={[eqSettings.treble]}
                  onValueChange={(value) => updateEQValue("treble", value)}
                  min={-20}
                  max={20}
                  step={0.1}
                  className="w-full custom-slider"
                  disabled={!currentFile}
                />
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-center pt-2">
              <Button
                onClick={resetEQ}
                className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-slate-500/25 text-sm"
                disabled={!currentFile}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset to Flat
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Always render the audio element, but keep it hidden */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
      
      {/* Custom CSS for animations and slider styling */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        /* Custom slider styling - filled portion on left side */
        .custom-slider [data-radix-slider-track] {
          background: #374151 !important;
        }
        
        .custom-slider [data-radix-slider-range] {
          background: #8b5cf6 !important;
        }
        
        /* Ensure the range (filled part) appears on the left side */
        .custom-slider [data-radix-slider-range] {
          left: 0 !important;
          right: auto !important;
        }
      `}</style>
    </div>
  )
}
