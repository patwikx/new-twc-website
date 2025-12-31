"use client";

import { useState, useRef, useEffect, Dispatch, SetStateAction } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

interface Message {
  role: string;
  text: string;
}

interface AIChatWindowProps {
  onClose: () => void;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
}

const QUICK_REPLIES = [
  "What rooms are available?",
  "Tell me about amenities",
  "How do I book?",
];

export function AIChatWindow({ onClose, messages, setMessages }: AIChatWindowProps) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSend = async (text?: string) => {
    const msgText = text || input;
    if (!msgText.trim()) return;
    
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msgText }]);
    setIsTyping(true);

    try {
      const { data } = await axios.post("/api/chat", { 
        message: msgText, 
        propertyName: "Tropicana Worldwide" 
      });
      setMessages(prev => [...prev, { role: "assistant", text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", text: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const showQuickReplies = messages.length === 1 && !isTyping;

  return (
    <div className={`fixed bottom-24 right-6 w-[360px] h-[500px] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-200 ${
      isClosing 
        ? 'opacity-0 translate-y-4 scale-95' 
        : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-5 fade-in'
    }`}>
       {/* Header */}
       <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border-b border-white/10 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
               <Sparkles className="h-5 w-5 text-white" />
             </div>
             <div>
               <h3 className="font-semibold text-sm text-white">TWC Assistant</h3>
               <p className="text-xs text-neutral-400">Powered by Google Gemini</p>
             </div>
          </div>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
       </div>
       
       {/* Messages */}
       <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-neutral-950/50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[85%] p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                 m.role === 'user' 
                   ? 'bg-orange-500 text-white rounded-2xl rounded-br-sm' 
                   : 'bg-neutral-800 text-neutral-100 border border-white/5 rounded-2xl rounded-bl-sm'
               }`}>
                 {m.text}
               </div>
            </div>
          ))}
          
          {/* Quick Replies */}
          {showQuickReplies && (
            <div className="flex flex-wrap gap-2 pt-2">
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(reply)}
                  className="text-xs px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-white/10 rounded-full transition-colors"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-neutral-800 text-neutral-400 p-3 text-sm rounded-2xl rounded-bl-sm border border-white/5">
                 <span className="inline-flex gap-1">
                   <span className="animate-bounce">●</span>
                   <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                   <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                 </span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
       </div>

       {/* Input */}
       <div className="p-3 bg-neutral-900 border-t border-white/10 flex gap-2">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about rooms, amenities, bookings..." 
            className="flex-1 rounded-full bg-neutral-800 border-white/10 focus-visible:ring-1 focus-visible:ring-orange-500 text-white placeholder:text-neutral-500"
          />
          <Button size="icon" onClick={() => handleSend()} disabled={isTyping} className="rounded-full h-10 w-10 bg-orange-500 hover:bg-orange-600 disabled:opacity-50">
             <Send className="h-4 w-4" />
          </Button>
       </div>
    </div>
  );
}
