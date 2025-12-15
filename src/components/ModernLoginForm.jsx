import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, ArrowRight, Check } from 'lucide-react';

// Animated Canvas Effect Component (CSS-based alternative to WebGL)
const CanvasRevealEffect = ({
  animationSpeed = 3,
  reverse = false,
}) => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-background dark:bg-black">
        {/* Animated dots pattern */}
        <div className="grid grid-cols-20 gap-1 w-full h-full p-2">
          {Array.from({ length: 400 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-white rounded-full"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 0.8, 0], 
                scale: [0, 1.2, 0] 
              }}
              transition={{
                duration: reverse ? 1.5 : 3,
                delay: reverse ? (400 - i) * 0.005 : i * 0.005,
                repeat: Infinity,
                repeatDelay: reverse ? 0.5 : 2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        
        {/* Additional glowing effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
      </div>
      
      {/* Gradient overlays - less aggressive */}
      <div className="absolute inset-0 bg-gradient-to-t from-background dark:from-black via-transparent to-background dark:to-black opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.4)_0%,_transparent_70%)]" />
    </div>
  );
};

// Animated Navigation Link
const AnimatedNavLink = ({ href, children, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="group relative inline-block overflow-hidden h-5 flex items-center text-sm cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
        <span className="text-gray-300">{children}</span>
        <span className="text-white">{children}</span>
      </div>
    </motion.button>
  );
};

// Mini Navigation Bar
const MiniNavbar = ({ onBack, showBack = false }) => {
  return (
    <motion.header 
      className="fixed top-6 left-1/2 transform -translate-x-1/2 z-20
                 flex flex-col items-center
                 pl-6 pr-6 py-3 backdrop-blur-sm
                 rounded-xl border border-gray-700 bg-gray-900/60
                 w-[calc(100%-2rem)] sm:w-auto"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <div className="flex items-center">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-gray-200" />
          </div>
        </div>

        <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
          <AnimatedNavLink href="#about">About</AnimatedNavLink>
          <AnimatedNavLink href="#features">Features</AnimatedNavLink>
          <AnimatedNavLink href="#docs">Docs</AnimatedNavLink>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {showBack && (
            <motion.button 
              onClick={onBack}
              className="px-3 py-1 text-xs border border-gray-600 bg-gray-800/60 text-gray-300 rounded-full hover:border-gray-500 hover:text-white transition-colors duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Back
            </motion.button>
          )}
          <div className="px-3 py-1 text-xs border border-gray-600 bg-gray-800/60 text-gray-300 rounded-full">
            vibeclaude
          </div>
        </div>
      </div>
    </motion.header>
  );
};

const ModernLoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("email");
  const [mode, setMode] = useState("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialCanvasVisible, setInitialCanvasVisible] = useState(true);
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);

  const { login } = useAuth();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'login') {
      if (!email || !password) {
        setError('Please enter both email and password');
        return;
      }
    } else {
      if (!email || !newPassword || !resetCode) {
        setError('Enter username, new password and reset code');
        return;
      }
    }

    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (result.success) {
          setReverseCanvasVisible(true);
          setTimeout(() => { setInitialCanvasVisible(false); }, 50);
          setTimeout(() => { setStep("success"); }, 1500);
        } else {
          setError(result.error || 'Invalid credentials');
        }
      } else {
        const res = await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, newPassword, resetCode })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setMode('login');
          setError('');
        } else {
          setError(data.error || 'Reset failed');
        }
      }
    } catch (err) {
      setError('Request failed. Please try again.');
    }
    
    setIsLoading(false);
  };

  const handleBackClick = () => {
    setStep("email");
    setError("");
    setReverseCanvasVisible(false);
    setInitialCanvasVisible(true);
  };

  return (
    <div className="flex w-full flex-col min-h-screen bg-background dark:bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        {/* Initial canvas (forward animation) */}
        {initialCanvasVisible && (
          <CanvasRevealEffect
            animationSpeed={3}
            reverse={false}
          />
        )}
        
        {/* Reverse canvas (appears when code is complete) */}
        {reverseCanvasVisible && (
          <CanvasRevealEffect
            animationSpeed={4}
            reverse={true}
          />
        )}
      </div>
      
      {/* Content Layer */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Main content container */}
        <div className="flex flex-1 flex-col justify-center items-center px-4">
          <div className="w-full max-w-sm">
            <AnimatePresence mode="wait">
              {step === "email" ? (
                <motion.div 
                  key="email-step"
                  initial={{ opacity: 0, x: -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6 text-center"
                >
                  <div className="space-y-4">
                    {/* Claude Logo */}
                    <motion.div
                      className="flex justify-center"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1, duration: 0.6 }}
                    >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
                        <img 
                          src="/icons/claude-ai-icon.svg" 
                          alt="Claude AI" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </motion.div>

                    <div className="space-y-1">
                      <motion.h1 
                        className="text-4xl font-bold leading-tight tracking-tight text-white"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                      >
                        Welcome Developer
                      </motion.h1>
                    <motion.p 
                      className="text-xl text-white/70 font-light"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                    >
                      Sign in to vibeclaude
                    </motion.p>
                    </div>
                  </div>
                  
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                  >
                    <form onSubmit={handleEmailSubmit} className="space-y-3">
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Enter your username"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full backdrop-blur-sm bg-white/5 text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center placeholder-white/40 transition-all duration-300"
                          required
                          disabled={isLoading}
                        />
                      </div>

                      {mode === 'login' ? (
                        <div className="relative">
                          <input 
                            type="password" 
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full backdrop-blur-sm bg-white/5 text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center placeholder-white/40 transition-all duration-300"
                            required
                            disabled={isLoading}
                          />
                          <motion.button 
                            type="submit"
                            className="absolute right-1.5 top-1.5 text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors group overflow-hidden"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isLoading}
                          >
                            <AnimatePresence mode="wait">
                              {isLoading ? (
                                <motion.div 
                                  key="loading"
                                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1, rotate: 360 }}
                                  exit={{ opacity: 0, scale: 0.5 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                              ) : (
                                <motion.div
                                  key="arrow"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <input 
                              type="password" 
                              placeholder="New password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full backdrop-blur-sm bg-white/5 text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center placeholder-white/40 transition-all duration-300"
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <div className="relative">
                            <input 
                              type="text" 
                              placeholder="Reset code"
                              value={resetCode}
                              onChange={(e) => setResetCode(e.target.value)}
                              className="w-full backdrop-blur-sm bg-white/5 text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center placeholder-white/40 transition-all duration-300"
                              required
                              disabled={isLoading}
                            />
                          </div>
                          <motion.button 
                            type="submit"
                            className="w-full text-white h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isLoading}
                          >
                            Reset password
                          </motion.button>
                        </>
                      )}
                    </form>
                    <div className="text-center">
                      <button className="text-xs text-white/60 underline" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); }}>
                        {mode === 'login' ? 'Esqueci minha senha' : 'Voltar ao login'}
                      </button>
                    </div>
                  </motion.div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-full text-center"
                    >
                      <p className="text-sm text-red-400">{error}</p>
                    </motion.div>
                  )}
                  
                  <motion.p 
                    className="text-xs text-white/40 pt-10 leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                  >
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                  </motion.p>
                </motion.div>
              ) : (
                <motion.div 
                  key="success-step"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                  className="space-y-6 text-center"
                >
                  <div className="space-y-1">
                    <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
                      Welcome!
                    </h1>
                    <p className="text-lg text-white/50 font-light">
                      Login successful
                    </p>
                  </div>
                  
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="py-10"
                  >
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernLoginForm;