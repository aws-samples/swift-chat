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

    NSString *buildNumber = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];

    return @{
        @"isMacCatalyst": @(isMacCatalyst),
        @"buildNumber": buildNumber ?: @""
    };
}

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end 
