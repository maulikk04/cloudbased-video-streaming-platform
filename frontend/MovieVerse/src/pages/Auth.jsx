import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayCircle, Mail, Lock, User, ArrowRight, Popcorn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Auth() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  const { openAuthModal,signup, loading, user } = useAuth();
  const navigate = useNavigate();

  // --------------------------------------------------------------------------
  // Registration Handler
  // --------------------------------------------------------------------------
  const handleRegister = async () => {
    if (!name || !email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      await signup(name, email, password, role);
      toast.success("Account created!");
      navigate("/"); // Redirect to home
    } catch (err) {
      toast.error(err.message || "Registration failed");
    }
  };

  // --------------------------------------------------------------------------
  // If user is already logged in, redirect
  // --------------------------------------------------------------------------
  if (!loading && user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1601042879364-f3947d3f9c16')] bg-cover bg-center opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] -top-20 -left-20 animate-pulse-glow" />
      <div className="absolute w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] -bottom-20 -right-20 animate-pulse-glow" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md p-8 glass-panel rounded-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-[0_0_25px_hsl(var(--primary)/0.5)] mx-auto mb-4">
            <PlayCircle className="w-8 h-8 fill-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-white mb-2">
            Join the Universe
          </h1>
          <p className="text-muted-foreground">
            Start your cinematic journey today.
          </p>
        </div>

        {/* REGISTER FORM */}
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleRegister();
          }}
        >
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="John Carter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-primary text-white h-12 transition-all focus:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-primary text-white h-12 transition-all focus:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-primary text-white h-12 transition-all focus:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
              />
            </div>
          </div>

         

          <Button
            variant="neon"
            className="w-full h-12 text-lg font-bold rounded-lg"
            type="submit"
            disabled={loading}
          >
            Create Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </form>

        {/* Switch to Sign In */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/"
              className="text-primary hover:text-primary/80 font-bold hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}