#import "AppDelegate.h"
#import "RCTNetworkingPatch.h"
#import "RCTTextInputPatch.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <React/RCTBridge.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // setup Networking Patch for bedrock chunk parse
  [RCTNetworkingPatch setupNetworkingPatch];
  
#if TARGET_OS_MACCATALYST
  // setup Text Input Patch for Alt+Enter newline functionality
  [RCTTextInputPatch setupTextInputPatch];
#endif
  

  self.moduleName = @"SwiftChat";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // For scene-based architecture, we don't call super here to avoid window conflicts
  // The window will be created in SceneDelegate instead
  return YES;
}

// MARK: UISceneSession Lifecycle

- (UISceneConfiguration *)application:(UIApplication *)application configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession options:(UISceneConnectionOptions *)options API_AVAILABLE(ios(13.0)) {
    // Called when a new scene session is being created.
    // Use this method to select a configuration to create the new scene with.
    return [[UISceneConfiguration alloc] initWithName:@"Default Configuration" sessionRole:connectingSceneSession.role];
}

- (void)application:(UIApplication *)application didDiscardSceneSessions:(NSSet<UISceneSession *> *)sceneSessions API_AVAILABLE(ios(13.0)) {
    // Called when the user discards a scene session.
    // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
    // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
}

// Method to create root view controller for scene-based architecture
- (UIViewController *)createRootViewController
{
  // Create React Native root view
  RCTBridge *bridge = [self createBridgeWithDelegate:self launchOptions:{}];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:self.moduleName initialProperties:self.initialProps];
  
  // Configure root view appearance
  if (@available(iOS 13.0, *)) {
    rootView.backgroundColor = [UIColor systemBackgroundColor];
  } else {
    rootView.backgroundColor = [UIColor whiteColor];
  }
  
  // Create and configure view controller
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  
  return rootViewController;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
