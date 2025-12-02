// src/pages/user/Profile.jsx

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { MovieCard } from "@/components/MovieCard";
import { useMyList } from "@/context/MyListContext";   // ⭐ use global MyList
import { useAuth } from "@/context/AuthContext";

export default function Profile() {
  const { myList, removeFromList } = useMyList();   // ⭐ global synced list
  const { user } = useAuth();
  const [myListMovies, setMyListMovies] = useState([]);

  const API_URL =
    "https://rhcfyb5drj.execute-api.eu-north-1.amazonaws.com/dev/getVideoData";

  useEffect(() => {
    loadMyList();
  }, [myList]);  // ⭐ reload whenever list updates

  const loadMyList = async () => {
    try {
      const res = await fetch(API_URL);
      const allVideos = await res.json();

      const filtered = allVideos.filter((v) => myList.includes(v.id));
      setMyListMovies(filtered);
    } catch (err) {
      console.error("Failed to load videos:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />

      <div className="pt-24 px-8 max-w-7xl mx-auto">
        {/* Profile Header */}
        <h1 className="text-4xl font-heading font-bold mb-8">My Profile</h1>

        {/* User Info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-lg mb-12 shadow-lg">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <h2 className="text-2xl font-bold">{user?.name}</h2>
              <p className="text-muted-foreground capitalize">{user?.role}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* My List Header */}
        <h2 className="text-3xl font-heading font-bold mb-6">My List</h2>

        {/* Empty State */}
        {myListMovies.length === 0 ? (
          <div className="text-muted-foreground text-center py-20">
            You haven’t added any movies yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {myListMovies.map((movie) => (
              <div key={movie.id} className="relative">
                <MovieCard movie={movie} allowRemove={true} />

                {/* ❌ Remove Button (top-right corner) */}
                <button
                  onClick={() => removeFromList(movie.id)}
                  className="absolute top-2 right-2 bg-red-500 rounded-full w-7 h-7 flex items-center justify-center text-white hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
