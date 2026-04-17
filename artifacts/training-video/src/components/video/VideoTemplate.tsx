import { AnimatePresence, motion } from "framer-motion";
import { ComponentType, useEffect, useRef, useState } from "react";
import { useVideoPlayer } from "@/lib/video/hooks";
import narration from "@/narration.json";
import CaptionBar from "@/components/video/CaptionBar";
import Scene1Login from "@/components/video/video_scenes/Scene1Login";
import Scene2Home from "@/components/video/video_scenes/Scene2Home";
import Scene3Categories from "@/components/video/video_scenes/Scene3Categories";
import Scene4Express from "@/components/video/video_scenes/Scene4Express";
import Scene5Clearance from "@/components/video/video_scenes/Scene5Clearance";
import Scene6DFS from "@/components/video/video_scenes/Scene6DFS";
import Scene7Detail from "@/components/video/video_scenes/Scene7Detail";
import Scene8Quote from "@/components/video/video_scenes/Scene8Quote";
import Scene9Outro from "@/components/video/video_scenes/Scene9Outro";

type Manifest = {
  audioFile: string;
  totalDurationMs: number;
  scenes: { id: string; text: string; sceneDurationMs: number; audioStartMs: number; audioEndMs: number }[];
};

const M = narration as Manifest;

const SCENE_DURATIONS = M.scenes.reduce<Record<string, number>>((acc, s) => {
  acc[s.id] = s.sceneDurationMs;
  return acc;
}, {});

const SCENE_COMPONENTS: Record<string, ComponentType<{ tMs: number }>> = {
  login: Scene1Login,
  home: () => <Scene2Home />,
  categories: Scene3Categories,
  express: () => <Scene4Express />,
  clearance: () => <Scene5Clearance />,
  dfs: Scene6DFS,
  detail: Scene7Detail,
  quote: Scene8Quote,
  outro: () => <Scene9Outro />,
};

export default function VideoTemplate() {
  const { currentScene, currentSceneKey } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  const sceneMeta = M.scenes[currentScene];
  const sceneDuration = sceneMeta?.sceneDurationMs ?? 0;
  const SceneComp = SCENE_COMPONENTS[currentSceneKey];

  // Per-scene relative time, used to drive intra-scene animations like cursor
  // ticks and progressive reveals.
  const [tMs, setTMs] = useState(0);
  const startedAtRef = useRef<number>(performance.now());
  useEffect(() => {
    startedAtRef.current = performance.now();
    setTMs(0);
    let raf = 0;
    const tick = () => {
      setTMs(performance.now() - startedAtRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentScene]);

  // Master audio: one file plays continuously across all scenes.
  // We restart it each time the player loops back to scene 0.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (currentScene === 0 && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [currentScene]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-stage-bg">
      <div
        className="relative aspect-video w-full max-w-[1280px] bg-app-bg rounded-md overflow-hidden shadow-2xl"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <AnimatePresence>
          <motion.div
            key={currentScene}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            {SceneComp ? <SceneComp tMs={tMs} /> : null}
          </motion.div>
        </AnimatePresence>

        {/* progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-black/20 z-50 pointer-events-none">
          <motion.div
            key={`p-${currentScene}`}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: sceneDuration / 1000, ease: "linear" }}
            className="h-full bg-amber"
          />
        </div>

        {/* captions */}
        <CaptionBar text={sceneMeta?.text ?? ""} sceneKey={currentScene} />

        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}${M.audioFile}`}
          autoPlay
          preload="auto"
        />
      </div>
    </div>
  );
}
