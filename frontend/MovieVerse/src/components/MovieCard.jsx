import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Plus, Check, Lock, ThumbsUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMyList } from "@/context/MyListContext";

export function MovieCard({ movie, layout = "vertical", allowRemove = false, onRemove, forceUpdateKey }) {

  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const { myList, addToList, removeFromList } = useMyList();
  const isAdded = myList.includes(movie.id);
  // Load from localStorage
  

  // ⭐ Add movie locally
  
  const handlePlay = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return openAuthModal();
    navigate(`/watch/${movie.id}`);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative group rounded-lg overflow-hidden cursor-pointer bg-card border border-white/5 w-[220px] h-[330px]"
      )}
      onClick={() => navigate(`/watch/${movie.id}`)}
    >
      <img
        src={movie.thumbnailUrl}
        alt={movie.title}
        className="w-full h-full object-cover group-hover:brightness-75"
      />

      {/* Hover UI */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition p-4 flex flex-col justify-end">

        <div className="flex items-center gap-2 mb-2">

          {/* Play Button */}
          <button
            onClick={handlePlay}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110"
          >
            {isAuthenticated ? <Play size={16} /> : <Lock size={16} />}
          </button>

          {/* Add or Remove */}
          <button
  onClick={(e) => {
    e.stopPropagation();
    isAdded ? removeFromList(movie.id) : addToList(movie.id);
  }}
  className={`w-8 h-8 rounded-full flex items-center justify-center ${
    isAdded ? "bg-primary text-white" : "border border-white text-white"
  }`}
>
  {isAdded ? "✓" : <Plus size={16} />}
</button>


        </div>

        <h3 className="text-white font-bold text-lg">{movie.title}</h3>
      </div>
    </motion.div>
  );
}
