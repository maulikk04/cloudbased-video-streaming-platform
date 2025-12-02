import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoUrl) return;

    let hls;

    // SAFARI – native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = videoUrl;
      video.load();

      video.play().catch((err) => {
        console.warn("Autoplay blocked:", err);
      });
    } 
    // CHROME / FIREFOX / EDGE – use HLS.js
    else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      // auto recover from fatal errors
      hls.on(Hls.Events.ERROR, function (event, data) {
        console.error("HLS error:", data);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("Recovering network error...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Recovering media error...");
              hls.recoverMediaError();
              break;
            default:
              console.log("Cannot recover. Destroying HLS.");
              hls.destroy();
              break;
          }
        }
      });
    }

    // Cleanup
    return () => {
      if (hls) hls.destroy();
    };
  }, [videoUrl]);

  return (
    <div className="w-full h-full bg-black">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted={false}
        crossOrigin="use-credentials"   // <-- REQUIRED for CloudFront Signed Cookies
        className="w-full h-full object-contain bg-black"
      />
    </div>
  );
}
