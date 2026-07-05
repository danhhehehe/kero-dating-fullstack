import { useEffect, useState } from "react";
import { assetUrl } from "../lib/assetUrl.js";

const INTRO_KEY = "kero_intro_seen";

export default function IntroSplash() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(INTRO_KEY) !== "1";
    } catch {
      return true;
    }
  });

  function finishIntro() {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // Keep the intro dismissible even if storage is unavailable.
    }
    setVisible(false);
  }

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(finishIntro, 2800);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="intro-splash" role="dialog" aria-label="Kero Dating intro">
      <div className="intro-bg-orb intro-bg-orb-one" />
      <div className="intro-bg-orb intro-bg-orb-two" />

      <div className="intro-logo-stage">
        <div className="intro-ring" />
        <div className="intro-ring intro-ring-soft" />
        <img className="intro-logo" src={assetUrl("intro/logo.png")} alt="Kero Dating" onError={finishIntro} />
        <div className="intro-heart-pulse" />
      </div>

      <div className="intro-copy">
        <h1>Kero Dating</h1>
       
      </div>

      {/* <button type="button" className="intro-skip" onClick={finishIntro}>Bỏ qua</button> */}
    </div>
  );
}
