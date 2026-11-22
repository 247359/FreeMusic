package com.gy.freemusic

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.util.Log
import io.dcloud.uniappxv.UniApplication
import uts.sdk.modules.DCloudUniGetBackgroundAudioManager.AudioService
import uts.sdk.modules.freemusicMediaVolume.UniUTSMethodRegister
import uts.sdk.modules.freemusicComposeShare.UniUTSMethodRegister as ComposeShareRegister
import uts.sdk.modules.freemusicRelease.UniUTSMethodRegister as ReleaseRegister

class FreeMusicApplication : UniApplication() {
    override fun onCreate() {
        super.onCreate()
        UniUTSMethodRegister.registerUTSMethod()
        ComposeShareRegister.registerUTSMethod()
        ReleaseRegister.registerUTSMethod()
        registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                activity.volumeControlStream = AudioManager.STREAM_MUSIC
                // The SDK player retains its service-start flag after Android removes the service.
                if (AudioService.audioService == null) {
                    try {
                        activity.startService(Intent(activity, AudioService::class.java))
                    } catch (error: IllegalStateException) {
                        Log.w("FreeMusicAudio", "Audio service could not be restored while resuming", error)
                    }
                }
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
