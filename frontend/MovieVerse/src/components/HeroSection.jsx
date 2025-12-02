import React from 'react';
import { motion } from 'framer-motion';
import { Play, Info, Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function HeroSection({ movie }) {
  const { isAuthenticated, openAuthModal } = useAuth();
    const navigate = useNavigate();

   // Inside AuthContext:
// openAuthModal(onSuccessCallback) { ... }

// In HeroSection:
const handlePlay = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      // Pass the desired path to the modal/context
      openAuthModal({ redirectTo: `/watch/${movie.id}` }); 
      return; 
    } 
    navigate(`/watch/${movie.id}`);
};


  return (
    <div className="relative w-full h-[90vh] overflow-hidden">
      {/* Background Image with Parallax-like Scale */}
      <motion.div 
        className="absolute inset-0 w-full h-full"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: "easeOut" }}
      >
        <img 
          src={movie.image} 
          alt={movie.title} 
          className="w-full h-full object-cover"
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
      </motion.div>

      {/* Content */}
      <div className="relative z-30 w-full h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-2xl"
        >
          

          <h1 className="text-5xl md:text-7xl font-heading font-bold text-white mb-6 leading-tight text-glow">
            {movie.title}
          </h1>

          <p className="text-lg text-gray-300 mb-8 leading-relaxed line-clamp-3 text-shadow-sm">
            {movie.description}
          </p>

          <div className="flex items-center gap-4">
          <Button 
          onClick={(e) => {
            console.log('NATIVE BUTTON CLICKED');
            handlePlay(e);
          }}
          className="px-6 py-3 bg-white text-black rounded-md flex items-center gap-2"
        >
          {isAuthenticated ? <Play className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          {isAuthenticated ? 'Play Now' : 'Sign In to Play'}
        </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
