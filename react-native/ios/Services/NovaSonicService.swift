//
//  NovaSonicService.swift
//  SwiftChat
//
//  Created on 2025/4/10.
//

import Foundation
import AWSBedrockRuntime
import AWSSDKIdentity
import Smithy

enum NovaSonicError: Error {
    case invalidCredentials
    case streamInitializationFailed(String)
    case streamError(String)
    case invalidResponse(String)
    case audioProcessingError(String)
    case audioFileNotFound(String)
    case microphoneError(String)
}

class NovaSonicService {
    // AWS Configuration
    private var client: BedrockRuntimeClient?
    private var region: String
    private var accessKey: String
    private var secretKey: String
    private var sessionToken: String?
    private var modelId: String = "amazon.nova-sonic-v1:0"
    
    // Stream state
    private var isActive: Bool = false
    private var promptName: String
    private var contentName: String
    private var audioContentName: String
    private var allowInterruption: Bool = true
        
    // Stream handling
    private var inputContinuation: AsyncThrowingStream<BedrockRuntimeClientTypes.InvokeModelWithBidirectionalStreamInput, Error>.Continuation?
    
    // Audio manager
    public var audioManager = AudioManager()
    private var isCapturingAudio = false
    
    // Callbacks
    var onTranscriptReceived: ((String, String) -> Void)? // (role, text)
    var onStateChanged: ((String, String?) -> Void)? // (state, error?)
    var onAudioReceived: ((Data) -> Void)?
    var onError: ((Error) -> Void)?
    
    init(region: String, accessKey: String, secretKey: String, sessionToken: String? = nil) {
        self.region = region
        self.accessKey = accessKey
        self.secretKey = secretKey
        self.sessionToken = sessionToken
        self.promptName = UUID().uuidString
        self.contentName = UUID().uuidString
        self.audioContentName = UUID().uuidString
        // Setup audio manager callbacks
        setupAudioManager()
    }
    
    private func setupAudioManager() {
        // Set up audio capture callback
        audioManager.onAudioCaptured = { [weak self] audioData in
            guard let self = self else { return }
            // If active session, send to stream
            if self.isActive && self.isCapturingAudio {
                Task {
                    do {
                        try await self.sendAudioChunk(audioData: audioData)
                    } catch {
                        print("Error sending audio chunk: \(error)")
                        self.onError?(NovaSonicError.audioProcessingError("Failed to send audio chunk: \(error.localizedDescription)"))
                    }
                }
            }
        }
        
        audioManager.onError = { [weak self] error in
            self?.onError?(NovaSonicError.microphoneError("Audio manager error: \(error.localizedDescription)"))
        }
    }
    
    // MARK: - Client Initialization
    
    func initializeClient() throws {
        guard !accessKey.isEmpty && !secretKey.isEmpty else {
            throw NovaSonicError.invalidCredentials
        }
        
        // Create AWS credentials
        let credentials: AWSCredentialIdentity
        if let sessionToken = sessionToken, !sessionToken.isEmpty {
            credentials = AWSCredentialIdentity(
                accessKey: accessKey,
                secret: secretKey,
                sessionToken: sessionToken
            )
        } else {
            credentials = AWSCredentialIdentity(
                accessKey: accessKey,
                secret: secretKey
            )
        }
        
        let identityResolver = try StaticAWSCredentialIdentityResolver(credentials)
        
        // Create client configuration
        let clientConfig = try BedrockRuntimeClient.BedrockRuntimeClientConfiguration(
            region: region
        )
        clientConfig.awsCredentialIdentityResolver = identityResolver
        
        // Initialize the client
        client = BedrockRuntimeClient(config: clientConfig)
    }
    
    // MARK: - Stream Management
    
    // MARK: - Audio Input Control
    
    func startAudioInput() async throws {
        guard isActive else {
            throw NovaSonicError.streamError("No active session")
        }
        
        do {
            try audioManager.startCapturing()
            isCapturingAudio = true
            onStateChanged?("listening", nil)
            print("Started audio input from microphone")
        } catch {
            throw NovaSonicError.microphoneError("Failed to start audio input: \(error.localizedDescription)")
        }
    }
    
    func sendAudioChunk(audioData: Data) async throws {
        guard isActive else {
            throw NovaSonicError.streamError("No active session")
        }
        
        guard inputContinuation != nil else {
            throw NovaSonicError.streamError("No active stream")
        }
        
        // Create audio input event
        let audioEvent = createAudioInputEvent(base64Audio: audioData.base64EncodedString())
        sendEvent(eventJson: audioEvent)
    }
    
    func endAudioInput() async throws {
        guard isActive else {
            return
        }
        
        // Stop microphone capture
        if isCapturingAudio {
            audioManager.stopCapturing()
            isCapturingAudio = false
        }
        
        // Send content end event
        if inputContinuation != nil {
            let contentEndEvent = createContentEndEvent()
            sendEvent(eventJson: contentEndEvent)
            print("Sent content end event")
        }
        
        onStateChanged?("processing", nil)
    }
    
    // MARK: - Session Management
    func startSession(systemPrompt: String, voiceId: String, allowInterruption: Bool) async throws {
        if client == nil {
            try initializeClient()
        }
        guard let bedrockClient = client else {
            throw NovaSonicError.streamInitializationFailed("Failed to initialize Bedrock client")
        }
        
        do {
            // Create input stream & continuation
            print("startSession")
            self.allowInterruption = allowInterruption
            audioManager.setAllowInterruption(allowInterruption)
            let inputStream: AsyncThrowingStream<BedrockRuntimeClientTypes.InvokeModelWithBidirectionalStreamInput, Error>
            let continuation: AsyncThrowingStream<BedrockRuntimeClientTypes.InvokeModelWithBidirectionalStreamInput, Error>.Continuation
            (inputStream, continuation) = AsyncThrowingStream.makeStream()
            
            self.inputContinuation = continuation
            
            // Prepare all events
            let events = prepareEvents(systemPrompt: systemPrompt, voiceId: voiceId)
            print("Prepare all events success")
            
            // Ensure that SessionStart is the first event
            for event in events {
                print("Send event:\n" + event)
                sendEvent(eventJson: event)
            }
            
            // Wait until all preamble events are sent, then set isActive to true
            isActive = true
            try await startAudioInput()
            
            // Move API call to background task to avoid blocking
            Task {
                do {
                    // Call API
                    print("Calling Bedrock API with bidirectional stream")
                    let output = try await bedrockClient.invokeModelWithBidirectionalStream(input: InvokeModelWithBidirectionalStreamInput(
                        body: inputStream,
                        modelId: modelId
                    ))
                    
                    // Save output stream
                    guard let outputStream = output.body else {
                        throw NovaSonicError.streamInitializationFailed("No output stream returned")
                    }
                    print("OutputStream Received")
                    
                    // Start processing responses
                    await processResponses(from: outputStream)
                } catch {
                    isActive = false
                    onError?(NovaSonicError.streamInitializationFailed("Failed to start session: \(error.localizedDescription)"))
                }
            }
            
            print("after startSession")
            onStateChanged?("idle", nil)
        } catch {
            isActive = false
            onError?(NovaSonicError.streamInitializationFailed("Failed to start session: \(error.localizedDescription)"))
            throw NovaSonicError.streamInitializationFailed("Failed to start session: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Event Preparation
    
    private func prepareEvents(systemPrompt: String, voiceId: String) -> [String] {
        var events: [String] = []
        
        // Session Start Event
        let sessionStartEvent = """
        {
          "event": {
            "sessionStart": {
              "inferenceConfiguration": {
                "maxTokens": 10000,
                "topP": 0.95,
                "temperature": 0.9
              }
            }
          }
        }
        """
        events.append(sessionStartEvent)
        
        // Prompt Start Event
        let promptStartEvent = """
        {
          "event": {
            "promptStart": {
              "promptName": "\(promptName)",
              "textOutputConfiguration": {
                "mediaType": "text/plain"
              },
              "audioOutputConfiguration": {
                "mediaType": "audio/lpcm",
                "sampleRateHertz": 24000,
                "sampleSizeBits": 16,
                "channelCount": 1,
                "voiceId": "\(voiceId)",
                "encoding": "base64",
                "audioType": "SPEECH"
              },
              "toolUseOutputConfiguration": {
                "mediaType": "application/json"
              },
              "toolConfiguration": {
                "tools": []
              }
            }
          }
        }
        """
        events.append(promptStartEvent)
        
        // System Content Start Event
        let systemContentStartEvent = """
        {
          "event": {
            "contentStart": {
              "promptName": "\(promptName)",
              "contentName": "\(contentName)",
              "type": "TEXT",
              "interactive": true,
              "textInputConfiguration": {
                "mediaType": "text/plain"
              }
            }
          }
        }
        """
        events.append(systemContentStartEvent)
        
        // System Prompt Text Input
        let escapedPrompt = systemPrompt.replacingOccurrences(of: "\"", with: "\\\"")
        let systemPromptEvent = """
        {
          "event": {
            "textInput": {
              "promptName": "\(promptName)",
              "contentName": "\(contentName)",
              "content": "\(escapedPrompt)",
              "role": "SYSTEM"
            }
          }
        }
        """
        events.append(systemPromptEvent)
        
        // System Content End Event
        let systemContentEndEvent = """
        {
          "event": {
            "contentEnd": {
                "promptName": "\(promptName)",
                "contentName": "\(contentName)"
            }
          }
        }
        """
        events.append(systemContentEndEvent)
        
        // Audio Content Start Event
        let audioContentStartEvent = """
        {
          "event": {
            "contentStart": {
              "promptName": "\(promptName)",
              "contentName": "\(audioContentName)",
              "type": "AUDIO",
              "interactive": true,
              "audioInputConfiguration": {
                "mediaType": "audio/lpcm",
                "sampleRateHertz": 16000,
                "sampleSizeBits": 16,
                "channelCount": 1,
                "audioType": "SPEECH",
                "encoding": "base64"
              }
            }
          }
        }
        """
        events.append(audioContentStartEvent)
        
        return events
    }
    
    private func createAudioInputEvent(base64Audio: String) -> String {
        return """
        {
        "event": {
          "audioInput": {
            "promptName": "\(promptName)",
            "contentName": "\(audioContentName)",
            "content": "\(base64Audio)",
            "role": "USER"
          }
        }
        }
        """
    }
    
    private func createContentEndEvent() -> String {
        return """
        {
          "event": {
            "contentEnd": {
                "promptName": "\(promptName)",
                "contentName": "\(audioContentName)"
            }
          }
        }
        """
    }
    
    private func createPromptEndEvent() -> String {
        return """
        {
          "event": {
            "promptEnd": {
                "promptName": "\(promptName)"
            }
          }
        }
        """
    }
  
    private func createSessionEndEvent() -> String {
        return """
        {
          "event": {
            "sessionEnd": {}
          }
        }
        """
    }
    
    private func sendEvent(eventJson: String) {
        guard let continuation = inputContinuation else {
            print("❌ Cannot send event: No active stream")
            return
        }
        
        continuation.yield(BedrockRuntimeClientTypes.InvokeModelWithBidirectionalStreamInput.chunk(
            BedrockRuntimeClientTypes.BidirectionalInputPayloadPart(bytes: eventJson.data(using: .utf8))
        ))
    }
    
    // MARK: - Response Processing
    private func processResponses(from stream: AsyncThrowingStream<BedrockRuntimeClientTypes.InvokeModelWithBidirectionalStreamOutput, Error>) async {
        var totalAudioChunks = 0
        
        do {
            for try await response in stream {
                switch response {
                    case .chunk(let payload):
                        // Process response data
                        if let responseData = payload.bytes {
                            if let responseString = String(data: responseData, encoding: .utf8),
                               responseString.contains("audioOutput") {
                                totalAudioChunks += 1
                            }
                            handleResponseData(responseData)
                        }
                    case .sdkUnknown(let value):
                        print("Unknown response: \(value)")
                }
            }
            
            print("🔍 NovaSonic: Stream completed normally. Total audio chunks: \(totalAudioChunks)")
        } catch {
            print("❌ NovaSonic: Stream error: \(error)")
            onStateChanged?("error", "\(error)")
            onError?(NovaSonicError.streamError("Error processing responses: \(error)"))
        }
    }
    
    private func handleResponseData(_ data: Data) {
        // Parse response data
        guard let responseString = String(data: data, encoding: .utf8) else {
            print("❌ Failed to decode response data to string")
            onError?(NovaSonicError.invalidResponse("Failed to decode response data"))
            return
        }
        guard let jsonData = responseString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
              let event = json["event"] as? [String: Any] else {
            print("❌ Invalid JSON response format")
            onError?(NovaSonicError.invalidResponse("Invalid JSON response"))
            return
        }
        
        // Log event type for debugging
        let eventType = event.keys.first ?? "unknown"
        if eventType != "audioOutput" {
            print("eventType: " + eventType)
        }
        // Handle content start event
        if let contentStart = event["contentStart"] as? [String: Any] {
            if let role = contentStart["role"] as? String {
                // Check for speculative content
                var isSpeculative = false
                if let additionalFields = contentStart["additionalModelFields"] as? String,
                   let additionalData = additionalFields.data(using: String.Encoding.utf8),
                   let additionalJson = try? JSONSerialization.jsonObject(with: additionalData) as? [String: Any],
                   let generationStage = additionalJson["generationStage"] as? String,
                   generationStage == "SPECULATIVE" {
                    isSpeculative = true
                }
                
                if role == "ASSISTANT" && !isSpeculative {
                    onStateChanged?("speaking", nil)
                }
            }
        }
      
        if event["contentEnd"] is [String: Any] {
            audioManager.onContentEnd()
        }
        
        // Handle text output event
        if let textOutput = event["textOutput"] as? [String: Any],
            var content = textOutput["content"] as? String {
            if content.contains("{ \"interrupted\" : true }") {
                audioManager.setBargeIn(true)
                if allowInterruption {
                    content = "\n**[interrupted]**"
                } else {
                    content = ""
                }
            }
            
            if let role = textOutput["role"] as? String {
                print("💬 \(role): \(content)")
                onTranscriptReceived?(role, content)
            } else {
                // Default to ASSISTANT if role is not specified
                print("💬 ASSISTANT: \(content)")
                onTranscriptReceived?("ASSISTANT", content)
            }
        }
        
        // Handle audio output
        if let audioOutput = event["audioOutput"] as? [String: Any],
           let content = audioOutput["content"] as? String {
            
            guard let audioData = Data(base64Encoded: content) else {
                print("❌ NovaSonic: Failed to decode audio content")
                return
            }
            
            // Check if audio data is valid (non-zero)
            if audioData.count > 0 {
                // Send to audio manager
                onAudioReceived?(audioData)
            } else {
                print("⚠️ NovaSonic: Received empty audio data")
            }
        }
    }
    
    // MARK: - Cleanup
    func endSession() async throws {
        guard isActive else {
            return
        }
        
        // Stop microphone capture if active
        if isCapturingAudio {
            audioManager.stopCapturing()
            isCapturingAudio = false
            print("Stopped microphone capture")
        }
        
        // Close input stream if still active
        if inputContinuation != nil {
            // Send prompt end event
            let promptEndEvent = createPromptEndEvent()
            sendEvent(eventJson: promptEndEvent)
            print("Sent prompt end event")
            
            // Send session end event
            let sessionEndEvent = createSessionEndEvent()
            sendEvent(eventJson: sessionEndEvent)
            print("Sent session end event")
            
            // Close input stream
            inputContinuation?.finish()
        }
        
        isActive = false
        onStateChanged?("idle", nil)
    }
}
