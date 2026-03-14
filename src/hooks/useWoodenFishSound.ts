/**
 * useWoodenFishSound
 * 从 敲木鱼.mp4 提取音轨，每次鼠标点击播放一次。
 * 浏览器 Web Audio API 可直接解码 MP4/AAC 音轨，无需 ffmpeg。
 */
import { useEffect, useRef } from "react";
import woodfishUrl from "@/assets/敲木鱼.mp4";

/**
 * 挂载全局鼠标点击监听，每次点击播放木鱼音效。
 * 在顶层组件（App）中调用一次即可。
 */
export function useWoodenFishSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  // 解码后的 AudioBuffer，加载完成后复用
  const bufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // 预加载并解码 MP4 音轨
    fetch(woodfishUrl)
      .then((res) => res.arrayBuffer())
      .then((arr) => ctx.decodeAudioData(arr))
      .then((decoded) => {
        bufferRef.current = decoded;
      })
      .catch((err) => console.warn("[WoodenFish] 音频加载失败", err));

    function handleClick() {
      const buf = bufferRef.current;
      if (!buf) return;

      const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
      resume.then(() => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start();
      });
    }

    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
      ctx.close();
    };
  }, []);
}
