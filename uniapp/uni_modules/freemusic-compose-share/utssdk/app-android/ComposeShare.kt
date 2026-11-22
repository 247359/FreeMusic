package uts.sdk.modules.freemusicComposeShare

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException

class ComposeFileProvider : FileProvider()

object ComposeShare {
    fun copyText(context: Context, text: String): Boolean {
        val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return false
        clipboard.setPrimaryClip(ClipData.newPlainText("compose.yml", text))
        return true
    }

    fun shareFile(activity: Activity, text: String): Boolean {
        return try {
            val directory = File(activity.cacheDir, "compose-share")
            val file = File(directory, "compose.yml")
            directory.mkdirs()
            file.writeText(text, Charsets.UTF_8)
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.composefiles", file)
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "application/yaml"
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newUri(activity.contentResolver, "compose.yml", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(Intent.createChooser(share, "分享 compose.yml"))
            true
        } catch (error: IOException) {
            Log.w("FreeMusicCompose", "Could not write Compose file", error)
            false
        } catch (error: RuntimeException) {
            Log.w("FreeMusicCompose", "Could not open Compose share sheet", error)
            false
        }
    }
}
