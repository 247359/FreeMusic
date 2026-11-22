package uts.sdk.modules.freemusicMedia3

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import java.util.concurrent.atomic.AtomicBoolean

@UnstableApi
object Media3Audio {
    const val OPEN_PLAYER_ACTION = "freemusic.action.OPEN_PLAYER"
    private val playerPageRequested = AtomicBoolean(false)
    private val main = Handler(Looper.getMainLooper())
    private lateinit var context: Context
    private var listener: ((String, Double, Double) -> Unit)? = null
    private var controller: MediaController? = null
    private var connecting = false
    private val commands = ArrayDeque<(MediaController) -> Unit>()
    private var rate = 1f
    private var ready = false

    fun requestPlayerPage() {
        playerPageRequested.set(true)
    }

    fun dispatchPlayerPageRequest() {
        if (playerPageRequested.get()) listener?.invoke("openplayer", 0.0, 0.0)
    }

    fun takePlayerPageRequest(): Boolean = playerPageRequested.getAndSet(false)

    private val progress = object : Runnable {
        override fun run() {
            val player = controller ?: return
            if (!player.isPlaying) return
            emit("timeupdate")
            main.postDelayed(this, 500)
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_READY -> if (!ready) {
                    ready = true
                    emit("canplay")
                }
                Player.STATE_ENDED -> emit("ended")
            }
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            emit(if (playWhenReady) "play" else "pause")
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            main.removeCallbacks(progress)
            if (isPlaying) main.post(progress)
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) emit("timeupdate")
        }

        override fun onPlayerError(error: PlaybackException) {
            listener?.invoke("error", 0.0, 0.0)
        }
    }

    fun initialize(appContext: Context, callback: (String, Double, Double) -> Unit) {
        main.post {
            context = appContext.applicationContext
            listener = callback
        }
    }

    fun load(url: String, title: String, artist: String, artwork: String, duration: Double) = runWithController { player ->
        ready = false
        val metadata = MediaMetadata.Builder().setTitle(title).setArtist(artist)
        if (duration.isFinite() && duration > 0) {
            metadata.setDurationMs((duration * 1000).toLong())
        }
        if (artwork.isNotBlank()) {
            metadata.setArtworkUri(Uri.parse(artwork))
        } else {
            metadata.setArtworkData(PlaceholderArtwork.png, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
        }
        player.setMediaItem(MediaItem.Builder().setUri(url).setMediaMetadata(metadata.build()).build())
        player.setPlaybackSpeed(rate)
        player.prepare()
        player.play()
    }

    fun control(command: String, value: Double) {
        if (command == "rate") {
            main.post {
                rate = value.toFloat()
                controller?.setPlaybackSpeed(rate)
            }
            return
        }
        runWithController { player ->
            when (command) {
                "play" -> player.play()
                "pause" -> player.pause()
                "stop" -> {
                    main.removeCallbacks(progress)
                    player.stop()
                    player.clearMediaItems()
                    ready = false
                    emit("stop")
                }
                "seek" -> if (player.isCurrentMediaItemSeekable || value == 0.0) {
                    player.seekTo((value * 1000).toLong())
                } else {
                    emit("seekunavailable")
                }
            }
        }
    }

    internal fun emit(event: String) {
        val player = controller
        val position = (player?.currentPosition ?: 0).coerceAtLeast(0) / 1000.0
        val duration = player?.duration?.takeIf { it != C.TIME_UNSET && it > 0 }?.div(1000.0) ?: 0.0
        listener?.invoke(event, position, duration)
    }

    private fun runWithController(command: (MediaController) -> Unit) {
        main.post {
            val player = controller
            if (player != null) {
                command(player)
                return@post
            }
            commands.addLast(command)
            if (connecting) return@post
            connecting = true
            val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
            val future = MediaController.Builder(context, token)
                .setListener(object : MediaController.Listener {
                    override fun onDisconnected(mediaController: MediaController) {
                        if (controller !== mediaController) return
                        controller = null
                        main.removeCallbacks(progress)
                        ready = false
                        emit("stop")
                    }
                })
                .buildAsync()
            future.addListener({
                connecting = false
                val connected = try {
                    future.get()
                } catch (error: Exception) {
                    commands.clear()
                    listener?.invoke("error", 0.0, 0.0)
                    return@addListener
                }
                controller = connected
                connected.addListener(playerListener)
                while (commands.isNotEmpty()) commands.removeFirst()(connected)
            }, { task -> main.post(task) })
        }
    }
}
