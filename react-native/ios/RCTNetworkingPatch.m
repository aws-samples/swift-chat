#import "RCTNetworkingPatch.h"
#import <objc/runtime.h>
#import <React/RCTNetworking.h>

@implementation RCTNetworkingPatch

+ (void)setupNetworkingPatch {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class networkingClass = NSClassFromString(@"RCTNetworking");
        if (networkingClass) {
            Method originalMethod = class_getClassMethod(networkingClass, @selector(decodeTextData:fromResponse:withCarryData:));
            Method swizzledMethod = class_getClassMethod([self class], @selector(swizzled_decodeTextData:fromResponse:withCarryData:));
            
            if (originalMethod && swizzledMethod) {
                method_exchangeImplementations(originalMethod, swizzledMethod);
            }
        }
    });
}

+ (NSString *)swizzled_decodeTextData:(NSData *)data
                         fromResponse:(NSURLResponse *)response
                        withCarryData:(NSMutableData *)inputCarryData
{
    NSStringEncoding encoding = NSUTF8StringEncoding;
    if (response.textEncodingName) {
        CFStringEncoding cfEncoding = CFStringConvertIANACharSetNameToEncoding((CFStringRef)response.textEncodingName);
        encoding = CFStringConvertEncodingToNSStringEncoding(cfEncoding);
    }

    NSMutableData *currentCarryData = inputCarryData ?: [NSMutableData new];
    [currentCarryData appendData:data];

    // Attempt to decode text
    NSString *encodedResponse = [[NSString alloc] initWithData:currentCarryData encoding:encoding];

    if (!encodedResponse && data.length > 0) {
        encodedResponse = [RCTNetworkingPatch extractPayloadFromEventStream:data];
    }

    if (inputCarryData) {
        NSUInteger encodedResponseLength = [encodedResponse dataUsingEncoding:encoding].length;

        // Ensure a valid subrange exists within currentCarryData
        if (currentCarryData.length >= encodedResponseLength) {
            NSData *newCarryData = [currentCarryData
                subdataWithRange:NSMakeRange(encodedResponseLength, currentCarryData.length - encodedResponseLength)];
            [inputCarryData setData:newCarryData];
        } else {
            [inputCarryData setLength:0];
        }
    }

    return encodedResponse;
}

+ (NSString *)extractPayloadFromEventStream:(NSData *)data {
    NSMutableArray *payloads = [NSMutableArray array];
    const uint8_t *bytes = (const uint8_t *)[data bytes];
    NSInteger dataLen = [data length];
    NSInteger pos = 0;
    
    while (pos + 12 <= dataLen && pos >= 0) {
        uint32_t totalLength = CFSwapInt32BigToHost(*(uint32_t*)(bytes + pos));
        uint32_t headersLength = CFSwapInt32BigToHost(*(uint32_t*)(bytes + pos + 4));
        
        if (pos + totalLength > dataLen) {
            break;
        }
        
        NSInteger payloadStart = pos + 12 + headersLength;
        NSInteger payloadEnd = pos + totalLength - 4;
        
        if (payloadStart > 0 && payloadStart < payloadEnd && payloadEnd <= dataLen) {
            NSData *payloadData = [data subdataWithRange:NSMakeRange(payloadStart, payloadEnd - payloadStart)];
            NSString *payloadStr = [[NSString alloc] initWithData:payloadData encoding:NSUTF8StringEncoding];
            
            if (payloadStr) {
                [payloads addObject:payloadStr];
            }
        }
        
        pos += totalLength;
    }
    
    return [payloads componentsJoinedByString:@"\n\n"];
}

@end
