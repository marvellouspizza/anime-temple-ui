/**
 * useBackgroundMusic
 * 循环播放 src/assets/songs/ 中的所有 MP3 背景音乐。
 * 浏览器自动播放策略要求：首次用户交互后才能播放。
 */
import { useEffect, useRef } from "react";

// 使用 Vite glob 导入所有歌曲 URL（保持文件名排序）
const songMap = import.meta.glob<string>("/src/assets/songs/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

const songs: string[] = Object.keys(songMap)
  .sort()
  .map((k) => songMap[k]);

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (songs.length === 0) return;

    const audio = new Audio();
    audio.volume = 0.35;
    audioRef.current = audio;

    function loadSong(index: number) {
      if (!audioRef.current) return;
      indexRef.current = index % songs.length;
      audioRef.current.src = songs[indexRef.current];
      audioRef.current.load();
    }

    function playNext() {
      loadSong(indexRef.current + 1);
      audioRef.current?.play().catch(() => {});
    }

    audio.addEventListener("ended", playNext);
    loadSong(0);

    function startOnInteraction() {
      if (startedRef.current) return;
      startedRef.current = true;
      audio.play().catch(() => {});
      window.removeEventListener("click", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    }

    // 有些浏览器允许自动播放（静音后可解除），先尝试直接播放
    audio.play().then(() => {
      startedRef.current = true;
    }).catch(() => {
      // 被阻止则等待用户交互
      window.addEventListener("click", startOnInteraction);
      window.addEventListener("keydown", startOnInteraction);
    });

    return () => {
      audio.removeEventListener("ended", playNext);
      window.removeEventListener("click", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
      audio.pause();
      audio.src = "";
    };
  }, []);
}
