import React, { useEffect, useState, useRef } from "react";
import { MovieCard } from "@/components/MovieCard";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function VideoGallery() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_GET_VIDEOS;

  const rowRefs = useRef([]); // for horizontal scroll per section

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      console.log("VIDEOS FROM API:", data);
      setVideos(data);
    } catch (error) {
      console.error("Error fetching videos:", error);
    }
    setLoading(false);
  };

  const scrollRow = (index, direction) => {
    const row = rowRefs.current[index];
    if (!row) return;

    const scrollAmount = 320; // width of 1.5 cards
    row.scrollBy({
      left: direction === "right" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  if (loading) return <p className="p-6">Loading...</p>;

  // -------------------------------
  // SECTION LOGIC
  // -------------------------------

  const featuredVideos = videos.slice(0, 10);

  const newestVideos = [...videos]
    .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
    .slice(0, 10);

  const topLikedVideos = [...videos]
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 10);

  // Reusable section renderer
  const renderSection = (title, items, index) => (
    <div className="mb-12 relative px-6">
      {/* Section Title */}
      <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>

      {/* Arrow Buttons */}
      <button
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 z-10 rounded-full"
        onClick={() => scrollRow(index, "left")}
      >
        <ArrowLeft />
      </button>

      <button
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 z-10 rounded-full"
        onClick={() => scrollRow(index, "right")}
      >
        <ArrowRight />
      </button>

      {/* Horizontal Scrollable Row */}
      <div
        ref={(el) => (rowRefs.current[index] = el)}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 pt-2"
      >
        {items.map((movie) => (
          <div
            key={movie.id}
            className="flex-none w-[220px] snap-start"
            onClick={() => navigate(`/watch/${video.id}`)}
          >
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pt-10 pb-10">
      {renderSection("🎬 Featured Videos", featuredVideos, 0)}

      {renderSection("🆕 Newest Uploads", newestVideos, 1)}

      {renderSection("🔥 Top Liked Videos", topLikedVideos, 2)}
    </div>
  );
}
