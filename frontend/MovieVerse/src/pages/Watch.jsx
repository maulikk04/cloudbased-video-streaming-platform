import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Share2, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import dotenv from "dotenv";


// API for fetching video metadata
dotenv.config();


export default function Watch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_GET_VIDEOS;
  const PLAYBACK_AUTH = import.meta.env.VITE_API_PLAYBACK_AUTH;
  const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN;
  // 1️⃣ Authenticate playback (signed cookies)
  async function authenticatePlayback() {
    console.log("STEP 1: Requesting signed cookies…");

    try {
      const response = await fetch(PLAYBACK_AUTH_API, {
        method: "GET",
        credentials: "include", // required to store CloudFront cookies
      });

      console.log("Playback-auth response:", response);

      // CloudFront cookies NEVER show in JS (HttpOnly), so we test indirectly:
      console.log("document.cookie (sandbox cookies only):", document.cookie);

      // Check if Set-Cookie header is present
      console.log(
        "Headers received (cannot show Set-Cookie due to browser):",
        [...response.headers.entries()]
      );

      if (!response.ok) {
        console.error("❌ playback-auth FAILED:", await response.text());
      } else {
        console.log("✔ playback-auth executed. Cookie should be set.");
      }
    } catch (err) {
      console.error("❌ ERROR contacting playback-auth Lambda:", err);
    }
  }

  // 2️⃣ Fetch video metadata
  async function loadVideoData() {
    console.log("STEP 2: Fetching video metadata…");

    try {
      const res = await fetch(VIDEO_DATA_API);
      const allVideos = await res.json();

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

  // 3️⃣ RUN ON PAGE LOAD
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    async function startPlaybackFlow() {
      console.log("=============== PLAYBACK DIAGNOSTICS START ===============");

      await authenticatePlayback();

      console.log("STEP 1 complete.");
      console.log("Checking cookies again…");
      console.log("document.cookie:", document.cookie);

      await loadVideoData();

      console.log("=============== PLAYBACK DIAGNOSTICS END ===============");
    }

    startPlaybackFlow();
  }, [id, isAuthenticated]);

  if (loading || !video) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading video...
      </div>
    );
  }

  // 4️⃣ Construct streaming URL
  const streamUrl = `${CLOUDFRONT_DOMAIN}/processed/${video.id}/master.m3u8`;

  console.log("Final HLS URL:", streamUrl);
  console.log("Try opening this URL manually:", streamUrl);

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
