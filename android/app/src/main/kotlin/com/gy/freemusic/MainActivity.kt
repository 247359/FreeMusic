package com.gy.freemusic

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import io.dcloud.uniappxv.UniAppActivity
import uts.sdk.modules.freemusicMedia3.Media3Audio

/**
 * 启动入口：直接进入 uni-app x 应用（FreeMusic），不显示官方示例的中间按钮页。
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent.action == Media3Audio.OPEN_PLAYER_ACTION) {
            Media3Audio.requestPlayerPage()
            if (!isTaskRoot) {
                finish()
                return
            }
        }
        startActivity(Intent(this, UniAppActivity::class.java))
        finish()
    }
}
