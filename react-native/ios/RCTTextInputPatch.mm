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

@implementation RCTTextInputPatch

static BOOL altKeyPressed = NO;

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
        
        // Add pressesBegan method to RCTBaseTextInputView
        Method pressBegan = class_getInstanceMethod([RCTTextInputPatch class], @selector(pressesBegan:withEvent:));
        IMP pressBeganIMP = method_getImplementation(pressBegan);
        class_addMethod(targetClass, @selector(pressesBegan:withEvent:), pressBeganIMP, method_getTypeEncoding(pressBegan));
        
        // Add pressesEnded method to RCTBaseTextInputView
        Method pressEnded = class_getInstanceMethod([RCTTextInputPatch class], @selector(pressesEnded:withEvent:));
        IMP pressEndedIMP = method_getImplementation(pressEnded);
        class_addMethod(targetClass, @selector(pressesEnded:withEvent:), pressEndedIMP, method_getTypeEncoding(pressEnded));
        
        NSLog(@"🚀 RCTTextInputPatch: Method swizzling completed");
    });
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
    for (UIPress *press in presses) {
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftAlt ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightAlt) {
            altKeyPressed = YES;
        }
    }
}

- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
    for (UIPress *press in presses) {
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftAlt ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightAlt) {
            altKeyPressed = NO;
        }
    }
}

- (BOOL)swizzled_textInputShouldSubmitOnReturn
{
    // Get reference to self as RCTBaseTextInputView
    RCTBaseTextInputView *textInputView = (RCTBaseTextInputView *)self;
    
    if (altKeyPressed) {
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

@end
