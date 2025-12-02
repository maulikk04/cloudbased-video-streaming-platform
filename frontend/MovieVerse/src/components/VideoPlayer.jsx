import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoUrl) return;

    console.log("Initializing video playback with URL:", videoUrl);

    let hls;

    // SAFARI – native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      console.log("Using native HLS playback (Safari).");

      video.src = videoUrl;
      video.load();

      video
        .play()
        .then(() => {
          console.log("Native video playback started.");
        })
        .catch((err) => {
          console.warn("Autoplay blocked (Safari native):", err);
        });
    }
    // CHROME / FIREFOX / EDGE – use HLS.js
    else if (Hls.isSupported()) {
      console.log("Using Hls.js for playback.");

      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        // 🔑 MAKE SURE WE NEVER SEND CREDENTIALS
        xhrSetup: (xhr, url) => {
          console.log("Hls.js XHR to:", url);
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("HLS manifest parsed, starting playback…");
        video
          .play()
          .then(() => {
            console.log("Hls.js video playback started.");
          })
          .catch((err) => {
            console.warn("Autoplay blocked (Hls.js):", err);
          });
      });

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
    } else {
      console.error(
        "HLS is not supported in this browser, and no native support either."
      );
    }

    // Cleanup
    return () => {
      if (hls) {
        console.log("Destroying Hls.js instance.");
        hls.destroy();
      }
    };
  }, [videoUrl]);

  return (
    <div className="w-full h-full bg-black">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted={false}
        crossOrigin="anonymous" 
        className="w-full h-full object-contain bg-black"
      />
    </div>
  );
}