//
//  VoiceChatModule.swift
//  SwiftChat
//
//  Created on 2025/4/10.
//

import Foundation
import React

@objc(VoiceChatModule)
class VoiceChatModule: RCTEventEmitter {
    private let conversationManager = ConversationManager()
    private var hasListeners = false
    
    // MARK: - RCTEventEmitter Overrides
    
    override func supportedEvents() -> [String] {
        return [
            "onTranscriptReceived",
            "onError",
            "onAudioLevelChanged"
        ]
    }
    
    override func startObserving() {
        hasListeners = true
    }
    
    override func stopObserving() {
        hasListeners = false
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    // MARK: - Module Methods
    
    @objc(initialize:withResolver:withRejecter:)
    func initialize(_ config: [String: Any],
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock)
    {
        guard let region = config["region"] as? String,
              let accessKey = config["accessKey"] as? String,
              let secretKey = config["secretKey"] as? String
        else {
            reject("INVALID_CONFIG", "Invalid credential provided", nil)
            return
        }
        
        // Get sessionToken (optional)
        let sessionToken = config["sessionToken"] as? String
        
        // Set up callbacks
        setupCallbacks()
        
        // Initialize conversation manager
        Task {
            do {
                try await conversationManager.initialize(
                    region: region,
                    accessKey: accessKey,
                    secretKey: secretKey,
                    sessionToken: sessionToken
                )
                DispatchQueue.main.async {
                    resolve(["success": true])
                }
            } catch {
                DispatchQueue.main.async {
                    reject("INIT_ERROR", "Failed to initialize: \(error)", error)
                }
            }
        }
    }
    
    @objc(startConversation:withVoiceId:withAllowInterruption:withResolver:withRejecter:)
    func startConversation(_ systemPrompt: String,
                           voiceId: String,
                           allowInterruption: Bool,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock)
    {
        Task {
            do {
                try await conversationManager.startConversation(systemPrompt: systemPrompt,
                                                              voiceId: voiceId,
                                                              allowInterruption: allowInterruption)
                DispatchQueue.main.async {
                    resolve(["success": true])
                }
            } catch {
                DispatchQueue.main.async {
                    reject("CONVERSATION_ERROR", "Failed to start conversation: \(error)", error)
                }
            }
        }
    }
    
    
    @objc(endConversation:withRejecter:)
    func endConversation(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock)
    {
        Task {
            do {
                try await conversationManager.endConversation()
                DispatchQueue.main.async {
                    resolve(["success": true])
                }
            } catch {
                DispatchQueue.main.async {
                    reject("CONVERSATION_ERROR", "Failed to end conversation: \(error)", error)
                }
            }
        }
    }
    
    @objc(updateCredentials:withResolver:withRejecter:)
    func updateCredentials(_ config: [String: Any],
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock)
    {
        guard let region = config["region"] as? String,
              let accessKey = config["accessKey"] as? String,
              let secretKey = config["secretKey"] as? String
        else {
            reject("INVALID_CONFIG", "Invalid credential provided", nil)
            return
        }
        
        // Get sessionToken (optional)
        let sessionToken = config["sessionToken"] as? String
        
        // Update credentials
        conversationManager.updateCredentials(
            region: region,
            accessKey: accessKey,
            secretKey: secretKey,
            sessionToken: sessionToken
        )
        
        resolve(["success": true])
    }
    
    // MARK: - Private Methods
    
    private func setupCallbacks() {
        // Handle transcripts
        conversationManager.onTranscriptReceived = { [weak self] role, text in
            guard let self = self, self.hasListeners else { return }
            
            DispatchQueue.main.async {
                self.sendEvent(
                    withName: "onTranscriptReceived",
                    body: [
                        "role": role,
                        "text": text
                    ]
                )
            }
        }
        
        // Handle errors
        conversationManager.onError = { [weak self] error in
            guard let self = self, self.hasListeners else { return }
            
            DispatchQueue.main.async {
                self.sendEvent(
                    withName: "onError",
                    body: [
                        "message": "\(error)"
                    ]
                )
            }
        }
        
        // Handle audio level changes
        conversationManager.onAudioLevelChanged = { [weak self] source, level in
            guard let self = self, self.hasListeners else { return }
            
            DispatchQueue.main.async {
                self.sendEvent(
                    withName: "onAudioLevelChanged",
                    body: [
                        "source": source,
                        "level": level
                    ]
                )
            }
        }
    }
}
