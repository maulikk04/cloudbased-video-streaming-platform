import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Share2, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ✅ API for fetching video metadata (unchanged)
const VIDEO_DATA_API = import.meta.env.VITE_API_GET_VIDEOS;

// ✅ CloudFront distribution (public HLS)
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN;

export default function Watch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch video metadata from backend
  async function loadVideoData() {
    console.log("STEP: Fetching video metadata…");

    try {
      const res = await fetch(VIDEO_DATA_API);
      if (!res.ok) {
        console.error("❌ Failed to fetch video data:", res.status, res.statusText);
        setLoading(false);
        return;
      }

      const allVideos = await res.json();
      console.log("All videos from API:", allVideos);

      const movie = allVideos.find((v) => v.id.toString() === id);

      if (!movie) {
        console.error("❌ No video found with ID:", id);
      } else {
        console.log("✔ Video metadata loaded:", movie);
        setVideo(movie);
      }
    } catch (err) {
      console.error("❌ Failed to load video metadata:", err);
    }

    setLoading(false);
  }

  // ✅ Run on page load
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    console.log("=============== VIDEO PLAYBACK (NO COOKIES) START ===============");
    loadVideoData().then(() => {
      console.log("=============== VIDEO PLAYBACK (NO COOKIES) END ===============");
    });
  }, [id, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading video...
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <p className="mb-4">Video not found.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  // ✅ Construct streaming URL (directly from CDN)
  const streamUrl = `${CLOUDFRONT_DOMAIN}/processed/${video.id}/master.m3u8`;

  console.log("Final HLS URL:", streamUrl);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-24 left-6 z-50 bg-white/10 hover:bg-white/20 p-3 rounded-full"
      >
        <ArrowLeft size={22} />
      </button>

      {/* VIDEO PLAYER */}
      <div className="w-full h-[70vh] bg-black mt-20">
        <VideoPlayer videoUrl={streamUrl} />
      </div>

      {/* DETAILS SECTION */}
      <div className="p-6 md:p-10 bg-[#0b0b14] border-t border-white/10">
        <h1 className="text-4xl font-bold mb-4">{video.title}</h1>

        <p className="text-gray-300 max-w-3xl mb-6">
          {video.synopsis || "No synopsis available."}
        </p>

        <div className="flex gap-4">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Watchlist
          </Button>

          <Button variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
