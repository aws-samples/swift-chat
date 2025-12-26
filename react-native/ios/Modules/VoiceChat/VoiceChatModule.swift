//
//  VoiceChatModule.swift
//  SwiftChat
//
//  Created on 2025/4/10.
//

import Foundation
import React

// Wrapper to make RCT callbacks Sendable
struct SendableResolve: @unchecked Sendable {
    let block: RCTPromiseResolveBlock
    func callAsFunction(_ value: Any?) {
        block(value)
    }
}

struct SendableReject: @unchecked Sendable {
    let block: RCTPromiseRejectBlock
    func callAsFunction(_ code: String?, _ message: String?, _ error: Error?) {
        block(code, message, error)
    }
}

@objc(VoiceChatModule)
final class VoiceChatModule: RCTEventEmitter, @unchecked Sendable {
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
              let secretKey = config["secretKey"] as? String,
              let apiKey = config["apiKey"] as? String
        else {
            reject("INVALID_CONFIG", "Invalid credential provided", nil)
            return
        }

        // Get sessionToken (optional)
        let sessionToken = config["sessionToken"] as? String

        // Set up callbacks
        setupCallbacks()

        // Wrap callbacks to make them Sendable
        let safeResolve = SendableResolve(block: resolve)
        let safeReject = SendableReject(block: reject)
        let manager = conversationManager

        Task {
            do {
                try manager.initialize(
                    region: region,
                    accessKey: accessKey,
                    secretKey: secretKey,
                    sessionToken: sessionToken,
                    apiKey: apiKey
                )
                await MainActor.run {
                    safeResolve(["success": true])
                }
            } catch {
                await MainActor.run {
                    safeReject("INIT_ERROR", "Failed to initialize: \(error)", error)
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
        let safeResolve = SendableResolve(block: resolve)
        let safeReject = SendableReject(block: reject)
        let manager = conversationManager

        Task {
            do {
                try await manager.startConversation(systemPrompt: systemPrompt,
                                                    voiceId: voiceId,
                                                    allowInterruption: allowInterruption)
                await MainActor.run {
                    safeResolve(["success": true])
                }
            } catch {
                await MainActor.run {
                    safeReject("CONVERSATION_ERROR", "Failed to start conversation: \(error)", error)
                }
            }
        }
    }


    @objc(endConversation:withRejecter:)
    func endConversation(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock)
    {
        let safeResolve = SendableResolve(block: resolve)
        let safeReject = SendableReject(block: reject)
        let manager = conversationManager

        Task {
            do {
                try await manager.endConversation()
                await MainActor.run {
                    safeResolve(["success": true])
                }
            } catch {
                await MainActor.run {
                    safeReject("CONVERSATION_ERROR", "Failed to end conversation: \(error)", error)
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
              let secretKey = config["secretKey"] as? String,
              let apiKey = config["apiKey"] as? String
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
            sessionToken: sessionToken,
            apiKey: apiKey
        )

        resolve(["success": true])
    }

    // MARK: - Private Methods

    private func setupCallbacks() {
        // Handle transcripts
        conversationManager.onTranscriptReceived = { [weak self] role, text in
            guard let self = self, self.hasListeners else { return }

            DispatchQueue.main.async { [weak self] in
                self?.sendEvent(
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
            let errorMessage = "\(error)"

            DispatchQueue.main.async { [weak self] in
                self?.sendEvent(
                    withName: "onError",
                    body: [
                        "message": errorMessage
                    ]
                )
            }
        }

        // Handle audio level changes
        conversationManager.onAudioLevelChanged = { [weak self] source, level in
            guard let self = self, self.hasListeners else { return }

            DispatchQueue.main.async { [weak self] in
                self?.sendEvent(
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
