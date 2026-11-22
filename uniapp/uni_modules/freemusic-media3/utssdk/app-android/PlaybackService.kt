package uts.sdk.modules.freemusicMedia3

import android.graphics.Bitmap
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.BitmapLoader
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSourceBitmapLoader
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.extractor.ts.AdtsExtractor
import androidx.media3.session.CacheBitmapLoader
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors

@UnstableApi
class PlaybackService : MediaSessionService() {
    private lateinit var player: ExoPlayer
    private lateinit var session: MediaSession

    override fun onCreate() {
        super.onCreate()
        val extractors = DefaultExtractorsFactory()
            .setAdtsExtractorFlags(AdtsExtractor.FLAG_ENABLE_CONSTANT_BITRATE_SEEKING)
        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(this, extractors))
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        // The application owns the queue. Lock-screen and headset actions use it too.
        val sessionPlayer = object : ForwardingPlayer(player) {
            override fun getAvailableCommands(): Player.Commands =
                super.getAvailableCommands().buildUpon()
                    .addAll(
                        Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                        Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM
                    ).build()

            override fun isCommandAvailable(command: Int) = availableCommands.contains(command)
            override fun seekToNext() = Media3Audio.emit("next")
            override fun seekToNextMediaItem() = seekToNext()
            override fun seekToPrevious() = Media3Audio.emit("prev")
            override fun seekToPreviousMediaItem() = seekToPrevious()
        }
        val coverLoader = CacheBitmapLoader(DataSourceBitmapLoader(this))
        val artworkLoader = object : BitmapLoader by coverLoader {
            override fun loadBitmapFromMetadata(metadata: MediaMetadata): ListenableFuture<Bitmap> {
                val cover = coverLoader.loadBitmapFromMetadata(metadata)
                    ?: return Futures.immediateFuture(PlaceholderArtwork.bitmap)
                return Futures.catching(
                    cover, Exception::class.java, { PlaceholderArtwork.bitmap }, MoreExecutors.directExecutor()
                )
            }
        }
        session = MediaSession.Builder(this, sessionPlayer)
            .setBitmapLoader(artworkLoader)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession = session

    override fun onDestroy() {
        session.release()
        player.release()
        super.onDestroy()
    }
}
