//
//  ConversationManager.swift
//  SwiftChat
//
//  Created on 2025/4/10.
//

import Foundation

enum ConversationState: String {
  case idle
  case listening
  case processing
  case speaking
  case error
}

class ConversationManager {
  // Services
  private var audioManager: AudioManager!
  private var novaSonicService: NovaSonicService?
    
  // State
  private var state: ConversationState = .idle
  private var isInitialized = false
  private var isSessionActive = false
  private var currentAudioURL: URL?
    
  // Callbacks
  var onStateChanged: ((ConversationState, String?) -> Void)?
  var onTranscriptReceived: ((String, String) -> Void)?
  var onError: ((Error) -> Void)?
  var onAudioLevelChanged: ((String, Int) -> Void)? // Callback for audio level changes
    
  // MARK: - Initialization
    
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
    // Audio manager callbacks
    audioManager.onRecordingStateChanged = { [weak self] isRecording in
      if !isRecording {
        self?.handleRecordingStopped()
      }
    }
        
    audioManager.onPlaybackStateChanged = { [weak self] isPlaying in
      if !isPlaying {
        self?.updateState(.idle)
      }
    }
        
    audioManager.onError = { [weak self] error in
      self?.handleError(error)
    }
    
    // Set up audio level callback
    audioManager.onAudioLevelChanged = { [weak self] source, level in
      self?.onAudioLevelChanged?(source, level)
    }
        
    // NovaSonic service callbacks
    novaSonicService?.onStateChanged = { [weak self] stateString, errorMessage in
      switch stateString {
      case "idle":
        self?.updateState(.idle)
      case "listening":
        self?.updateState(.listening)
      case "processing":
        self?.updateState(.processing)
      case "speaking":
        self?.updateState(.speaking)
      case "error":
        self?.updateState(.error)
        if let errorMessage = errorMessage {
          self?.onError?(NSError(domain: "NovaSonicError", code: -1, userInfo: [NSLocalizedDescriptionKey: errorMessage]))
          Task{
            try await self?.endConversation()
          }
        }
      default:
        break
      }
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
      print("after startSession")
      isSessionActive = true
      
      // Automatically start listening
      updateState(.listening)
    } catch {
      print("startConversation error", error)
      handleError(error)
      throw error
    }
  }
    
  func endConversation() async throws {
    guard isInitialized, isSessionActive, let novaSonicService = novaSonicService else {
      return
    }
        
    do {
      // Stop any ongoing audio operations
      audioManager.stopPlayback()
      // Make sure to stop listening if we're currently listening
      try await novaSonicService.endAudioInput()
            
      // End session
      try await novaSonicService.endSession()
      isSessionActive = false
            
      // Deactivate audio session
      try audioManager.deactivateAudioSession()
            
      updateState(.idle)
    } catch {
      handleError(error)
      throw error
    }
  }
    
  // MARK: - Event Handlers
  private func handleRecordingStopped() {
    updateState(.processing)
  }
    
  private func handleAudioReceived(_ audioData: Data) {
    do {
      try audioManager.playAudio(data: audioData)
    } catch {
      print("❌ Error playing audio in AudioManager: \(error.localizedDescription)")
      handleError(error)
    }
  }
    
  private func handleError(_ error: Error) {
    print("❌ ConversationManager error: \(error.localizedDescription)")
    updateState(.error)
    onError?(error)
  }
    
  private func updateState(_ newState: ConversationState) {
    print("🔄 ConversationManager state changed: \(state.rawValue) -> \(newState.rawValue)")
    state = newState
    onStateChanged?(newState, nil)
  }
}
