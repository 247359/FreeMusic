package com.gy.freemusic

import android.app.Activity
import android.app.Application
import android.media.AudioManager
import android.os.Bundle
import io.dcloud.uniappxv.UniApplication
import uts.sdk.modules.freemusicMediaVolume.UniUTSMethodRegister
import uts.sdk.modules.freemusicComposeShare.UniUTSMethodRegister as ComposeShareRegister
import uts.sdk.modules.freemusicRelease.UniUTSMethodRegister as ReleaseRegister
import uts.sdk.modules.freemusicMedia3.UniUTSMethodRegister as Media3Register
import uts.sdk.modules.freemusicMedia3.Media3Audio

class FreeMusicApplication : UniApplication() {
    override fun onCreate() {
        super.onCreate()
        UniUTSMethodRegister.registerUTSMethod()
        ComposeShareRegister.registerUTSMethod()
        ReleaseRegister.registerUTSMethod()
        Media3Register.registerUTSMethod()
        registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                activity.volumeControlStream = AudioManager.STREAM_MUSIC
                if (activity !is MainActivity) Media3Audio.dispatchPlayerPageRequest()
            }

            override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }
}
