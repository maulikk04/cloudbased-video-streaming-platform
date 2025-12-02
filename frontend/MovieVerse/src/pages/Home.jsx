import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { FEATURED_MOVIE } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';
import VideoGallery from "@/components/VideoGallery";

export default function Home() {
  const location = useLocation();
  const { openAuthModal } = useAuth();
  const navigate = useNavigate();

 useEffect(() => {
  if (location.state?.openAuth) {
    openAuthModal();
    window.history.replaceState({}, document.title); 
  }
}, []); // run once


  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden pb-20">
      <Navbar />
      <HeroSection movie={FEATURED_MOVIE} />
      
      <div className="mt-[-150px] relative z-20 bg-gradient-to-t from-background via-background/90 to-transparent pt-20">
        <VideoGallery onPlayVideo={(id) => navigate(`/watch/${id}`)} />
      </div>
    </div>
  );
}
