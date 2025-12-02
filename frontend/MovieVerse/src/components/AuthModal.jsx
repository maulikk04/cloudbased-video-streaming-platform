import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export function AuthModal() {
  const { showAuthModal, closeAuthModal, login, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    if (!email || !password) return alert("Please enter email and password.");

    try {
      await login(email, password);
      closeAuthModal();
    } catch (err) {
      alert(err.message || "Authentication failed");
    }
  };

  const handleSignUpRedirect = () => {
    closeAuthModal();
    navigate("/auth"); 
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={closeAuthModal}>
      <DialogContent
        className="sm:max-w-md w-full bg-background/95 backdrop-blur-xl border-white/10 text-white
                   shadow-[0_0_50px_hsl(var(--primary)/0.3)] max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <DialogHeader className="text-center space-y-4 pb-2">
          <DialogTitle className="text-3xl font-heading font-bold">
            Welcome Back
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-base">
            Enter your credentials to continue.
          </DialogDescription>
        </DialogHeader>

        {/* ⭐ BODY WRAPPER (Fixes modal pop-up issue) */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4 py-4">

          {/* EMAIL */}
          <div>
            <Label className="text-sm text-gray-300">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                className="mt-1 bg-white/5 border-white/10 text-white pl-10"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <Label className="text-sm text-gray-300">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                className="mt-1 bg-white/5 border-white/10 text-white pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="pt-4 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={handleSignUpRedirect}
                className="text-primary hover:text-primary/80 font-bold hover:underline"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-background/90 backdrop-blur-md border-t border-white/10 px-6 py-4 flex justify-between gap-3">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 rounded-full"
            onClick={closeAuthModal}
          >
            Cancel
          </Button>

          <Button
            className="bg-primary text-white hover:bg-primary/80 rounded-full"
            onClick={handleSignIn}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

