import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User, PlayCircle, Menu, X, LogOut, Upload, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export function Navbar() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, openAuthModal, logout } = useAuth();
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Browse', path: '/browse' },
    ...(isAuthenticated  ? [{ name: 'My List', path: '/profile' }] : []),
    ...(isAdmin ? [{ name: 'Manage', path: '/admin/manage' }] : []),
  ];

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 w-full z-50 transition-all duration-500 ease-in-out px-6 py-4',
        isScrolled ? 'bg-background/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-[0_0_15px_hsl(var(--primary)/0.5)] group-hover:shadow-[0_0_25px_hsl(var(--primary)/0.8)] transition-all">
            <PlayCircle className="w-6 h-6 fill-white" />
          </div>
          <span className="text-2xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white tracking-wide">
            MOVIEVERSE
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary relative group',
                location.pathname === link.path ? 'text-white' : 'text-muted-foreground'
              )}
            >
              {link.name}
              {location.pathname === link.path && (
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_hsl(var(--primary))] rounded-full" />
              )}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary/50 transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </div>

        {/* Icons & Actions */}
        <div className="hidden md:flex items-center gap-4">
          

          
          {!isAuthenticated ? (
             <div className="flex items-center gap-3">
    {/* Login Modal Trigger */}
    <Button 
      onClick={openAuthModal} 
      variant="neon" 
      size="sm" 
      className="rounded-full px-6"
    >
      Sign In
    </Button>

    {/* Register Page Redirect */}
    <Button 
      onClick={() => navigate('/auth')} 
      variant="neon" 
      size="sm" 
      className="rounded-full px-6 "
    >
      Register
    </Button>
  </div>
             
          ) : (
            <div className="flex items-center gap-4">
              {isAdmin && (
                 <Link to="/admin/upload">
                    <Button variant="outline" size="sm" className="rounded-full gap-2 border-primary/50 text-primary hover:bg-primary hover:text-white">
                        <Upload className="w-4 h-4" /> Upload
                    </Button>
                 </Link>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-white/10 hover:border-primary/50 transition-colors">
                    <Avatar className="h-full w-full">
                       <AvatarImage src={user?.avatar} alt={user?.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {user?.name?.substring(0,2).toUpperCase() || "MV"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-background/95 backdrop-blur-xl border-white/10 text-white" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground capitalize">{user.role} Account</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {isAdmin ? (
                    <>
                       <DropdownMenuItem onClick={() => navigate('/admin/upload')} className="focus:bg-white/10 cursor-pointer">
                         <Upload className="mr-2 h-4 w-4" /> Upload Video
                       </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => navigate('/admin/manage')} className="focus:bg-white/10 cursor-pointer">
                         <Settings className="mr-2 h-4 w-4" /> Manage Content
                       </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="focus:bg-white/10 cursor-pointer">
                      <User className="mr-2 h-4 w-4" /> My Profile
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={logout} className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-background/95 backdrop-blur-xl border-b border-white/10 p-6 animate-accordion-down">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className="text-lg font-medium text-foreground hover:text-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px bg-white/10 my-2" />
            {!isAuthenticated ? (
                <Button onClick={() => {openAuthModal(); setIsMobileMenuOpen(false)}} variant="neon" className="w-full">Sign In</Button>
            ) : (
                <Button onClick={() => {logout(); setIsMobileMenuOpen(false)}} variant="destructive" className="w-full">Log Out</Button>
            )}
          </div>
        </div>
      )}

      
    </nav>
  );
}
