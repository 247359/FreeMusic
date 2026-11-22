#!/usr/bin/env bash
# FreeMusic Android APK 一键构建脚本
# 在仓库根目录运行：bash android/scripts/build-apk.sh
# 产物：output/FreeMusic-<abi>-debug.apk

set -e

PROJECT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ANDROID_PROJ="$PROJECT/android"
OUTPUT="$PROJECT/output"

# Wrapper 从 JAVA_HOME 或 PATH 查找 JDK；AGP 从本机 SDK 配置中查找 Android SDK。
cd "$ANDROID_PROJ"

variant=debug
task=assembleDebug
if [ "${RELEASE:-0}" = 1 ]; then
  test -f "$PROJECT/.signing/release.properties" || { echo "Release signing configuration is missing." >&2; exit 1; }
  variant=release
  task=assembleRelease
  OUTPUT="$PROJECT/release"
fi
APK_SRC="$ANDROID_PROJ/app/build/outputs/apk/$variant/app-$variant.apk"
mkdir -p "$OUTPUT"
abis=(arm64-v8a armeabi-v7a x86_64)
if [ -n "${ANDROID_ABI:-}" ]; then
  abis=("$ANDROID_ABI")
fi

for abi in "${abis[@]}"; do
  ./gradlew ":app:$task" "-Pfreemusic.abi=$abi" --console=plain "$@"
  target="$OUTPUT/FreeMusic-$abi-debug.apk"
  if [ "$variant" = release ]; then
    target="$OUTPUT/FreeMusic-$abi.apk"
  fi
  cp "$APK_SRC" "$target"
  echo "APK: $target"
done
