"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { AIChatWindow } from "./AIChatWindow";

interface Message {
  role: string;
  text: string;
}

export function GlobalChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Welcome to Tropicana Worldwide! How can I help you today?" }
  ]);

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {/* Helper label */}
          <div className="bg-neutral-900 border border-white/10 px-4 py-2 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="text-sm text-white font-medium">Need help?</p>
            <p className="text-xs text-neutral-400">Ask our AI assistant</p>
          </div>
          <div className="relative">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-orange-500/40 animate-ping" />
            <Button 
              onClick={() => setIsOpen(true)}
              size="lg" 
              className="relative rounded-full h-14 w-14 shadow-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white p-0 hover:scale-110 transition-all duration-300 border border-orange-400/30"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
            {/* Notification dot */}
            <span className="absolute top-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-neutral-950 animate-pulse" />
          </div>
        </div>
      )}

      {isOpen && (
        <AIChatWindow 
          onClose={() => setIsOpen(false)} 
          messages={messages}
          setMessages={setMessages}
        />
      )}
    </>
  );
}
