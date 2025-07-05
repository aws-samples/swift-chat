package com.aws.swiftchat

import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "SwiftChat"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        updateNavigationBarColor()
    }


    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateNavigationBarColor()
    }

    override fun onResume() {
        super.onResume()
        updateNavigationBarColor()
    }

    private fun updateNavigationBarColor() {
        val isDarkMode =
            resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

        runOnUiThread {
            window.navigationBarColor = if (isDarkMode) Color.BLACK else Color.WHITE
            // Force update for all child windows (including modals)
            window.decorView.requestLayout()
        }
    }

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
