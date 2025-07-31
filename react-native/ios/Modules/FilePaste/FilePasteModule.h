//
//  FilePasteModule.h
//  SwiftChat
//
//  Created for handling file paste events
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface FilePasteModule : RCTEventEmitter <RCTBridgeModule>

+ (void)sendFilePasteEvent;

@end