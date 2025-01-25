#import "PlatformModule.h"

@implementation PlatformModule

RCT_EXPORT_MODULE();

- (NSDictionary *)constantsToExport
{
#if TARGET_OS_MACCATALYST
    BOOL isMacCatalyst = YES;
#else
    BOOL isMacCatalyst = NO;
#endif
    
    return @{
        @"isMacCatalyst": @(isMacCatalyst)
    };
}

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end 
