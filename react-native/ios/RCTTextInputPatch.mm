#import "RCTTextInputPatch.h"
#import <objc/runtime.h>
#import <objc/message.h>
#import <UIKit/UIKit.h>
#import <React/RCTBaseTextInputView.h>
#import <React/RCTBackedTextInputViewProtocol.h>
#import <React/RCTTextAttributes.h>
#import <React/RCTEventDispatcher.h>
#import <React/RCTTextSelection.h>
#import <React/RCTBridge.h>
#import <React/UIView+React.h>
#import "Modules/FilePaste/FilePasteModule.h"

@implementation RCTTextInputPatch

static BOOL altKeyPressed = NO;
static BOOL commandPressed = NO;
static BOOL shiftPressed = NO;
static IMP originalTextInputShouldChangeTextIMP = NULL;
static IMP originalPressesBegan = NULL;
static IMP originalPressesEnded = NULL;

+ (void)setupTextInputPatch {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class targetClass = [RCTBaseTextInputView class];

        // Swizzle textInputShouldSubmitOnReturn method
        Method originalSubmitMethod = class_getInstanceMethod(targetClass, @selector(textInputShouldSubmitOnReturn));
        Method swizzledSubmitMethod = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_textInputShouldSubmitOnReturn));

        IMP originalSubmitIMP = method_getImplementation(originalSubmitMethod);
        IMP swizzledSubmitIMP = method_getImplementation(swizzledSubmitMethod);

        // Add the swizzled method to RCTBaseTextInputView
        BOOL didAddSubmitMethod = class_addMethod(targetClass, @selector(textInputShouldSubmitOnReturn), swizzledSubmitIMP, method_getTypeEncoding(swizzledSubmitMethod));

        if (didAddSubmitMethod) {
            class_replaceMethod(targetClass, @selector(swizzled_textInputShouldSubmitOnReturn), originalSubmitIMP, method_getTypeEncoding(originalSubmitMethod));
        } else {
            method_exchangeImplementations(originalSubmitMethod, swizzledSubmitMethod);
        }

        // Swizzle textInputShouldChangeText:inRange: method to intercept file paste
        Method originalChangeTextMethod = class_getInstanceMethod(targetClass, @selector(textInputShouldChangeText:inRange:));
        Method swizzledChangeTextMethod = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_textInputShouldChangeText:inRange:));

        if (originalChangeTextMethod && swizzledChangeTextMethod) {
            // Save the original implementation
            originalTextInputShouldChangeTextIMP = method_getImplementation(originalChangeTextMethod);
            IMP swizzledChangeTextIMP = method_getImplementation(swizzledChangeTextMethod);

            // Replace the original method with our swizzled implementation
            method_setImplementation(originalChangeTextMethod, swizzledChangeTextIMP);
        }

        // Add pressesBegan and pressesEnded methods for Alt+Enter functionality
        Method originalPressBeganMethod = class_getInstanceMethod(targetClass, @selector(pressesBegan:withEvent:));
        Method originalPressEndedMethod = class_getInstanceMethod(targetClass, @selector(pressesEnded:withEvent:));

        // Save original implementations if they exist
        if (originalPressBeganMethod) {
            originalPressesBegan = method_getImplementation(originalPressBeganMethod);
        }
        if (originalPressEndedMethod) {
            originalPressesEnded = method_getImplementation(originalPressEndedMethod);
        }

        Method pressBegan = class_getInstanceMethod([RCTTextInputPatch class], @selector(pressesBegan:withEvent:));
        IMP pressBeganIMP = method_getImplementation(pressBegan);
        class_addMethod(targetClass, @selector(pressesBegan:withEvent:), pressBeganIMP, method_getTypeEncoding(pressBegan));

        Method pressEnded = class_getInstanceMethod([RCTTextInputPatch class], @selector(pressesEnded:withEvent:));
        IMP pressEndedIMP = method_getImplementation(pressEnded);
        class_addMethod(targetClass, @selector(pressesEnded:withEvent:), pressEndedIMP, method_getTypeEncoding(pressEnded));

        NSLog(@"🚀 RCTTextInputPatch: Method swizzling completed");
    });
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
    BOOL didHandleEvent = NO;

    for (UIPress *press in presses) {
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftAlt ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightAlt) {
            altKeyPressed = YES;
            didHandleEvent = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftGUI ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightGUI) {
            commandPressed = YES;
            didHandleEvent = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftShift ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightShift) {
            shiftPressed = YES;
            didHandleEvent = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardV) {
            [RCTTextInputPatch copyPasteboardFilesToClipboardDirectoryWithCompletion:^{
                // Send event using the FilePasteModule event emitter
                dispatch_async(dispatch_get_main_queue(), ^{
                    [FilePasteModule sendFilePasteEvent];
                });
            } handleScreenshots:YES];
        }
    }

    if (!didHandleEvent) {
        // If we didn't handle any keys, pass to the original implementation
        if (originalPressesBegan) {
            void (*originalFunc)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *) = (void (*)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *))originalPressesBegan;
            originalFunc(self, @selector(pressesBegan:withEvent:), presses, event);
        }
    }
}

- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
    BOOL didHandleEvent = NO;

    for (UIPress *press in presses) {
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftAlt ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightAlt) {
            altKeyPressed = NO;
            didHandleEvent = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftGUI ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightGUI) {
            commandPressed = NO;
            didHandleEvent = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftShift ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightShift) {
            shiftPressed = NO;
            didHandleEvent = YES;
        }
    }

    if (!didHandleEvent) {
        // If we didn't handle any keys, pass to the original implementation
        if (originalPressesEnded) {
            void (*originalFunc)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *) = (void (*)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *))originalPressesEnded;
            originalFunc(self, @selector(pressesEnded:withEvent:), presses, event);
        }
    }
}

- (BOOL)swizzled_textInputShouldSubmitOnReturn
{
    // Get reference to self as RCTBaseTextInputView
    RCTBaseTextInputView *textInputView = (RCTBaseTextInputView *)self;

    if (altKeyPressed || shiftPressed) {
        // Alt+Enter logic - insert newline

        id<RCTBackedTextInputViewProtocol> backedTextInputView = textInputView.backedTextInputView;

        // Get current selection range
        UITextRange *selectedRange = backedTextInputView.selectedTextRange;
        NSInteger startPosition = [backedTextInputView offsetFromPosition:backedTextInputView.beginningOfDocument
                                                              toPosition:selectedRange.start];
        NSInteger endPosition = [backedTextInputView offsetFromPosition:backedTextInputView.beginningOfDocument
                                                            toPosition:selectedRange.end];

        // Create new text content with newline
        NSMutableAttributedString *currentText = [backedTextInputView.attributedText mutableCopy];

        // Get text attributes from the text input view
        RCTTextAttributes *textAttributes = [textInputView valueForKey:@"_textAttributes"];
        NSDictionary *attributes = textAttributes ? textAttributes.effectiveTextAttributes : @{};

        NSAttributedString *newlineString = [[NSAttributedString alloc]
                                            initWithString:@"\n"
                                            attributes:attributes];

        // Insert newline at current position
        [currentText replaceCharactersInRange:NSMakeRange(startPosition, endPosition - startPosition)
                         withAttributedString:newlineString];

        // Update text
        backedTextInputView.attributedText = currentText;

        // Set cursor position after newline
        UITextPosition *newPosition = [backedTextInputView positionFromPosition:backedTextInputView.beginningOfDocument
                                                                         offset:startPosition + 1];
        [backedTextInputView setSelectedTextRange:[backedTextInputView textRangeFromPosition:newPosition
                                                                                 toPosition:newPosition]
                                   notifyDelegate:YES];

        // Trigger text change event
        [textInputView textInputDidChange];

        // Return NO to prevent submission when Alt is pressed
        return NO;
    } else {
        // Implement the original logic from RCTBaseTextInputView
        NSString *submitBehavior = textInputView.submitBehavior;
        const BOOL shouldSubmit = [submitBehavior isEqualToString:@"blurAndSubmit"] || [submitBehavior isEqualToString:@"submit"];

        if (shouldSubmit) {
            // Get bridge and event dispatcher
            RCTBridge *bridge = [textInputView valueForKey:@"_bridge"];
            NSNumber *reactTag = textInputView.reactTag;  // This is available through UIView+React category
            NSInteger nativeEventCount = textInputView.nativeEventCount;  // This is a public property in RCTBaseTextInputView.h

            if (bridge && bridge.eventDispatcher && reactTag) {
                [bridge.eventDispatcher sendTextEventWithType:RCTTextEventTypeSubmit
                                                      reactTag:reactTag
                                                          text:[textInputView.backedTextInputView.attributedText.string copy]
                                                           key:nil
                                                    eventCount:nativeEventCount];
            }
        }

        return shouldSubmit;
    }
}


- (NSString *)swizzled_textInputShouldChangeText:(NSString *)text inRange:(NSRange)range
{
    // Check if the text being pasted is a file (URL or filename)
    if (text && [RCTTextInputPatch isFilePasteText:text]) {
        // Copy files from pasteboard to clipboard directory, then send event
        [RCTTextInputPatch copyPasteboardFilesToClipboardDirectoryWithCompletion:^{
            // Send event using the FilePasteModule event emitter
            dispatch_async(dispatch_get_main_queue(), ^{
                [FilePasteModule sendFilePasteEvent];
            });
        } handleScreenshots:NO];

        // Return nil to prevent the file URL from being inserted as text
        return nil;
    }

    // Call the original method for normal text input using the saved IMP
    if (originalTextInputShouldChangeTextIMP) {
        // Cast the IMP to the correct function pointer type
        NSString* (*originalFunc)(id, SEL, NSString*, NSRange) = (NSString* (*)(id, SEL, NSString*, NSRange))originalTextInputShouldChangeTextIMP;
        return originalFunc(self, @selector(textInputShouldChangeText:inRange:), text, range);
    }

    // Fallback: return the text as-is if we couldn't call the original method
    return text;
}

+ (void)copyPasteboardFilesToClipboardDirectoryWithCompletion:(void(^)(void))completion handleScreenshots:(BOOL)handleScreenshots
{
    // Capture pasteboard items immediately on main thread
    UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
    NSArray *pasteboardItems = [pasteboard.items copy];

    // Perform file operations on background queue
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        // Get app documents directory
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        NSString *documentsPath = [paths objectAtIndex:0];
        NSString *clipboardPath = [documentsPath stringByAppendingPathComponent:@"clipboard"];

        // Remove entire clipboard directory if it exists
        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSError *error = nil;

        if ([fileManager fileExistsAtPath:clipboardPath]) {
            [fileManager removeItemAtPath:clipboardPath error:&error];
        }

        // Create fresh clipboard directory
        [fileManager createDirectoryAtPath:clipboardPath
               withIntermediateDirectories:YES
                                attributes:nil
                                     error:&error];

        // Copy files from pasteboard
        for (NSInteger index = 0; index < pasteboardItems.count; index++) {
            NSDictionary *item = pasteboardItems[index];
            BOOL itemProcessed = NO;

            // First try to handle image data (for screenshots) - only if handleScreenshots is YES
            if (handleScreenshots) {
                NSData *imageData = nil;
                NSString *imageExtension = @"png";

                // Mac screenshots are always PNG format
                id imageObject = [item objectForKey:@"public.png"];
                if (imageObject) {
                    imageExtension = @"png";
                    // Convert UIImage to NSData if needed
                    if ([imageObject isKindOfClass:[UIImage class]]) {
                        UIImage *image = (UIImage *)imageObject;
                        imageData = UIImagePNGRepresentation(image);
                    } else if ([imageObject isKindOfClass:[NSData class]]) {
                        imageData = (NSData *)imageObject;
                    }
                }

                if (imageData && [imageData isKindOfClass:[NSData class]] && imageData.length > 0) {
                    // Generate filename for screenshot
                    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
                    [formatter setDateFormat:@"yyyy-MM-dd_HH-mm-ss"];
                    NSString *timestamp = [formatter stringFromDate:[NSDate date]];
                    NSString *baseFileName = [NSString stringWithFormat:@"Screenshot_%@", timestamp];

                    // Generate unique filename
                    NSString *destinationFileName = [NSString stringWithFormat:@"%@.%@", baseFileName, imageExtension];
                    NSInteger counter = 1;

                    while ([fileManager fileExistsAtPath:[clipboardPath stringByAppendingPathComponent:destinationFileName]]) {
                        destinationFileName = [NSString stringWithFormat:@"%@_%ld.%@", baseFileName, (long)counter, imageExtension];
                        counter++;
                    }

                    NSString *destinationPath = [clipboardPath stringByAppendingPathComponent:destinationFileName];

                    // Write image data to file
                    NSError *writeError = nil;
                    BOOL success = [imageData writeToFile:destinationPath options:NSDataWritingAtomic error:&writeError];

                    if (success) {
                        itemProcessed = YES;
                    } else {
                        NSLog(@"❌ Failed to save screenshot: %@", writeError.localizedDescription);
                    }
                }
            }

            // If no image data found, try to handle as file URL
            if (!itemProcessed) {
                NSURL *fileURL = nil;

                // Try public.file-url first
                id fileUrlData = [item objectForKey:@"public.file-url"];
                if (fileUrlData) {
                    if ([fileUrlData isKindOfClass:[NSData class]]) {
                        NSString *urlString = [[NSString alloc] initWithData:fileUrlData encoding:NSUTF8StringEncoding];
                        if (urlString) {
                            fileURL = [NSURL URLWithString:urlString];
                        }
                    } else if ([fileUrlData isKindOfClass:[NSString class]]) {
                        fileURL = [NSURL URLWithString:fileUrlData];
                    }
                }

                // Try public.url as fallback
                if (!fileURL) {
                    id urlData = [item objectForKey:@"public.url"];
                    if (urlData) {
                        if ([urlData isKindOfClass:[NSData class]]) {
                            NSString *urlString = [[NSString alloc] initWithData:urlData encoding:NSUTF8StringEncoding];
                            if (urlString) {
                                fileURL = [NSURL URLWithString:urlString];
                            }
                        } else if ([urlData isKindOfClass:[NSString class]]) {
                            fileURL = [NSURL URLWithString:urlData];
                        }
                    }
                }

                // If we have a file URL, copy the file
                if (fileURL && [fileURL isFileURL]) {
                    NSString *sourceFilePath = [fileURL path];
                    NSString *fileName = [sourceFilePath lastPathComponent];

                    // Generate unique filename if file already exists
                    NSString *destinationFileName = fileName;
                    NSInteger counter = 1;
                    NSString *nameWithoutExtension = [fileName stringByDeletingPathExtension];
                    NSString *extension = [fileName pathExtension];

                    while ([fileManager fileExistsAtPath:[clipboardPath stringByAppendingPathComponent:destinationFileName]]) {
                        if (extension.length > 0) {
                            destinationFileName = [NSString stringWithFormat:@"%@_%ld.%@", nameWithoutExtension, (long)counter, extension];
                        } else {
                            destinationFileName = [NSString stringWithFormat:@"%@_%ld", nameWithoutExtension, (long)counter];
                        }
                        counter++;
                    }

                    NSString *destinationPath = [clipboardPath stringByAppendingPathComponent:destinationFileName];

                    // Copy file
                    NSError *copyError = nil;
                    BOOL success = [fileManager copyItemAtPath:sourceFilePath toPath:destinationPath error:&copyError];

                    if (success) {
                        NSLog(@"✅ Successfully copied file: %@", fileName);
                    } else {
                        NSLog(@"❌ Failed to copy file %@: %@", fileName, copyError.localizedDescription);
                    }
                }
            }
        }

        // Call completion callback after all files are processed
        if (completion) {
            completion();
        }
    });
}

+ (BOOL)isFilePasteText:(NSString *)text
{
    // First check if it's a file URL format
    if ([text containsString:@"file:///.file/id="]) {
        return YES;
    }

    // Check if pasteboard contains files and text matches any filename
    UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
    NSArray *items = pasteboard.items;

    for (NSDictionary *item in items) {
        // Check if this item has file URL data
        BOOL hasFileUrl = [item objectForKey:@"public.file-url"] != nil || [item objectForKey:@"public.url"] != nil;

        if (hasFileUrl) {
            // Try to extract filename from file URLs
            NSArray *urlKeys = @[@"public.file-url", @"public.url"];
            for (NSString *key in urlKeys) {
                id urlData = [item objectForKey:key];
                if (urlData) {
                    NSString *urlString = nil;
                    if ([urlData isKindOfClass:[NSData class]]) {
                        urlString = [[NSString alloc] initWithData:urlData encoding:NSUTF8StringEncoding];
                    } else if ([urlData isKindOfClass:[NSString class]]) {
                        urlString = urlData;
                    }

                    if (urlString) {
                        NSURL *fileURL = [NSURL URLWithString:urlString];
                        if (fileURL && [fileURL isFileURL]) {
                            NSString *fileName = [[fileURL path] lastPathComponent];
                            // Check if the pasted text matches the filename
                            if ([text containsString:fileName]) {
                                return YES;
                            }
                        }
                    }
                }
            }
        }
    }

    return NO;
}

@end
