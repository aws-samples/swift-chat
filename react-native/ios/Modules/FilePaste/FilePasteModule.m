//
//  FilePasteModule.m
//  SwiftChat
//
//  Created for handling file paste events
//

#import "FilePasteModule.h"

@implementation FilePasteModule

RCT_EXPORT_MODULE();

static FilePasteModule *sharedInstance = nil;

- (instancetype)init {
    if (self = [super init]) {
        sharedInstance = self;
    }
    return self;
}

+ (instancetype)sharedInstance {
    return sharedInstance;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[@"onPasteFiles"];
}

+ (void)sendFilePasteEvent
{
    FilePasteModule *instance = [FilePasteModule sharedInstance];
    if (instance) {
        [instance sendEventWithName:@"onPasteFiles" body:@{}];
    }
}

@end
