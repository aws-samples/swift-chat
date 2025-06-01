import Foundation
import AVFoundation

enum AudioError: Error {
    case recordingFailed(String)
    case playbackFailed(String)
    case audioSessionFailed(String)
    case microphoneAccessDenied(String)
}

class AudioManager: NSObject {
    // Basic components
    private var audioSession = AVAudioSession.sharedInstance()
    private var audioRecorder: AVAudioRecorder?
    
    // Audio engine components
    private var audioEngine = AVAudioEngine()
    private var playerNode = AVAudioPlayerNode()
    
    // Microphone capture related
    private var isCapturing = false
  
    private var isAudioContentEnd = true
    private var isPlaying = false
    private var isActive = false

    // Barge-in related
    private var bargeIn = false
  
    private var allowInterruption = true
    
    // Standard format for audio processing (48kHz is widely supported)
    private var iOSAudioFormat: AVAudioFormat = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
    
    // Input format for Nova Sonic (16kHz)
    private var inputFormat: AVAudioFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: 16000,
        channels: 1,
        interleaved: false
    )!
  
    private var outputFormat: AVAudioFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: 24000,
        channels: 1,
        interleaved: false
    )!
    
    // Pre-created converter for better performance
    private var converter: AVAudioConverter?
    
    // Audio processing queue
    private let audioQueue = DispatchQueue(label: "com.swiftchat.audio", qos: .userInteractive)
    
    // Simple audio data queue
    private var audioDataQueue = [Data]()
    private var isProcessingQueue = false
    
    // Recording settings
    private let recordSettings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatLinearPCM),
        AVSampleRateKey: 16000.0,
        AVNumberOfChannelsKey: 1,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false
    ]
    
    // Callbacks
    var onError: ((Error) -> Void)?
    var onAudioCaptured: ((Data) -> Void)?  // New callback for captured audio data
    var onAudioLevelChanged: ((String, Int) -> Void)? // Callback for audio level changes (source, level 1-10)
    
    // Audio level tracking
    private var lastInputLevel: Int = 0
    private var lastOutputLevel: Int = 0
    
    override init() {
        super.init()
    }
    
    deinit {
        audioEngine.stop()
    }

    func setAllowInterruption(_ allowInterruption: Bool) {
        self.allowInterruption = allowInterruption
    }

    func setIsActive(_ isActive: Bool) {
        if !isActive {
            isAudioContentEnd = true
            onAudioEnd()
        }
        self.isActive = isActive
    }

    // MARK: - Audio Setup
    private func setupAudio() {
        // Setup audio session with speaker output
        do {
            // Changed to voiceChat mode - better for VoIP applications
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth, .duckOthers])
            try audioSession.setActive(true)
            if audioSession.isInputGainSettable {
                try audioSession.setInputGain(1.0)
            }
        } catch {
            print("Failed to setup audio session: \(error)")
        }
        // Setup audio engine with explicit format
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: iOSAudioFormat)
        audioEngine.connect(audioEngine.mainMixerNode, to: audioEngine.outputNode, format: nil)
        // Enable voice processing (echo cancellation)
        do {
            try audioEngine.inputNode.setVoiceProcessingEnabled(true)
            print("Voice processing enabled successfully")
        } catch {
            print("Failed to enable voice processing: \(error)")
        }
        
        // Set player node volume higher (for playback volume)
        playerNode.volume = 2.0
        // Pre-create converter for better performance
        converter = AVAudioConverter(from: outputFormat, to: iOSAudioFormat)
    }
    
    // MARK: - Recording
    
    func startRecording() throws -> URL {
        print("start Recording")
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = UUID().uuidString + ".wav"
        let fileURL = tempDir.appendingPathComponent(fileName)
        
        do {
            audioRecorder = try AVAudioRecorder(url: fileURL, settings: recordSettings)
            audioRecorder?.delegate = self
            
            guard let recorder = audioRecorder, recorder.prepareToRecord() else {
                throw AudioError.recordingFailed("Failed to prepare recorder")
            }
            
            if recorder.record() {
                return fileURL
            } else {
                throw AudioError.recordingFailed("Failed to start recording")
            }
        } catch {
            if let audioError = error as? AudioError {
                throw audioError
            } else {
                throw AudioError.recordingFailed("Recording error: \(error)")
            }
        }
    }
    
    func stopRecording() -> URL? {
        guard let recorder = audioRecorder, recorder.isRecording else {
            return nil
        }
        
        let fileURL = recorder.url
        recorder.stop()
        audioRecorder = nil
        return fileURL
    }
    
    // MARK: - Barge-in handling
    
    func setBargeIn(_ value: Bool) {
        audioQueue.async { [weak self] in
            guard let self = self else { return }
            self.bargeIn = value
            
            // If set to interrupt state, process queue immediately
            if value {
                self.processQueue()
            }
        }
    }
    
    // MARK: - Playback
    // Helper method to convert nova sonic output format(24kHz) audio data to a buffer with iOS Format(48kHz)
    private func convertOutputAudioToBuffer(data: Data) -> AVAudioPCMBuffer? {
        // Create input buffer with 24kHz format (data.count / 2 because each sample is 2 bytes)
        let frameCapacity = AVAudioFrameCount(data.count / 2)
        
        guard let inputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCapacity) else {
            return nil
        }
        inputBuffer.frameLength = inputBuffer.frameCapacity
        
        // Fill input buffer with audio data
        data.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
            if let baseAddress = bytes.baseAddress {
                memcpy(inputBuffer.int16ChannelData![0], baseAddress, data.count)
            }
        }
        
        // Use pre-created converter
        guard let converter = self.converter else {
            return nil
        }
        
        // Calculate output buffer size based on sample rate conversion ratio
        let ratio = iOSAudioFormat.sampleRate / outputFormat.sampleRate
        let outputFrames = AVAudioFrameCount(Double(inputBuffer.frameLength) * ratio)
        
        // Create output buffer with 48kHz format
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: iOSAudioFormat, frameCapacity: outputFrames) else {
            return nil
        }
        
        // Perform conversion
        var error: NSError?
        let status = converter.convert(to: outputBuffer, error: &error) { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            return inputBuffer
        }
        
        if status == .error || error != nil {
            return nil
        }
        
        return outputBuffer
    }
    
    func playAudio(data: Data) throws {
        // Ensure engine is running
        isPlaying = true
        isAudioContentEnd = false

        // Process audio on dedicated queue
        audioQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Add to queue
            self.audioDataQueue.append(data)
            
            // If not already processing, start processing
            if !self.isProcessingQueue {
                self.processQueue()
            }
        }
    }
    
    private func processQueue() {
        // Check if interruption is needed
        if bargeIn {
            print("Barge-in detected. Clearing audio queue.")
            audioDataQueue.removeAll()
            bargeIn = false
            isProcessingQueue = false
            
            if playerNode.isPlaying {
                playerNode.stop()
            }
            
            return
        }
      
        guard !audioDataQueue.isEmpty else {
            isProcessingQueue = false
            if isPlaying, isAudioContentEnd {
                self.onAudioEnd()
            }
            return
        }
        
        isProcessingQueue = true
        
        // Process up to 20 audio data blocks at once
        let batchSize = min(20, audioDataQueue.count)
        var combinedData = Data()
        // Combine multiple audio data blocks
        for _ in 0..<batchSize {
            let audioData = audioDataQueue.removeFirst()
            combinedData.append(audioData)
        }
        
        // Convert combined audio data to buffer with sample rate conversion
        if let buffer = convertOutputAudioToBuffer(data: combinedData) {
            // Calculate audio level from output buffer
            let level = calculateAudioLevel(buffer: buffer)
            let normalizedLevel = normalizeToScale(level: level)
            
            // Only send callback if level changed
            if normalizedLevel != lastOutputLevel {
                lastOutputLevel = normalizedLevel
                onAudioLevelChanged?("speaker", normalizedLevel)
            }
            
            // Schedule buffer for playback
            playerNode.scheduleBuffer(buffer, at: nil, options: [], completionHandler: { [weak self] in
                guard let self = self else { return }
                self.processQueue() // Process next batch
            })
            
            // Start playback if not already playing
            if !playerNode.isPlaying && audioEngine.isRunning {
                playerNode.play()
            }
        } else {
            // If conversion failed, try next batch
            processQueue()
        }
    }
  
    func readAudioChunk(from url: URL, chunkSize: Int = 1024) -> Data? {
        do {
            let data = try Data(contentsOf: url)
            return data
        } catch {
            onError?(AudioError.playbackFailed("Failed to read audio file: \(error)"))
            return nil
        }
    }
    
    // MARK: - Microphone Capturing
    
    func startCapturing() throws {
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }
        setupAudio()
        // Check microphone permission
        switch audioSession.recordPermission {
            case .denied:
                throw AudioError.microphoneAccessDenied("Microphone access denied")
            case .undetermined:
                // Request permission
                var permissionGranted = false
                let semaphore = DispatchSemaphore(value: 0)
                
                audioSession.requestRecordPermission { granted in
                    permissionGranted = granted
                    semaphore.signal()
                }
                
                _ = semaphore.wait(timeout: .now() + 5.0)
                
                if !permissionGranted {
                    throw AudioError.microphoneAccessDenied("Microphone access denied")
                }
            case .granted:
                break
            @unknown default:
                throw AudioError.microphoneAccessDenied("Unknown microphone permission status")
        }
        
        // Ensure audio session is active
        if !audioSession.isInputAvailable {
            throw AudioError.recordingFailed("Audio input is not available")
        }
        do {
            // Get input node
            let inputNode = audioEngine.inputNode
            let singleChannelFormat = AVAudioFormat(
                standardFormatWithSampleRate: inputNode.outputFormat(forBus: 0).sampleRate,
                channels: 1
            )
            let bufferSize: AVAudioFrameCount = 1024
            print("Start Listening...")
            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: singleChannelFormat) { [weak self] (buffer, time) in
                guard let self = self, self.isCapturing else { return }
                if isPlaying, !allowInterruption {
                    if self.lastInputLevel != 1 {
                        self.onAudioLevelChanged?("microphone", 1)
                    }
                    return
                }
                // Calculate audio level from input buffer
                var level = self.calculateAudioLevel(buffer: buffer)
                level = min(1, level * 1.5)
                let normalizedLevel = self.normalizeToScale(level: level)
                
                // Only send callback if level changed
                if normalizedLevel != self.lastInputLevel {
                    self.lastInputLevel = normalizedLevel
                    self.onAudioLevelChanged?("microphone", normalizedLevel)
                }
                // Convert buffer to target format (16kHz, 16-bit PCM)
                if let convertedBuffer = self.convertInputBufferToNovaSonicFormat(buffer, sourceFormat: buffer.format) {
                    // Convert the converted buffer to Data
                    if let data = self.bufferToData(convertedBuffer) {
                        // Send data through callback in background thread
                        self.onAudioCaptured?(data)
                    }
                }
            }
            try audioEngine.start()
            isCapturing = true
            print("Audio engine started successfully")
        } catch {
            print("Failed to start audio engine or install tap: \(error)")
            onError?(AudioError.recordingFailed("Recording error: \(error)"))
        }
    }
    
    // Convert device input buffer format(48kHz) to nova sonic target format (16kHz)
    private func convertInputBufferToNovaSonicFormat(_ buffer: AVAudioPCMBuffer, sourceFormat: AVAudioFormat) -> AVAudioPCMBuffer? {
        // Create a converter from source format to target format
        guard let converter = AVAudioConverter(from: sourceFormat, to: inputFormat) else {
            print("Failed to create format converter")
            return nil
        }
        
        // Calculate output buffer size based on sample rate conversion ratio
        let ratio = Double(inputFormat.sampleRate) / Double(sourceFormat.sampleRate)
        let outputFrames = AVAudioFrameCount(Double(buffer.frameLength) * ratio)
        
        // Create output buffer with target format
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: outputFrames) else {
            print("Failed to create output buffer")
            return nil
        }
        
        // Perform conversion
        var error: NSError?
        let status = converter.convert(to: outputBuffer, error: &error) { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }
        
        if status == .error || error != nil {
            print("Conversion error: \(error?.localizedDescription ?? "unknown error")")
            return nil
        }
        
        return outputBuffer
    }
    
    // MARK: - Handle End Conversation
    func stopCapturing() {
        guard isCapturing else { return }
        
        // Remove tap
        audioEngine.inputNode.removeTap(onBus: 0)
        isCapturing = false
        audioEngine.stop()
        print("Microphone capturing stopped")
    }
    
    func onAudioEnd() {
        isPlaying = false
        lastOutputLevel = 1
        onAudioLevelChanged?("speaker", 1)
    }

    func onContentEnd() {
        self.isAudioContentEnd = true
    }
    
    func stopPlayback() {
      // Clear queue
      audioQueue.async { [weak self] in
          guard let self = self else { return }
          
          // Clear queue
          self.audioDataQueue.removeAll()
          self.isProcessingQueue = false
          
          if self.playerNode.isPlaying {
              self.playerNode.stop()
          }
          print("Audio playback stopped")
      }
    }
    
    func deactivateAudioSession() throws {
        do {
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            throw AudioError.audioSessionFailed("Failed to deactivate audio session: \(error)")
        }
    }
    
    // Calculate audio level from buffer (0.0-1.0 range)
    private func calculateAudioLevel(buffer: AVAudioPCMBuffer) -> Float {
        guard let channelData = buffer.floatChannelData?[0] else { return 0.0 }
        
        let channelDataLength = Int(buffer.frameLength)
        var sum: Float = 0.0
        
        // Calculate RMS (Root Mean Square) of audio samples
        for i in 0..<channelDataLength {
            let sample = channelData[i]
            sum += sample * sample
        }
        
        // Avoid division by zero
        if channelDataLength > 0 {
            let rms = sqrt(sum / Float(channelDataLength))
            // Convert RMS to 0-1 range with logarithmic scaling
            return min(1.0, max(0.0, 20 * log10(rms) + 60) / 60)
        }
        
        return 0.0
    }
    
    // Normalize level to target scale (e.g., 1-10)
    private func normalizeToScale(level: Float, min: Float = 0.0, max: Float = 1.0, targetMin: Int = 1, targetMax: Int = 10) -> Int {
        let normalizedValue = (level - min) / (max - min)
        let scaledValue = normalizedValue * Float(targetMax - targetMin) + Float(targetMin)
        return Int(round(scaledValue))
    }
    
    // Convert PCM buffer to Data
    private func bufferToData(_ buffer: AVAudioPCMBuffer) -> Data? {
        guard let int16ChannelData = buffer.int16ChannelData else { return nil }
        
        let frameLength = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        let bytesPerSample = 2 // 16-bit = 2 bytes
        let dataSize = frameLength * bytesPerSample * channelCount
        
        var data = Data(capacity: dataSize)
        
        // Copy int16 data to Data
        for frame in 0..<frameLength {
            let sample = int16ChannelData[0][frame]
            var byteOrderedSample = sample.littleEndian // Ensure little-endian byte order
            withUnsafePointer(to: &byteOrderedSample) { pointer in
                 data.append(UnsafeBufferPointer(start: pointer, count: 1))
             }
        }
        
        return data
    }
}

// MARK: - AVAudioRecorderDelegate
extension AudioManager: AVAudioRecorderDelegate {
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            onError?(AudioError.recordingFailed("Recording finished unsuccessfully"))
        }
    }
    
    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        if let error = error {
            onError?(AudioError.recordingFailed("Recording error: \(error)"))
        } else {
            onError?(AudioError.recordingFailed("Unknown recording error occurred"))
        }
    }
}
