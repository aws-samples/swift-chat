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
        // 使用我们的JSON提取方法
        encodedResponse = [RCTNetworkingPatch extractSimpleJSONFromData:data];
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

+ (NSString *)extractSimpleJSONFromData:(NSData *)data {
    const uint8_t *bytes = (const uint8_t *)[data bytes];
    NSInteger length = [data length];
    NSMutableArray *jsonStrings = [NSMutableArray array];
    
    NSInteger i = 0;
    while (i < length - 1) {
        if (bytes[i] == '{' && bytes[i+1] == '"') {
            NSInteger startIndex = i;
            NSInteger braceCount = 0;
            BOOL inString = NO;
            BOOL escaped = NO;
            NSInteger endIndex = -1;
            
            for (NSInteger j = startIndex; j < length; j++) {
                uint8_t byte = bytes[j];
                
                if (escaped) {
                    escaped = NO;
                    continue;
                }
                
                if (byte == '\\' && inString) {
                    escaped = YES;
                    continue;
                }
                
                if (byte == '"') {
                    inString = !inString;
                } else if (!inString) {
                    if (byte == '{') {
                        braceCount++;
                    } else if (byte == '}') {
                        braceCount--;
                        if (braceCount == 0) {
                            endIndex = j;
                            break;
                        }
                    }
                }
            }
            
            if (endIndex >= 0) {
                NSData *jsonData = [data subdataWithRange:NSMakeRange(startIndex, endIndex - startIndex + 1)];
                NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
                if (jsonString) {
                    [jsonStrings addObject:jsonString];
                }
                i = endIndex + 1;
            } else {
                i++;
            }
        } else {
            i++;
        }
    }
    
    return [jsonStrings componentsJoinedByString:@"\n\n"];
}

@end