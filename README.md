# FreeMusic

FreeMusic 是一款连接自建 Navidrome 曲库的 Android 音乐播放器。通过 Navidrome 账户访问歌曲、封面、歌词和歌单。

| 功能 | 说明 |
| --- | --- |
| 浏览与搜索 | 查看每日推荐、最近播放、流派、歌手、专辑与全部歌曲，按歌曲、歌手、专辑或歌单搜索。 |
| 播放控制 | 支持后台播放、通知栏控制、进度定位、媒体音量、倍速和睡眠定时。 |
| 播放队列 | 可加入下一首或队尾，调整顺序，并使用顺序、随机和循环播放。 |
| 歌词 | 有时间戳的歌词可同步滚动、拖动定位，也可单独调整每首歌的歌词偏移。 |
| 歌单与收藏 | 创建和管理 Navidrome 歌单，收藏、评分及批量加入歌单或待播队列。 |
| 外观 | 支持浅色、深色和跟随系统主题。 |

## 安装与连接

在 [GitHub Releases](https://github.com/247359/FreeMusic/releases) 下载对应设备架构的 APK。首次打开后，填写 Navidrome 服务地址和账号。还没有服务，可以在应用的「设置 → Navidrome 部署教程」查看、复制或分享 Compose 配置。

## 本地构建

1. 安装 **JDK 17、Android SDK 36、HBuilderX 5.34.2026102909**。设置 `JAVA_HOME`，通过 `ANDROID_HOME` 或 Android Studio 配置 Android SDK。
2. 安装 Git LFS 后克隆仓库，在仓库根目录执行 `git lfs pull`。
3. 在 HBuilderX 打开 `uniapp/`，选择 **发行 → 原生 App 本地打包 → 生成本地打包 App 资源**。回到仓库根目录运行以下命令（Windows 可用 Git Bash）：

   ```sh
   bash android/scripts/build-apk.sh
   ```

调试 APK 输出在 `output/`，使用 Android 默认调试签名。若只需一个架构，可在命令前加 `ANDROID_ABI=arm64-v8a`。

| 架构 | 验证覆盖 |
| --- | --- |
| `arm64-v8a` | Android 真机验证了安装、连接、搜索和播放。 |
| `armeabi-v7a` | 在支持 32 位应用的同一台真机验证了安装和播放。 |
| `x86_64` | 模拟器验证了安装和播放，暂无实体设备测试。 |

[DCloud 蒸汽模式不支持 32 位 x86](https://doc.dcloud.net.cn/uni-app-x/collocation/manifest-android.html)。

## 目录

- `uniapp/`：页面、播放逻辑和 UTS 插件。
- `android/`：原生工程和构建脚本。
- `docker-compose.yml`：Navidrome 部署模板。

## 致谢

- [YesPlayMusic](https://github.com/qier222/YesPlayMusic) · 播放器交互与界面参考。
- [Navidrome](https://github.com/navidrome/navidrome) · 音乐服务与 Subsonic API。

## 许可

FreeMusic 原创代码采用 [MIT 许可证](LICENSE)。Gradle Wrapper、DCloud SDK 和其他第三方组件遵循各自的许可证。
