//
//  ConversationManager.swift
//  SwiftChat
//
//  Created on 2025/4/10.
//

import Foundation

class ConversationManager {
    // Services
    private var audioManager: AudioManager!
    private var novaSonicService: NovaSonicService?
    
    // State
    private var isInitialized = false
    private var currentAudioURL: URL?
    
    // Callbacks
    var onTranscriptReceived: ((String, String) -> Void)?
    var onError: ((Error) -> Void)?
    var onAudioLevelChanged: ((String, Int) -> Void)? // Callback for audio level changes
    
    // MARK: - Initialization
    
    func updateCredentials(region: String, accessKey: String, secretKey: String, sessionToken: String? = nil) {
        novaSonicService?.updateCredentials(accessKey: accessKey, secretKey: secretKey, sessionToken: sessionToken)
    }
    
    func initialize(region: String, accessKey: String, secretKey: String, sessionToken: String? = nil) async throws {
        guard !isInitialized else { return }
        // Initialize NovaSonic service
        novaSonicService = NovaSonicService(region: region, accessKey: accessKey, secretKey: secretKey, sessionToken: sessionToken)
        audioManager = novaSonicService?.audioManager
        // Set up callbacks
        setupCallbacks()
        
        isInitialized = true
    }
    
    private func setupCallbacks() {
        audioManager.onError = { [weak self] error in
            self?.handleError(error)
        }
        
        // Set up audio level callback
        audioManager.onAudioLevelChanged = { [weak self] source, level in
            self?.onAudioLevelChanged?(source, level)
        }
        
        novaSonicService?.onTranscriptReceived = { [weak self] role, text in
            self?.onTranscriptReceived?(role, text)
        }
        
        novaSonicService?.onAudioReceived = { [weak self] audioData in
            self?.handleAudioReceived(audioData)
        }
        
        novaSonicService?.onError = { [weak self] error in
            self?.handleError(error)
        }
    }
    
    // MARK: - Conversation Management
    
    func startConversation(systemPrompt: String, voiceId: String, allowInterruption: Bool) async throws {
        guard isInitialized, let novaSonicService = novaSonicService else {
            throw NSError(domain: "ConversationError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Service not initialized"])
        }
        
        do {
            // Start session with system prompt and voice ID
            try await novaSonicService.startSession(systemPrompt: systemPrompt, voiceId: voiceId, allowInterruption: allowInterruption)
            // Automatically start listening
        } catch {
            print("❌ Start Conversation error", error)
            handleError(error)
            throw error
        }
    }
    
    func endConversation() async throws {
        guard isInitialized, let novaSonicService = novaSonicService else {
            return
        }
        print("start endConversation")
        do {
            // Stop any ongoing audio playback
            audioManager.stopPlayback()
        
            // Stop microphone capture
            try await novaSonicService.endAudioInput()
          
            // Send end session events
            try await novaSonicService.endSession()
          
            // Deactivate audio session
            try audioManager.deactivateAudioSession()
        } catch {
            print("❌ End Conversation error", error)
            handleError(error)
            throw error
        }
    }
    
    // MARK: - Event Handlers
    private func handleAudioReceived(_ audioData: Data) {
        do {
            try audioManager.playAudio(data: audioData)
        } catch {
            print("❌ Error playing audio in AudioManager: \(error)")
            handleError(error)
        }
    }
    
    private func handleError(_ error: Error) {
        onError?(error)
    }
}
