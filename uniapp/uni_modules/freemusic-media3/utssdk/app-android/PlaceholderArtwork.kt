package uts.sdk.modules.freemusicMedia3

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import java.io.ByteArrayOutputStream

internal object PlaceholderArtwork {
    val bitmap: Bitmap by lazy {
        Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888).apply {
            eraseColor(Color.rgb(245, 245, 247))
            val canvas = Canvas(this)
            canvas.translate(64f, 64f)
            canvas.scale(128f / 24, 128f / 24)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.rgb(115, 142, 241)
                style = Paint.Style.STROKE
                strokeWidth = 1.8f
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
            val note = Path().apply {
                moveTo(9f, 17f)
                lineTo(9f, 6f)
                lineTo(19f, 4f)
                lineTo(19f, 15f)
                moveTo(9f, 9f)
                lineTo(19f, 7f)
                moveTo(9f, 17f)
                rCubicTo(0f, 2.5f, -5f, 3.5f, -5f, 1f)
                rCubicTo(0f, -2.5f, 5f, -3.5f, 5f, -1f)
                close()
                moveTo(19f, 15f)
                rCubicTo(0f, 2.5f, -5f, 3.5f, -5f, 1f)
                rCubicTo(0f, -2.5f, 5f, -3.5f, 5f, -1f)
                close()
            }
            canvas.drawPath(note, paint)
        }
    }

    val png: ByteArray by lazy {
        ByteArrayOutputStream().use { output ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            output.toByteArray()
        }
    }
}
