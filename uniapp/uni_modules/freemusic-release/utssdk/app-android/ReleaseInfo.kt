package uts.sdk.modules.freemusicRelease

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import org.json.JSONObject

object ReleaseInfo {
    fun read(context: Context): String {
        val manager = context.packageManager
        val name = context.packageName
        val metadata = manager.getApplicationInfo(name, PackageManager.GET_META_DATA).metaData
        return JSONObject()
            .put("abi", metadata?.getString("com.gy.freemusic.ABI").orEmpty())
            .put("repository", metadata?.getString("com.gy.freemusic.GITHUB_REPOSITORY").orEmpty())
            .put("version", manager.getPackageInfo(name, 0).versionName.orEmpty())
            .toString()
    }

    fun open(activity: Activity, url: String): Boolean {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" || uri.host != "github.com") return false
        return try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: RuntimeException) {
            false
        }
    }
}
