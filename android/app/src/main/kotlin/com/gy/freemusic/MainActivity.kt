package com.gy.freemusic

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import io.dcloud.uniappxv.UniAppActivity

/**
 * 启动入口：直接进入 uni-app x 应用（FreeMusic），不显示官方示例的中间按钮页。
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, UniAppActivity::class.java))
        finish()
    }
}
