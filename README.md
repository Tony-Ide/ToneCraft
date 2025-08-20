# ToneCraft 🎵

A modern, web-based audio equalizer that lets you enhance MP3 files with real-time frequency adjustments.

## Features

- **🎵 MP3 Upload** - Drag and drop or select MP3 files
- **🎛️ Real-time EQ** - Adjust bass, vocals, and high notes instantly
- **🎧 Live Preview** - Hear changes as you make them
- **💾 Save Enhanced Audio** - Download your processed MP3 files
- **🎯 Professional Processing** - Built-in compressor and master gain for optimal sound
- **📱 Responsive Design** - Works on desktop and mobile devices

## How to Use

1. **Upload** an MP3 file using the upload button
2. **Adjust** the three frequency sliders:
   - **Bass (100Hz)** - Enhance low frequencies
   - **Mid (1kHz)** - Adjust vocal clarity
   - **Treble (8kHz)** - Brighten high notes
3. **Preview** your changes in real-time
4. **Save** your enhanced audio as a new MP3 file

## Technical Details

- Built with **Next.js 14** and **React**
- Uses **Web Audio API** for real-time processing
- **Professional audio chain**: Filters → Compressor → Master Gain
- **±20dB range** for each frequency band
- **Glass morphism UI** with smooth animations

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Browser Support

Works in all modern browsers that support the Web Audio API:
- Chrome 66+
- Firefox 60+
- Safari 14+
- Edge 79+

## License

MIT License - feel free to use and modify!
