import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { MovieCard } from '@/components/MovieCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from "react-router-dom";

export default function Browse() {
  const [videos, setVideos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const API_URL = "https://rhcfyb5drj.execute-api.eu-north-1.amazonaws.com/dev/getVideoData";

  // Fetch Videos
  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      console.log("BROWSE VIDEOS:", data);

      setVideos(data);
      setFiltered(data); // Default view
    } catch (error) {
      console.error("Browse page API error:", error);
    }
  };

  // Search Filter
  useEffect(() => {
    const results = videos.filter((video) =>
      video.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFiltered(results);
  }, [searchQuery, videos]);

  return (
    <div className="min-h-screen bg-background pt-24 px-6 md:px-12 pb-20">
      <Navbar />

      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <h1 className="text-4xl font-heading font-bold text-white">Browse Movies</h1>

          {/* Search + Filters */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search titles..."
                className="pl-9 bg-white/5 border-white/10 focus:border-primary text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button variant="outline" className="gap-2 border-white/10 bg-white/5 hover:bg-white/10">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </Button>
          </div>
        </div>

        {/* Movie Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filtered.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            No movies found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
